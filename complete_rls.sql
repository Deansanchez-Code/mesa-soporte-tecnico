-- HABILITAR RLS FALTANTE PARA ASSETS Y TICKETS

-- 1. ASSETS (ACTIVOS)
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

-- Política: Todos los autenticados pueden ver activos (necesario para selects en formularios)
CREATE POLICY "Autenticados pueden ver activos" 
ON public.assets FOR SELECT 
TO authenticated 
USING (true);

-- Política: Solo Admins y Agentes pueden gestionar activos (Insert/Update/Delete)
CREATE POLICY "Personal autorizado gestiona activos" 
ON public.assets FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('superadmin', 'admin', 'agent')
  )
);

-- 2. TICKETS
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- Política: Usuarios ven sus propios tickets
CREATE POLICY "Usuarios ven sus propios tickets" 
ON public.tickets FOR SELECT 
TO authenticated 
USING (user_id = auth.uid());

-- Política: Admins y Agentes ven TODOS los tickets
CREATE POLICY "Personal ve todos los tickets" 
ON public.tickets FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('superadmin', 'admin', 'agent')
  )
);

-- Política: Usuarios pueden crear tickets
CREATE POLICY "Usuarios crean tickets" 
ON public.tickets FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- Política: Admins y Agentes pueden actualizar tickets (cambiar estado, asignar)
CREATE POLICY "Personal actualiza tickets" 
ON public.tickets FOR UPDATE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('superadmin', 'admin', 'agent')
  )
);
