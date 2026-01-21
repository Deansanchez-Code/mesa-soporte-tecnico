
-- Fix trigger function that references missing 'priority' column
CREATE OR REPLACE FUNCTION public.calculate_sla_deadline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_sla_hours int;
  v_is_vip boolean;
  v_config record;
BEGIN
  -- Check if user is VIP (if user_id is present)
  IF NEW.user_id IS NOT NULL THEN
    SELECT is_vip INTO v_is_vip 
    FROM public.users 
    WHERE id = NEW.user_id;
  ELSE
    v_is_vip := false;
  END IF;

  -- Get SLA config based on ticket_type or category
  -- Assuming distinct configs for INC/REQ or categories. 
  -- If category is "Reserva Auditorio", it might be REQ.
  
  -- Attempt to match by category first (if you have category-based config)
  -- Or just use ticket_type if that's how your system works.
  -- Based on the error, the previous code was likely: 
  -- IF NEW.priority = 'HIGH' THEN ...
  
  -- New Logic:
  -- Fetch configuration from ticket_categories_config if possible, 
  -- or default to standard values.
  
  -- Use internal_type (INC/REQ) to find config
  SELECT * INTO v_config
  FROM public.ticket_categories_config
  WHERE internal_type = NEW.ticket_type
  LIMIT 1;

  IF FOUND THEN
    IF v_is_vip THEN
      v_sla_hours := v_config.sla_hours_vip;
    ELSE
      v_sla_hours := v_config.sla_hours_std;
    END IF;
  ELSE
    -- Default fallback if no config found
    IF NEW.ticket_type = 'INC' THEN
      v_sla_hours := 4; -- Default 4h for incidents
    ELSE
      v_sla_hours := 24; -- Default 24h for requests
    END IF;
  END IF;

  -- Calculate Deadline
  -- Use a helper function if exists, or simple arithmetic
  NEW.sla_start_at := NOW();
  NEW.sla_expected_end_at := NOW() + (v_sla_hours || ' hours')::interval;
  NEW.sla_status := 'running';
  
  -- Ensure we don't try to access NEW.priority since it doesn't exist
  -- Remove any logic setting or reading NEW.priority

  RETURN NEW;
END;
$function$;
