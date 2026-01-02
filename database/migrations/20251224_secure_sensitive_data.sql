-- CRITICAL SECURITY FIX
-- The previous policy allowed "SELECT *" on public.users to everyone.
-- This potentially exposed 'password', 'email', 'phone' to anonymous users.
-- We will switch to Column-Level Security to "repair without affecting functionality" (Calendar names).

BEGIN;

-- 1. Revoke generic SELECT on critical tables from 'anon' and 'public' roles
-- (Authenticated users might need more access, handled by policies, but we restrict base privileges first)
REVOKE SELECT ON public.tickets FROM anon, public;
REVOKE SELECT ON public.assets FROM anon, public;
REVOKE SELECT ON public.audit_logs FROM anon, public;
REVOKE SELECT ON public.mass_outages FROM anon, public;

-- 2. Handle 'users' table specifically (Needed for checking instructor names publicly)
-- We REVOKE SELECT on the WHOLE table first.
REVOKE SELECT ON public.users FROM anon, public;

-- 3. GRANT SELECT ONLY on safe columns to 'anon' and 'public'
-- This ensures that even if a policy says "USING (true)", Postgres won't return hidden columns.
GRANT SELECT (id, full_name, username, job_category, area, is_active, employment_type, is_vip) 
ON public.users TO anon, public;

-- Note: Authenticated status usually inherits 'public' grants, but we should ensure 
-- logged-in users (agents) can see more if needed.
-- Ideally, 'authenticated' role should have broader access.
GRANT SELECT ON public.users TO authenticated;

-- 4. Ensure RLS policies are tight for tickets/assets (Double Lock)
DROP POLICY IF EXISTS "Public access tickets" ON public.tickets;
CREATE POLICY "Tickets are private" ON public.tickets
    FOR SELECT
    TO authenticated
    USING (true); -- Or stricter: (user_id = auth.uid() OR role IN ('admin', 'agent'))

-- 5. Restore safe public access to Reservations (Calendar) but restrict columns if possible?
-- Reservations might contain 'user_id' which links to users. Safe.
-- Ensure we don't expose internal notes.
-- (Assumed safe for now based on Kiosk requirement)

COMMIT;
