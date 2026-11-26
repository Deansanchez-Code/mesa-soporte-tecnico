-- Migración opcional e idempotente (ejecución manual L3 en Supabase SQL Editor)
-- Copia asignaciones vigentes/futuras de Ambiente 107 y Cocina desde `instructor_assignments`
-- hacia `reservations`, evitando duplicados cuando ya existan en la misma franja.
--
-- NOTA: El código de aplicación ya lee ambas fuentes (`reservations` + `instructor_assignments`)
-- de forma transparente sin necesidad obligatoria de migrar los datos.

BEGIN;

INSERT INTO public.reservations (
  title,
  description,
  start_time,
  end_time,
  user_id,
  auditorium_id,
  status,
  resources
)
SELECT
  CASE UPPER(ia.time_block)
    WHEN 'TARDE' THEN 'Asignación de Formación (Tarde)'
    WHEN 'NOCHE' THEN 'Asignación de Formación (Noche)'
    ELSE 'Asignación de Formación (Mañana)'
  END AS title,
  'Migrado desde asignación de formación (instructor_assignments #' || ia.id || ')' AS description,
  CASE UPPER(ia.time_block)
    WHEN 'TARDE' THEN (ia.assignment_date::text || ' 12:00:00-05')::timestamptz
    WHEN 'NOCHE' THEN (ia.assignment_date::text || ' 18:30:00-05')::timestamptz
    ELSE (ia.assignment_date::text || ' 06:00:00-05')::timestamptz
  END AS start_time,
  CASE UPPER(ia.time_block)
    WHEN 'TARDE' THEN (ia.assignment_date::text || ' 18:00:00-05')::timestamptz
    WHEN 'NOCHE' THEN (ia.assignment_date::text || ' 22:30:00-05')::timestamptz
    ELSE (ia.assignment_date::text || ' 12:00:00-05')::timestamptz
  END AS end_time,
  ia.instructor_id AS user_id,
  CASE
    WHEN UPPER(a.name) LIKE '%107%' THEN '4'
    WHEN UPPER(a.name) LIKE '%COCINA%' THEN '5'
  END AS auditorium_id,
  'APPROVED' AS status,
  ARRAY[]::text[] AS resources
FROM public.instructor_assignments ia
JOIN public.areas a ON a.id = ia.area_id
WHERE (UPPER(a.name) LIKE '%107%' OR UPPER(a.name) LIKE '%COCINA%')
  AND ia.assignment_date >= (NOW() AT TIME ZONE 'America/Bogota')::date
  AND NOT EXISTS (
    SELECT 1
    FROM public.reservations r
    WHERE r.auditorium_id = CASE
      WHEN UPPER(a.name) LIKE '%107%' THEN '4'
      WHEN UPPER(a.name) LIKE '%COCINA%' THEN '5'
    END
      AND r.status IN ('APPROVED', 'PENDING')
      AND r.start_time < CASE UPPER(ia.time_block)
        WHEN 'TARDE' THEN (ia.assignment_date::text || ' 18:00:00-05')::timestamptz
        WHEN 'NOCHE' THEN (ia.assignment_date::text || ' 22:30:00-05')::timestamptz
        ELSE (ia.assignment_date::text || ' 12:00:00-05')::timestamptz
      END
      AND r.end_time > CASE UPPER(ia.time_block)
        WHEN 'TARDE' THEN (ia.assignment_date::text || ' 12:00:00-05')::timestamptz
        WHEN 'NOCHE' THEN (ia.assignment_date::text || ' 18:30:00-05')::timestamptz
        ELSE (ia.assignment_date::text || ' 06:00:00-05')::timestamptz
      END
  );

COMMIT;

-- Rollback manual en caso necesario:
-- DELETE FROM public.reservations WHERE description LIKE 'Migrado desde asignación de formación (instructor_assignments #%';
