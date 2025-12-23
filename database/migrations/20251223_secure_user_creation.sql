-- Secure User Creation & RLS Hardening

-- 1. Actualizar Trigger para manejar TODOS los metadatos
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
    v_username TEXT;
    v_full_name TEXT;
    v_role TEXT;
    v_area TEXT;
    v_employment_type TEXT;
    v_job_category TEXT;
    v_perm_create BOOLEAN;
    v_perm_transfer BOOLEAN;
    v_perm_decommission BOOLEAN;
    v_is_vip BOOLEAN;
BEGIN
    -- Extraer datos del JSONB raw_user_meta_data
    v_username := COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1));
    v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', v_username);
    v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'user');
    v_area := NEW.raw_user_meta_data->>'area';
    v_employment_type := NEW.raw_user_meta_data->>'employment_type';
    v_job_category := NEW.raw_user_meta_data->>'job_category';
    
    -- Manejo seguro de booleanos (Postgres JSONB -> Text -> Boolean casting puede fallar si no se limpia)
    v_perm_create := (NEW.raw_user_meta_data->>'perm_create_assets')::BOOLEAN;
    v_perm_transfer := (NEW.raw_user_meta_data->>'perm_transfer_assets')::BOOLEAN;
    v_perm_decommission := (NEW.raw_user_meta_data->>'perm_decommission_assets')::BOOLEAN;
    v_is_vip := (NEW.raw_user_meta_data->>'is_vip')::BOOLEAN;

    INSERT INTO public.users (
        id, auth_id, email, username, full_name, role, is_active,
        area, employment_type, job_category,
        perm_create_assets, perm_transfer_assets, perm_decommission_assets, is_vip
    )
    VALUES (
        NEW.id, NEW.id, NEW.email, v_username, v_full_name, v_role, true,
        v_area, v_employment_type, v_job_category,
        COALESCE(v_perm_create, false), 
        COALESCE(v_perm_transfer, false), 
        COALESCE(v_perm_decommission, false), 
        COALESCE(v_is_vip, false)
    )
    ON CONFLICT (id) DO UPDATE
    SET 
        email = EXCLUDED.email,
        auth_id = EXCLUDED.id,
        role = EXCLUDED.role,
        area = EXCLUDED.area,
        employment_type = EXCLUDED.employment_type,
        job_category = EXCLUDED.job_category,
        updated_at = now();
        
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Endurecer RLS de Assets (Evitar filtración de seriales)
DROP POLICY IF EXISTS "Ver activos (Autenticados)" ON public.assets;
DROP POLICY IF EXISTS "Enable search access for authenticated users on assets" ON public.assets;

-- Nueva política: Solo ver activos asignados a uno mismo
CREATE POLICY "Ver activos asignados" ON public.assets 
FOR SELECT TO authenticated 
USING (assigned_to_user_id = auth.uid());

-- Política para Staff (Admin, Agent, Superadmin) para ver TODO
CREATE POLICY "Staff ve todos los activos" ON public.assets 
FOR SELECT TO authenticated 
USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'agent', 'superadmin'))
);
