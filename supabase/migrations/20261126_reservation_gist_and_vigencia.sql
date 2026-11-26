-- Migración Fase 1: Bloqueo atómico de reservas simultáneas + soporte de cambio de vigencia anual
-- Nivel de riesgo: L3 (ejecutar manualmente en Supabase SQL Editor / CLI tras respaldo)
--
-- ROLLBACK:
--   ALTER TABLE public.reservations DROP CONSTRAINT IF EXISTS reservations_no_overlapping_space_slots;
--   DROP FUNCTION IF EXISTS public.rollover_vigencia_users();

-- 1. Extensión requerida para combinar igualdad (=) sobre TEXT con rango temporal (tstzrange &&)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 2. Restricción de exclusión atómica en PostgreSQL para impedir dobles reservas concurrentes
--    sobre el mismo ambiente y rango horario mientras la reserva esté APPROVED o PENDING.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'reservations_no_overlapping_space_slots'
      AND conrelid = 'public.reservations'::regclass
  ) THEN
    ALTER TABLE public.reservations
      ADD CONSTRAINT reservations_no_overlapping_space_slots
      EXCLUDE USING GIST (
        auditorium_id WITH =,
        tstzrange(start_time, end_time, '[)') WITH &&
      )
      WHERE (status IN ('APPROVED', 'PENDING') AND auditorium_id IS NOT NULL);
  END IF;
END
$$;

-- 3. Función auxiliar para cambio de vigencia anual (desactiva contratistas y soportes 'agent';
--    preserva activos a funcionarios de planta, usuarios VIP, coordinadores, admin y superadmin).
CREATE OR REPLACE FUNCTION public.rollover_vigencia_users()
RETURNS TABLE(deactivated_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  UPDATE public.users
  SET
    is_active = FALSE,
    updated_at = NOW()
  WHERE is_active IS DISTINCT FROM FALSE
    AND LOWER(COALESCE(role, '')) NOT IN ('superadmin', 'admin', 'vip')
    AND COALESCE(is_vip, FALSE) = FALSE
    AND (
      LOWER(COALESCE(role, '')) = 'agent'
      OR LOWER(COALESCE(employment_type, '')) = 'contratista'
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN QUERY SELECT v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.rollover_vigencia_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rollover_vigencia_users() TO service_role;
