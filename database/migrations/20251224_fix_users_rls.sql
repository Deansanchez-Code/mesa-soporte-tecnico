-- Enable RLS (idempotent)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view the user list (needed for dropdowns)
DROP POLICY IF EXISTS "Read access for all authenticated users" ON users;

CREATE POLICY "Read access for all authenticated users" ON users
    FOR SELECT
    TO authenticated
    USING (true);
