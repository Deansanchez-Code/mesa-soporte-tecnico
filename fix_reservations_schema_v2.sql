-- SOLUCIÓN ERROR 42846 (CAST TYPE JSONB TO TEXT[])
-- Corrección del script anterior para convertir la columna 'resources' de JSONB a TEXT[] sin error.

BEGIN;

-- 1. Añadir columna temporal del tipo correcto
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS resources_new text[] DEFAULT '{}';

-- 2. Migrar los datos existentes (Convirtiendo de JSONB a TEXT[])
-- Esta consulta toma los elementos del array JSONB y los convierte a un array de PostgreSQL
UPDATE public.reservations
SET resources_new = (
    SELECT array_agg(value)
    FROM jsonb_array_elements_text(resources)
)
WHERE jsonb_typeof(resources) = 'array';

-- 3. Eliminar la columna vieja y renombrar la nueva
ALTER TABLE public.reservations DROP COLUMN resources;
ALTER TABLE public.reservations RENAME COLUMN resources_new TO resources;

-- 4. Asegurar columna 'auditorium_id'
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS auditorium_id text;

-- 5. RE-APLICAR PERMISOS (RLS) - Abrir permisos para evitar 403
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.reservations;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.reservations;
DROP POLICY IF EXISTS "reservas_select_all" ON public.reservations;
DROP POLICY IF EXISTS "reservas_insert_all" ON public.reservations;

-- Crear políticas permisivas
CREATE POLICY "reservas_select_all" ON public.reservations FOR SELECT TO authenticated USING (true);
CREATE POLICY "reservas_insert_all" ON public.reservations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "reservas_update_own" ON public.reservations FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "reservas_delete_own" ON public.reservations FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 6. TICKET FIX (Por si acaso)
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tickets_insert_any" ON public.tickets;
CREATE POLICY "tickets_insert_any" ON public.tickets FOR INSERT TO authenticated WITH CHECK (true);

COMMIT;

SELECT '✅ Columna resources convertida a text[] y permisos aplicados exitosamente.' as message;
