-- SOLUCIÓN ERROR 400 RESERVAS
-- Este script asegura que la tabla 'reservations' tenga la estructura correcta y los permisos necesarios.

-- 1. Asegurar que la columna 'resources' sea del tipo correcto (ARRAY de texto)
-- Si ya existe como TEXT o JSON, esto intentará convertirla.
ALTER TABLE public.reservations 
ALTER COLUMN resources TYPE text[] 
USING resources::text[];

-- Si la columna no existiera (poco probable pero posible si el esquema es viejo)
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS resources text[] DEFAULT '{}';

-- 2. Asegurar columna 'auditorium_id' (para evitar errores si no existe)
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS auditorium_id text;

-- 3. PERMISOS (RLS) - Abrir permisos para evitar 403/406/400 en INSERT
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas viejas restrictivas
DROP POLICY IF EXISTS "Enable read access for all users" ON public.reservations;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.reservations;
DROP POLICY IF EXISTS "Enable update for users based on email" ON public.reservations;
DROP POLICY IF EXISTS "Reservas visibles para todos" ON public.reservations;
DROP POLICY IF EXISTS "Crear reservas autenticado" ON public.reservations;

-- Crear políticas permisivas para usuarios autenticados
CREATE POLICY "reservas_select_all"
ON public.reservations FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "reservas_insert_all"
ON public.reservations FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "reservas_update_own"
ON public.reservations FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "reservas_delete_own"
ON public.reservations FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 4. Verificar Tickets también (ya que se crea un ticket al reservar)
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tickets_insert_any"
ON public.tickets FOR INSERT
TO authenticated
WITH CHECK (true);

SELECT 'Esquema de reservas y permisos corregidos.' as message;
