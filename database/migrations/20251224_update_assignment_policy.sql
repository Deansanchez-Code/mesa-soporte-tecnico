-- Update RLS for instructor_assignments to STRICTLY respect perm_manage_assignments
-- The superadmin/admin role alone is NO LONGER sufficient for write access, 
-- unless they grant themselves the permission (which they can do via admin panel).

DROP POLICY IF EXISTS "Write access for coordinators and admins" ON instructor_assignments;

CREATE POLICY "Write access for authorized coordinators" ON instructor_assignments
    FOR ALL USING (
        EXISTS ( 
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND perm_manage_assignments = TRUE
        )
    );
