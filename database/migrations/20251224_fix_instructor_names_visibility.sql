-- FIX: Allow public visibility of basic user data (needed for Calendar/Kiosk)
-- This allows anyone (including non-logged in users) to see full_name and id
-- which resolves the "Desconocido" issue in the calendar.

-- 1. Update public.users policy
DROP POLICY IF EXISTS "Leer usuarios (Autenticados)" ON public.users;
CREATE POLICY "Public read access for user names" ON public.users
    FOR SELECT
    USING (true); -- This allows anon to see names. 

-- 2. Ensure areas are also public (already worked, but making it explicit for consistency)
DROP POLICY IF EXISTS "Ver áreas (Autenticados)" ON public.areas;
CREATE POLICY "Public read access for areas" ON public.areas
    FOR SELECT
    USING (true);

-- 3. Confirm instructor_assignments is also truly open
DROP POLICY IF EXISTS "Read access for everyone" ON public.instructor_assignments;
CREATE POLICY "Read access for everyone" ON public.instructor_assignments
    FOR SELECT
    USING (true);
