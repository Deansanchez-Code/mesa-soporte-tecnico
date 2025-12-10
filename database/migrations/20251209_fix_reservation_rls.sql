-- Enable RLS
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE mass_outages ENABLE ROW LEVEL SECURITY;

-- 1. Reservations Policies
DROP POLICY IF EXISTS "Enable read access for authenticated users on reservations" ON reservations;
CREATE POLICY "Enable read access for authenticated users on reservations" ON reservations FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Enable insert for authenticated users on reservations" ON reservations;
CREATE POLICY "Enable insert for authenticated users on reservations" ON reservations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Enable update for users on own reservations" ON reservations;
CREATE POLICY "Enable update for users on own reservations" ON reservations FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- 2. Tickets Policies
DROP POLICY IF EXISTS "Enable insert for authenticated users on tickets" ON tickets;
CREATE POLICY "Enable insert for authenticated users on tickets" ON tickets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Enable read access for users on own tickets" ON tickets;
CREATE POLICY "Enable read access for users on own tickets" ON tickets FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 3. Mass Outages Policies
DROP POLICY IF EXISTS "Enable read access for all on mass_outages" ON mass_outages;
CREATE POLICY "Enable read access for all on mass_outages" ON mass_outages FOR SELECT TO authenticated, anon USING (is_active = true);

-- 4. Assets Policies
DROP POLICY IF EXISTS "Enable read access for users on assigned assets" ON assets;
CREATE POLICY "Enable read access for users on assigned assets" ON assets FOR SELECT TO authenticated USING (assigned_to_user_id = auth.uid());

DROP POLICY IF EXISTS "Enable search access for authenticated users on assets" ON assets;
CREATE POLICY "Enable search access for authenticated users on assets" ON assets FOR SELECT TO authenticated USING (true);
