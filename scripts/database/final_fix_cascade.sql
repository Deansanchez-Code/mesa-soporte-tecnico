-- 1. ELIMINACIÓN NUCLEAR (CASCADE)
-- Esto borra la función Y el trigger 'trigger_calculate_ticket_sla' automáticamente
DROP FUNCTION IF EXISTS public.calculate_ticket_sla CASCADE;

-- 2. Asegurar que la función NUEVA Y CORRECTA exista
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
  -- Verificar VIP
  IF NEW.user_id IS NOT NULL THEN
    SELECT is_vip INTO v_is_vip FROM public.users WHERE id = NEW.user_id;
  ELSE
    v_is_vip := false;
  END IF;

  -- Buscar configuración por TICKET_TYPE
  SELECT * INTO v_config
  FROM public.ticket_categories_config
  WHERE internal_type = NEW.ticket_type
  LIMIT 1;

  IF FOUND THEN
    v_sla_hours := CASE WHEN v_is_vip THEN v_config.sla_hours_vip ELSE v_config.sla_hours_std END;
  ELSE
    v_sla_hours := CASE WHEN NEW.ticket_type = 'INC' THEN 4 ELSE 24 END;
  END IF;

  -- Calcular Fechas (Sin tocar 'priority')
  NEW.sla_start_at := NOW();
  NEW.sla_expected_end_at := NOW() + (v_sla_hours || ' hours')::interval;
  NEW.sla_status := 'running';

  RETURN NEW;
END;
$function$;

-- 3. Reconectar el trigger de la función nueva (por seguridad)
DROP TRIGGER IF EXISTS trg_calculate_sla_deadline ON public.tickets;
CREATE TRIGGER trg_calculate_sla_deadline
BEFORE INSERT ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.calculate_sla_deadline();
