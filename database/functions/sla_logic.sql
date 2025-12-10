-- Functions: SLA Logic & Ticket Code Generation

-- 1. Helper: Add Business Hours (Simple version: just adds hours for now, can be expanded for Holidays)
CREATE OR REPLACE FUNCTION public.calculate_deadline(p_start_time TIMESTAMPTZ, p_hours INT)
RETURNS TIMESTAMPTZ AS $$
BEGIN
    -- For now, simple addition. 
    -- TODO: Implement business hours logic (Mon-Fri 8-6) if required strictly.
    RETURN p_start_time + (p_hours || ' hours')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- 2. Trigger: Auto-Classify and Assign Code BEFORE INSERT
CREATE OR REPLACE FUNCTION public.handle_new_ticket_classification()
RETURNS TRIGGER AS $$
DECLARE
    v_config RECORD;
    v_seq_val BIGINT;
    v_is_vip BOOLEAN DEFAULT false;
    v_hours INT;
BEGIN
    -- A. Check VIP Status of the CREATOR (User)
    SELECT is_vip INTO v_is_vip FROM public.users WHERE id = NEW.user_id;
    NEW.is_vip_ticket := COALESCE(v_is_vip, false);

    -- B. Find Classification based on Description or Category match
    -- We assume the 'category' column in tickets matches 'user_selection_text'
    SELECT * INTO v_config FROM public.ticket_categories_config 
    WHERE user_selection_text = NEW.category 
    LIMIT 1;

    IF v_config IS NOT NULL THEN
        NEW.ticket_type := v_config.internal_type;
        
        -- C. Calculate SLA
        IF NEW.is_vip_ticket THEN
            v_hours := v_config.sla_hours_vip;
        ELSE
            v_hours := v_config.sla_hours_std;
        END IF;
    ELSE
        -- Fallback if no match found
        NEW.ticket_type := 'REQ'; -- Default Safe
        v_hours := 72;
    END IF;

    -- D. Generate Code using Sequences
    IF NEW.ticket_type = 'INC' THEN
        v_seq_val := nextval('seq_inc');
        NEW.ticket_code := 'INC-' || v_seq_val;
    ELSE
        v_seq_val := nextval('seq_req');
        NEW.ticket_code := 'REQ-' || v_seq_val;
    END IF;

    -- E. Set SLA Timestamps
    NEW.sla_start_at := now();
    NEW.sla_expected_end_at := public.calculate_deadline(now(), v_hours);
    NEW.sla_status := 'running';

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Bind Trigger
DROP TRIGGER IF EXISTS trg_classify_ticket ON public.tickets;
CREATE TRIGGER trg_classify_ticket
    BEFORE INSERT ON public.tickets
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_ticket_classification();

-- 4. Trigger: Log Events (Audit)
CREATE OR REPLACE FUNCTION public.handle_ticket_audit()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE') THEN
        -- Detect Status Change
        IF OLD.status IS DISTINCT FROM NEW.status THEN
            INSERT INTO public.ticket_events (ticket_id, actor_id, action_type, old_value, new_value)
            VALUES (NEW.id, auth.uid(), 'STATUS_CHANGE', OLD.status, NEW.status);
        END IF;

        -- Detect Pause
        IF OLD.sla_status = 'running' AND NEW.sla_status = 'paused' THEN
             INSERT INTO public.ticket_events (ticket_id, actor_id, action_type, comment)
            VALUES (NEW.id, auth.uid(), 'PAUSED', NEW.sla_pause_reason);
        END IF;

        -- Detect Resume
        IF OLD.sla_status = 'paused' AND NEW.sla_status = 'running' THEN
             INSERT INTO public.ticket_events (ticket_id, actor_id, action_type)
            VALUES (NEW.id, auth.uid(), 'RESUMED');
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ticket_audit ON public.tickets;
CREATE TRIGGER trg_ticket_audit
    AFTER UPDATE ON public.tickets
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_ticket_audit();
