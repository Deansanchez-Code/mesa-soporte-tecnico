-- STRICT PURGE: PRESERVE ONLY 'DEANSAN' + CONFIG DATA
-- This script deletes ALL users except those matching 'deansan' (case insensitive).
-- Areas and Categories are NOT touched (preserved).

BEGIN;

-- 0. PRE-CLEANUP: Handle dependencies for users to be deleted
-- Identify users to keep (Deansan) to avoid accidental deletion
-- We delete data linked to users NOT matching 'deansan'

-- A. Unassign Assets
UPDATE public.assets 
SET assigned_to_user_id = NULL 
WHERE assigned_to_user_id IN (
    SELECT id FROM public.users WHERE email NOT ILIKE '%deansan%'
);

-- B. Delete Assignments
DELETE FROM public.instructor_assignments
WHERE instructor_id IN (
    SELECT id FROM public.users WHERE email NOT ILIKE '%deansan%'
);

-- C. Delete Tickets (or set to NULL if you prefer keeping history, but for purge we delete)
DELETE FROM public.tickets
WHERE user_id IN (
    SELECT id FROM public.users WHERE email NOT ILIKE '%deansan%'
) OR assigned_agent_id IN (
    SELECT id FROM public.users WHERE email NOT ILIKE '%deansan%'
);

-- D. Delete Ticket Events / Asset Events if they reference users (Optional, usually cascade or ignored)
-- Assuming loose coupling or cascade, but let's be safe if they exist.

-- 1. DELETE ALL USERS Except Deansan
DELETE FROM public.users 
WHERE email NOT ILIKE '%deansan%' 
  AND role != 'service_role'; -- Safety check

-- 2. ENSURE DEANSAN IS SUPERADMIN
UPDATE public.users
SET 
    role = 'superadmin',
    employment_type = 'planta',
    job_category = 'funcionario',
    is_active = true,
    perm_manage_assignments = true
WHERE email ILIKE '%deansan%';

-- 3. (Optional) SEED FRESH TEST DATA?
-- If you want to start empty, stop here.
-- If you want fresh test users, uncomment below:

/*
-- Insert placeholder users (Note: these won't have Auth login unless created in Supabase Auth panel)
INSERT INTO public.users (id, email, full_name, role, employment_type, job_category, is_active)
VALUES 
 (gen_random_uuid(), 'instructor1@test.com', 'Instructor Test 1', 'agent', 'contratista', 'instructor', true),
 (gen_random_uuid(), 'funcionario1@test.com', 'Funcionario Test 1', 'agent', 'planta', 'funcionario', true);
*/

COMMIT;
