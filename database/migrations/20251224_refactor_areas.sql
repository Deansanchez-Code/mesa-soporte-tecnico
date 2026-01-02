-- Refactor to use AREAS instead of ENVIRONMENTS

-- 1. Drop the old environments table and assignments
DROP TABLE IF EXISTS instructor_assignments CASCADE;
DROP TABLE IF EXISTS environments CASCADE;
-- Note: 'areas' table already exists and holds the environment data.

-- 2. Recreate instructor_assignments referencing areas
CREATE TABLE IF NOT EXISTS instructor_assignments (
    id SERIAL PRIMARY KEY,
    instructor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    area_id INTEGER NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
    assignment_date DATE NOT NULL,
    time_block TEXT NOT NULL CHECK (time_block IN ('MANANA', 'TARDE', 'NOCHE')),
    assigned_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(area_id, assignment_date, time_block) -- Prevent double booking per area
);

-- 3. RLS Policies
ALTER TABLE instructor_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read access for all authenticated users" ON instructor_assignments;
CREATE POLICY "Read access for all authenticated users" ON instructor_assignments
    FOR SELECT USING (auth.role() = 'authenticated');

-- Coordinator write access (Strict)
DROP POLICY IF EXISTS "Write access for authorized coordinators" ON instructor_assignments;
CREATE POLICY "Write access for authorized coordinators" ON instructor_assignments
    FOR ALL USING (
        EXISTS ( 
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND perm_manage_assignments = TRUE
        )
    );
