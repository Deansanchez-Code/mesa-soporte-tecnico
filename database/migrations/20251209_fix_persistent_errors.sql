-- FIX PERSISTENT RLS ISSUES

-- 1. FIX USERS TABLE RLS (Resolves 406 Error on VIP check)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for own user" ON users;
CREATE POLICY "Enable read access for own user"
ON users FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- 2. FIX RESERVATIONS RLS (Resolves 401 Error on Insert)
-- Ensure we drop the old one first to avoid conflicts
DROP POLICY IF EXISTS "Enable insert for authenticated users on reservations" ON reservations;

CREATE POLICY "Enable insert for authenticated users on reservations"
ON reservations FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
);

-- Ensure Update is also correct
DROP POLICY IF EXISTS "Enable update for users on own reservations" ON reservations;
CREATE POLICY "Enable update for users on own reservations"
ON reservations FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- 3. VERIFY TICKETS RLS (Just in case)
DROP POLICY IF EXISTS "Enable insert for authenticated users on tickets" ON tickets;
CREATE POLICY "Enable insert for authenticated users on tickets"
ON tickets FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
