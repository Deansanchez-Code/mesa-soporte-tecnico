-- FIX RLS FOR SUPERADMIN
-- Ensures that users with role 'superadmin' ALWAYS have write access to assignments,
-- regardless of the 'perm_manage_assignments' flag (though we usually set both).

BEGIN;

-- 1. Drop existing policies on instructor_assignments to be safe
DROP POLICY IF EXISTS "Write access for authorized coordinators" ON instructor_assignments;
DROP POLICY IF EXISTS "Write access for coordinators and admins" ON instructor_assignments;
DROP POLICY IF EXISTS "Enable insert for authenticated users with permissions" ON instructor_assignments;

-- 2. Create COMPREHENSIVE Write Policy
CREATE POLICY "Manage assignments for Superadmins and Coordinators" ON instructor_assignments
    FOR ALL 
    USING (
        EXISTS ( 
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND (
                role = 'superadmin' 
                OR perm_manage_assignments = TRUE
            )
        )
    );

-- 3. Ensure 'users' table is readable by everyone (authenticated) so dashboard works
DROP POLICY IF EXISTS "Enable read access for all users" ON users;
DROP POLICY IF EXISTS "Read access for all authenticated users" ON users;

CREATE POLICY "Read access for all authenticated users" ON users
    FOR SELECT
    USING ( auth.role() = 'authenticated' );

-- 4. Allow Superadmins to update Users (to fix permissions via UI)
DROP POLICY IF EXISTS "Enable update for users based on email" ON users;
CREATE POLICY "Superadmins can update any user" ON users
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users WHERE id = auth.uid() AND role = 'superadmin'
        )
    );

COMMIT;
