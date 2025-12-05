-- ACTUALIZACIÓN DE POLÍTICAS RLS PARA ACTIVOS (ASSETS)
-- Soluciona el error 403 al crear equipos permitiendo que admins/agentes gestionen activos
-- independientemente de mayúsculas/minúsculas en su rol.

-- 1. Eliminar política restrictiva anterior si existe
DROP POLICY IF EXISTS "Personal autorizado gestiona activos" ON public.assets;

-- 2. Crear nueva política robusta para INSERT, UPDATE, DELETE
CREATE POLICY "Personal autorizado gestiona activos"
ON public.assets
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND LOWER(role) IN ('superadmin', 'admin', 'agent')
  )
);

-- 3. Asegurar que todos puedan VER los activos (para el autocompletado y listas)
DROP POLICY IF EXISTS "Autenticados pueden ver activos" ON public.assets;

CREATE POLICY "Autenticados pueden ver activos"
ON public.assets
FOR SELECT
TO authenticated
USING (true);

-- Confirmación
SELECT 'Políticas de seguridad actualizadas correctamente' as message;
