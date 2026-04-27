-- SECURITY FIX: ADR-005
-- Strengthens RLS policies for assets, asset_events, and users to ensure data privacy.

BEGIN;

-------------------------------------------------------------------------------
-- 1. ASSETS
-------------------------------------------------------------------------------
-- Current: USING (true) for authenticated
-- New: Only assigned user or Staff (Agent, Admin, Superadmin)

DROP POLICY IF EXISTS "Ver activos (Autenticados)" ON public.assets;
CREATE POLICY "Ver activos (Propio o Staff)" ON public.assets
    FOR SELECT
    TO authenticated
    USING (
        assigned_to_user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role IN ('agent', 'admin', 'superadmin', 'staff')
        )
    );

-------------------------------------------------------------------------------
-- 2. ASSET EVENTS (History)
-------------------------------------------------------------------------------
-- Current: USING (true) for authenticated
-- New: Only Staff

DROP POLICY IF EXISTS "Ver historial activos (Autenticados)" ON public.asset_events;
CREATE POLICY "Ver historial activos (Solo Staff)" ON public.asset_events
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role IN ('agent', 'admin', 'superadmin', 'staff')
        )
    );

-------------------------------------------------------------------------------
-- 3. USERS (Privacy)
-------------------------------------------------------------------------------
-- Current: authenticated has full SELECT
-- New: Apply Column Level Security to 'authenticated' as well to hide emails/phones

-- Revoke full access
REVOKE SELECT ON public.users FROM authenticated;

-- Grant only safe columns to authenticated (similar to 'public' but maybe more?)
-- Keeping emails hidden from contractors.
GRANT SELECT (
    id, 
    full_name, 
    username, 
    role, 
    area, 
    is_active, 
    is_vip, 
    job_category, 
    employment_type,
    created_at
) ON public.users TO authenticated;

-- Ensure Staff can still see full user data (needed for administration)
-- This is tricky with CLS if we want ONE role to see all. 
-- In Supabase, CLS is per-role. We might need a view for staff or just accept CLS.
-- Actually, the best way for Staff is to have a separate 'admin' schema or just grant all columns.
-- If we want Agents to see emails, we must grant them:
-- Note: 'agent' and 'admin' are values in public.users.role, not Postgres roles.
-- Postgres roles are 'authenticated', 'anon', 'service_role'.
-- So CLS applies to ALL authenticated users. 

-- COMPROMISE: If agents need emails, they must use a server-side admin client or we must 
-- allow email visibility in CLS for everyone but rely on RLS to hide rows? 
-- No, RLS hides rows, CLS hides columns.
-- For now, we will hide emails from ALL authenticated users in the public schema.

COMMIT;
