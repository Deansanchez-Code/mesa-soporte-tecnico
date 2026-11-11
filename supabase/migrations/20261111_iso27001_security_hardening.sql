-- ============================================================================
-- ISO/IEC 27001:2022 Security Hardening Migration (Fase 2 - Supabase DB/RLS)
-- Controls: A.5.15, A.8.2, A.8.3, A.8.11, A.8.15, A.8.26
-- Idempotente: segura para ejecutar en Supabase SQL Editor.
-- Plan de rollback: restaurar políticas previas mediante DROP POLICY + CREATE.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. TICKETS: Corregir política USING (true) que exponía todos los tickets
-- ----------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tickets are private" ON public.tickets;
DROP POLICY IF EXISTS "Ver tickets (Propio o Staff)" ON public.tickets;
DROP POLICY IF EXISTS "Enable read access for users on own tickets" ON public.tickets;

CREATE POLICY "Ver tickets (Propio o Staff)" ON public.tickets
    FOR SELECT
    TO authenticated
    USING (
        user_id IN (
            SELECT u.id FROM public.users u
            WHERE u.auth_id = auth.uid() OR u.id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.users u
            WHERE (u.auth_id = auth.uid() OR u.id = auth.uid())
              AND u.is_active IS DISTINCT FROM false
              AND u.role IN ('agent', 'admin', 'superadmin', 'staff')
        )
    );

-- ----------------------------------------------------------------------------
-- 2. TRIGGER handle_new_user: Evitar elevación de privilegios en ON CONFLICT
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_username TEXT;
    v_full_name TEXT;
    v_role TEXT;
BEGIN
    v_username := COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1));
    v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', v_username);
    v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'user');

    -- Coerción de seguridad: si el rol entrante no es explícitamente permitido, degradar a 'user'
    IF v_role NOT IN ('superadmin', 'admin', 'agent', 'user', 'staff', 'contractor', 'instructor', 'vip', 'coordinator') THEN
        v_role := 'user';
    END IF;

    INSERT INTO public.users (
        id, auth_id, email, username, full_name, role, is_active,
        area, employment_type, job_category,
        perm_create_assets, perm_transfer_assets, perm_decommission_assets, is_vip
    )
    VALUES (
        NEW.id, NEW.id, NEW.email, v_username, v_full_name, v_role, true,
        NEW.raw_user_meta_data->>'area',
        NEW.raw_user_meta_data->>'employment_type',
        NEW.raw_user_meta_data->>'job_category',
        COALESCE((NEW.raw_user_meta_data->>'perm_create_assets')::BOOLEAN, false),
        COALESCE((NEW.raw_user_meta_data->>'perm_transfer_assets')::BOOLEAN, false),
        COALESCE((NEW.raw_user_meta_data->>'perm_decommission_assets')::BOOLEAN, false),
        COALESCE((NEW.raw_user_meta_data->>'is_vip')::BOOLEAN, false)
    )
    ON CONFLICT (id) DO UPDATE
    SET
        email = EXCLUDED.email,
        auth_id = EXCLUDED.id,
        updated_at = now();
        -- NO sobrescribir role / is_vip / permisos existentes desde metadata modificable por el usuario

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 3. SYSTEM_SETTINGS: RLS por clave (lectura controlada, escritura Admin/SuperAdmin)
-- ----------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read safe settings" ON public.system_settings;
CREATE POLICY "Public read safe settings" ON public.system_settings
    FOR SELECT
    TO anon, authenticated
    USING (
        key IN (
            'spaces_maintenance',
            'auditorium_maintenance',
            'environments_global_config'
        )
    );

DROP POLICY IF EXISTS "Admins manage system settings" ON public.system_settings;
CREATE POLICY "Admins manage system settings" ON public.system_settings
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE (u.auth_id = auth.uid() OR u.id = auth.uid())
              AND u.is_active IS DISTINCT FROM false
              AND u.role IN ('admin', 'superadmin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE (u.auth_id = auth.uid() OR u.id = auth.uid())
              AND u.is_active IS DISTINCT FROM false
              AND u.role IN ('admin', 'superadmin')
        )
    );

-- ----------------------------------------------------------------------------
-- 4. USER_NOTIFICATIONS: Aislamiento estricto por titular
-- ----------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.user_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own notifications" ON public.user_notifications;
CREATE POLICY "Users read own notifications" ON public.user_notifications
    FOR SELECT
    TO authenticated
    USING (
        user_id IN (
            SELECT u.id FROM public.users u
            WHERE u.auth_id = auth.uid() OR u.id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users mark own notifications read" ON public.user_notifications;
CREATE POLICY "Users mark own notifications read" ON public.user_notifications
    FOR UPDATE
    TO authenticated
    USING (
        user_id IN (
            SELECT u.id FROM public.users u
            WHERE u.auth_id = auth.uid() OR u.id = auth.uid()
        )
    )
    WITH CHECK (
        user_id IN (
            SELECT u.id FROM public.users u
            WHERE u.auth_id = auth.uid() OR u.id = auth.uid()
        )
    );

-- ----------------------------------------------------------------------------
-- 5. RESERVATIONS UPDATE: Evitar que cualquier VIP edite campos arbitrarios vía cliente
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "VIP and Admins can update any reservation" ON public.reservations;
DROP POLICY IF EXISTS "Admins can update any reservation" ON public.reservations;
CREATE POLICY "Admins can update any reservation" ON public.reservations
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE (u.auth_id = auth.uid() OR u.id = auth.uid())
              AND u.is_active IS DISTINCT FROM false
              AND u.role IN ('admin', 'superadmin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE (u.auth_id = auth.uid() OR u.id = auth.uid())
              AND u.is_active IS DISTINCT FROM false
              AND u.role IN ('admin', 'superadmin')
        )
    );

-- ----------------------------------------------------------------------------
-- 6. STORAGE BUCKETS: Cerrar lectura anónima indiscriminada sobre evidencias/actas
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated read ticket evidence and authorizations" ON storage.objects;

CREATE POLICY "Authenticated read ticket evidence and authorizations" ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id IN ('ticket_evidence', 'asset-authorizations')
    );

COMMIT;

