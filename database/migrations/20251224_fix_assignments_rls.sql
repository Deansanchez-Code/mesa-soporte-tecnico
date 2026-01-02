-- FIX: Ensure instructor_assignments are readable by ALL authenticated users
-- regardless of their coordinator permissions. 

-- 1. Ensure RLS is active
ALTER TABLE public.instructor_assignments ENABLE ROW LEVEL SECURITY;

-- 2. Drop any overlapping/confusing select policies
DROP POLICY IF EXISTS "Read access for all authenticated users" ON public.instructor_assignments;
DROP POLICY IF EXISTS "Select for everyone" ON public.instructor_assignments;

-- 3. Create a clean, simple SELECT policy for EVERYONE (including anonymous users on kiosk)
CREATE POLICY "Read access for everyone" ON public.instructor_assignments
    FOR SELECT
    USING (true);

-- 4. Ensure authorized coordinators can still write
DROP POLICY IF EXISTS "Write access for authorized coordinators" ON public.instructor_assignments;
CREATE POLICY "Write access for authorized coordinators" ON public.instructor_assignments
    FOR ALL 
    TO authenticated
    USING (
        EXISTS ( 
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND public.users.perm_manage_assignments = TRUE
        )
    )
    WITH CHECK (
        EXISTS ( 
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND public.users.perm_manage_assignments = TRUE
        )
    );
