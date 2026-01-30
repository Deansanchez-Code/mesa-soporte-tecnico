-- Fix RLS policies for areas and categories to allow INSERT and include superadmin role
BEGIN;
-- 1. Fix areas policies
DROP POLICY IF EXISTS "Admins pueden gestionar areas" ON public.areas;
CREATE POLICY "Admins pueden gestionar areas" ON public.areas FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1
        FROM public.users
        WHERE users.auth_id = auth.uid()
            AND users.role IN ('admin', 'superadmin')
    )
) WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.users
        WHERE users.auth_id = auth.uid()
            AND users.role IN ('admin', 'superadmin')
    )
);
-- 2. Fix categories policies
DROP POLICY IF EXISTS "Admins pueden gestionar categorias" ON public.categories;
CREATE POLICY "Admins pueden gestionar categorias" ON public.categories FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1
        FROM public.users
        WHERE users.auth_id = auth.uid()
            AND users.role IN ('admin', 'superadmin')
    )
) WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.users
        WHERE users.auth_id = auth.uid()
            AND users.role IN ('admin', 'superadmin')
    )
);
-- 3. (Optional) Cleanup insecure anon policies if they are not needed for public kiosk
-- We'll keep them for now as they might be used by a kiosk mode we saw in other migrations,
-- but at least now authenticated admins/superadmins can actually work.
COMMIT;