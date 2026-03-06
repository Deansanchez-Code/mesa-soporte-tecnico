-- Migración para permitir el estado 'PENDING' en la tabla de reservaciones
-- Esto resuelve el error "violates check constraint reservations_status_check"
-- 1. Eliminar la restricción antigua
ALTER TABLE public.reservations DROP CONSTRAINT IF EXISTS reservations_status_check;
-- 2. Agregar la nueva restricción con 'PENDING' incluido
ALTER TABLE public.reservations
ADD CONSTRAINT reservations_status_check CHECK (status IN ('APPROVED', 'CANCELLED', 'PENDING'));