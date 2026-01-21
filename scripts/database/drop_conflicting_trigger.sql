-- Drop the conflicting broken trigger and function
DROP TRIGGER IF EXISTS trg_calculate_ticket_sla ON public.tickets;
DROP TRIGGER IF EXISTS on_ticket_created ON public.tickets; -- Possible alternate name
DROP FUNCTION IF EXISTS public.calculate_ticket_sla;

-- Ensure the CORRECT trigger is active (in case it wasn't added previously)
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
  IF NEW.user_id IS NOT NULL THEN
    SELECT is_vip INTO v_is_vip FROM public.users WHERE id = NEW.user_id;
  ELSE
    v_is_vip := false;
  END IF;

  SELECT * INTO v_config
  FROM public.ticket_categories_config
  WHERE internal_type = NEW.ticket_type
  LIMIT 1;

  IF FOUND THEN
    v_sla_hours := CASE WHEN v_is_vip THEN v_config.sla_hours_vip ELSE v_config.sla_hours_std END;
  ELSE
    v_sla_hours := CASE WHEN NEW.ticket_type = 'INC' THEN 4 ELSE 24 END;
  END IF;

  NEW.sla_start_at := NOW();
  NEW.sla_expected_end_at := NOW() + (v_sla_hours || ' hours')::interval;
  NEW.sla_status := 'running';

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_calculate_sla_deadline ON public.tickets;
CREATE TRIGGER trg_calculate_sla_deadline
BEFORE INSERT ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.calculate_sla_deadline();
