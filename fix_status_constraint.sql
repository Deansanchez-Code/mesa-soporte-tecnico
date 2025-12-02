-- SOLUCIÓN ERROR 23514 (Check Constraint Violation)
-- Este script actualiza las restricciones de la tabla tickets para permitir el estado 'EN_ESPERA'.

-- 1. Eliminar restricciones antiguas sobre la columna status (probando nombres comunes)
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_status_check;
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS status_check;
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_status_check1;

-- 2. Agregar la nueva restricción que INCLUYE 'EN_ESPERA'
ALTER TABLE public.tickets 
ADD CONSTRAINT tickets_status_check 
CHECK (status IN ('PENDIENTE', 'EN_PROGRESO', 'RESUELTO', 'CERRADO', 'EN_ESPERA'));

-- 3. Eliminar restricción sobre hold_reason si existe (para evitar bloqueos por el texto del motivo)
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_hold_reason_check;
