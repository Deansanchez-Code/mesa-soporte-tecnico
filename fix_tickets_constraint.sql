-- SOLUCIÓN ERROR CONSTRAINT TICKETS
-- El error indica que 'Reserva Auditorio' no es una categoría permitida en la tabla tickets.
-- Vamos a actualizar el CHECK constraint para permitirla.

ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_category_check;

ALTER TABLE public.tickets
ADD CONSTRAINT tickets_category_check 
CHECK (category IN ('HARDWARE', 'SOFTWARE', 'Reserva Auditorio', 'RESERVATION'));

SELECT 'Constraint de categoría actualizado.' as message;
