-- SOLUCIÓN DEFINITIVA PARA CONSTRAINT DE TICKETS
-- Elimina la restricción de categorías fijas (HARDWARE, SOFTWARE) para permitir 'Reserva Auditorio' y otras futuras.

BEGIN;

-- 1. Eliminar la restricción actual (Check Constraint)
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_category_check;

-- 2. Asegurarnos que la columna 'category' sea simplemente TEXT (sin restricciones extras)
-- (Postgres no añade restricciones por defecto al menos que sean ENUMs o CHECKs, así que al borrar el check basta)

-- 3. (Opcional) Insertar la categoría en la tabla 'categories' si existiera y fuera necesaria para dropdowns
-- Intentamos insertar, si falla no importa (ON CONFLICT DO NOTHING)
INSERT INTO public.categories (name) VALUES ('Reserva Auditorio') ON CONFLICT DO NOTHING;
INSERT INTO public.categories (name) VALUES ('HARDWARE') ON CONFLICT DO NOTHING;
INSERT INTO public.categories (name) VALUES ('SOFTWARE') ON CONFLICT DO NOTHING;

COMMIT;

SELECT '✅ Restricción de categoría eliminada. Ahora se permite cualquier texto en tickets.category.' as message;
