-- 1. Add permission to users (safe if already exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'perm_manage_assignments') THEN
        ALTER TABLE users ADD COLUMN perm_manage_assignments BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- 2. Create environments table
CREATE TABLE IF NOT EXISTS environments (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT, -- 'AUDITORIO', 'SALA_INFORMATICA', 'LABORATORIO', etc.
    capacity INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for environments
ALTER TABLE environments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read access for all authenticated users" ON environments;
CREATE POLICY "Read access for all authenticated users" ON environments
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Write access for admins" ON environments;
CREATE POLICY "Write access for admins" ON environments
    FOR ALL USING (
         EXISTS ( SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'superadmin') )
    );


-- 3. Create instructor_assignments table
CREATE TABLE IF NOT EXISTS instructor_assignments (
    id SERIAL PRIMARY KEY,
    instructor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    environment_id INTEGER NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
    assignment_date DATE NOT NULL,
    time_block TEXT NOT NULL CHECK (time_block IN ('MANANA', 'TARDE', 'NOCHE')),
    assigned_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(environment_id, assignment_date, time_block) -- Prevent double booking
);

-- RLS for instructor_assignments
ALTER TABLE instructor_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read access for all authenticated users" ON instructor_assignments;
CREATE POLICY "Read access for all authenticated users" ON instructor_assignments
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Write access for coordinators and admins" ON instructor_assignments;
CREATE POLICY "Write access for coordinators and admins" ON instructor_assignments
    FOR ALL USING (
        EXISTS ( 
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND (role IN ('admin', 'superadmin') OR perm_manage_assignments = TRUE)
        )
    );
