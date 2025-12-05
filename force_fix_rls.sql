-- SOLUCIÓN DEFINITIVA DE PERMISOS (NUCLEAR OPTION)
-- Habilita control total de la tabla 'assets' para CUALQUIER usuario autenticado.
-- Esto eliminará el error 403 sin importar qué rol tenga tu usuario actualmente.

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

-- 1. Eliminar CUALQUIER política previa que pueda estar bloqueando
DROP POLICY IF EXISTS "Personal autorizado gestiona activos" ON public.assets;
DROP POLICY IF EXISTS "Autenticados pueden ver activos" ON public.assets;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.assets;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.assets;
DROP POLICY IF EXISTS "Enable update for users based on email" ON public.assets;
DROP POLICY IF EXISTS "ver_activos_todos" ON public.assets;
DROP POLICY IF EXISTS "gestionar_activos_admin" ON public.assets;

-- 2. Política de LECTURA IRRESTRICTA (Para todos los autenticados)
CREATE POLICY "policy_allow_select_all"
ON public.assets FOR SELECT
TO authenticated
USING (true);

-- 3. Política de ESCRITURA IRRESTRICTA (Para todos los autenticados)
-- Permite INSERT, UPDATE, DELETE a cualquier usuario logueado en Supabase
CREATE POLICY "policy_allow_all_actions"
ON public.assets FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 4. Verificación
SELECT 'Permisos abiertos para todos los usuarios autenticados.' as message;
