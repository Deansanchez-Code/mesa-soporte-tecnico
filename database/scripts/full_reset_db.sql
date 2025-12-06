-- MASTER RESET SCRIPT v1.3 (Strict SQL Compliance)
-- ⚠ WARNING: This script WIPES all Tickets, Assets, and Users.

-- =========================================================================
-- 1. CLEANUP
-- =========================================================================
-- Using TRUNCATE CASCADE to clean tables efficiently
TRUNCATE TABLE public.tickets, public.assets, public.users RESTART IDENTITY CASCADE;

-- =========================================================================
-- 2. ENFORCE SCHEMA (Public Users)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('superadmin', 'admin', 'agent', 'user', 'staff', 'contractor')),
    area TEXT,
    is_active BOOLEAN DEFAULT true,
    is_vip BOOLEAN DEFAULT false,
    perm_create_assets BOOLEAN DEFAULT false,
    perm_transfer_assets BOOLEAN DEFAULT false,
    perm_decommission_assets BOOLEAN DEFAULT false,
    employment_type TEXT,
    job_category TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure indexes
CREATE INDEX IF NOT EXISTS users_email_idx ON public.users(email);
CREATE INDEX IF NOT EXISTS users_username_idx ON public.users(username);
CREATE INDEX IF NOT EXISTS users_role_idx ON public.users(role);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()    
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_users_updated ON public.users;
CREATE TRIGGER on_users_updated
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =========================================================================
-- 3. SYNC MECHANISM
-- =========================================================================
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

    INSERT INTO public.users (id, auth_id, email, username, full_name, role, is_active)
    VALUES (NEW.id, NEW.id, NEW.email, v_username, v_full_name, v_role, true)
    ON CONFLICT (id) DO UPDATE
    SET 
        email = EXCLUDED.email,
        auth_id = EXCLUDED.id,
        role = EXCLUDED.role,
        updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate Auth Trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================================
-- 4. BOOTSTRAP SUPER ADMIN
-- =========================================================================
DO $$
DECLARE
    v_admin_email TEXT := 'deansan@sistema.local';
    v_admin_pass TEXT := '80854269';
    v_admin_id UUID;
BEGIN
    -- Update Auth User
    UPDATE auth.users
    SET 
        encrypted_password = crypt(v_admin_pass, gen_salt('bf')),
        email_confirmed_at = now(),
        banned_until = NULL,
        raw_user_meta_data = '{"username": "deansan", "full_name": "Ing. Deivis Andres Sanchez H.", "role": "superadmin"}'::jsonb
    WHERE email = v_admin_email
    RETURNING id INTO v_admin_id;
    
    -- Insert/Update Public User
    IF v_admin_id IS NOT NULL THEN
        INSERT INTO public.users (id, auth_id, email, username, full_name, role, is_active, area, perm_create_assets, perm_transfer_assets, perm_decommission_assets, is_vip)
        VALUES (
            v_admin_id,
            v_admin_id,
            v_admin_email,
            'deansan',
            'Ing. Deivis Andres Sanchez H.',
            'superadmin',
            true,
            'Dirección General',
            true, true, true, true
        )
        ON CONFLICT (id) DO UPDATE
        SET 
            role = 'superadmin',
            auth_id = EXCLUDED.id,
            perm_create_assets = true,
            is_active = true;
            
        RAISE NOTICE '✅ Super Admin Bootstrapped: %', v_admin_email;
    END IF;
END $$;

-- =========================================================================
-- 5. RLS SECURITY POLICIES
-- =========================================================================
-- Assets
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Ver activos (Autenticados)" ON public.assets;
CREATE POLICY "Ver activos (Autenticados)" ON public.assets FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Gestionar activos (Admin y Agentes)" ON public.assets;
CREATE POLICY "Gestionar activos (Admin y Agentes)" ON public.assets FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'agent', 'superadmin'))
);

-- Tickets
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Ver tickets (Propio o Staff)" ON public.tickets;
CREATE POLICY "Ver tickets (Propio o Staff)" ON public.tickets FOR SELECT TO authenticated USING (
  user_id = auth.uid() OR 
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'agent', 'superadmin'))
);

DROP POLICY IF EXISTS "Crear ticket (Usuario)" ON public.tickets;
CREATE POLICY "Crear ticket (Usuario)" ON public.tickets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Editar tickets (Staff)" ON public.tickets;
CREATE POLICY "Editar tickets (Staff)" ON public.tickets FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'agent', 'superadmin'))
);

-- Users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Leer usuarios (Autenticados)" ON public.users;
CREATE POLICY "Leer usuarios (Autenticados)" ON public.users FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Gestionar usuarios (Solo Admin)" ON public.users;
CREATE POLICY "Gestionar usuarios (Solo Admin)" ON public.users FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
);

-- Reservations
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Ver reservas (Todos)" ON public.reservations;
CREATE POLICY "Ver reservas (Todos)" ON public.reservations FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Crear reserva (Usuario)" ON public.reservations;
CREATE POLICY "Crear reserva (Usuario)" ON public.reservations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Gestionar reserva (Dueño o Admin)" ON public.reservations;
CREATE POLICY "Gestionar reserva (Dueño o Admin)" ON public.reservations FOR ALL TO authenticated USING (
  user_id = auth.uid() OR 
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

RAISE NOTICE '✅ Master Reset Completed Successfully.';
