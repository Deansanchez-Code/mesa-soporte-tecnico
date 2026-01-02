-- DATA REPAIR: Fix missing employment_type and job_category
-- This script assigns default values to users who have NULL in these fields
-- to ensure they appear in the dashboard filters.

BEGIN;

-- 1. Fix Instructors (Assume 'agent' role with null job_category are instructors basically, or at least 'funcionario')
-- Strategy: If role is 'agent', set 'employment_type'='contratista', 'job_category'='instructor'
-- This is an assumption to recover data visibility.

UPDATE public.users
SET 
  employment_type = 'contratista',
  job_category = 'instructor',
  updated_at = now()
WHERE role = 'agent' 
  AND (employment_type IS NULL OR job_category IS NULL);

-- 2. Fix Admins/Superadmins (Assume 'planta' / 'funcionario')
UPDATE public.users
SET 
  employment_type = 'planta',
  job_category = 'funcionario',
  updated_at = now()
WHERE role IN ('admin', 'superadmin')
  AND (employment_type IS NULL OR job_category IS NULL);

-- 3. Fix generic 'user' role
UPDATE public.users
SET 
  employment_type = 'contratista',
  job_category = 'funcionario',
  updated_at = now()
WHERE role = 'user'
  AND (employment_type IS NULL OR job_category IS NULL);

COMMIT;
