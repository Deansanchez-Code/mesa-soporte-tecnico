-- SQL Script to Purge/Cleanup user 'jcamilo' to allow clean recreation
-- Run this in the Supabase SQL Editor

-- 0. Identify target ID (Optional verification)
-- SELECT id FROM public.users WHERE username = 'jcamilo';

-- 1. Handle Dependencies (Tickets, Assignments, etc.)
-- We set 'agent_id' to NULL for tickets assigned to this user to avoid deleting the tickets themselves.
UPDATE public.tickets 
SET assigned_agent_id = NULL 
WHERE assigned_agent_id IN (SELECT id FROM public.users WHERE username = 'jcamilo' OR email LIKE 'jcamilo%');

UPDATE public.tickets 
SET user_id = NULL 
WHERE user_id IN (SELECT id FROM public.users WHERE username = 'jcamilo' OR email LIKE 'jcamilo%');

-- (Optional) If you want to delete assets/history created by him:
-- DELETE FROM public.assets WHERE created_by = ... 
-- But usually better to keep or set NULL.

-- 2. DELETE from public.users FIRST (Child table)
DELETE FROM public.users 
WHERE username = 'jcamilo' 
   OR email = 'jcamilo@sistema.local'
   OR email = 'jcamilo@test.com';

-- 3. DELETE from auth.users LAST (Parent table)
DELETE FROM auth.users 
WHERE email = 'jcamilo@sistema.local' 
   OR email = 'jcamilo@test.com';

-- 4. Check results (Should be empty)
SELECT ' Remaining Public Users:' as label, count(*) FROM public.users WHERE username = 'jcamilo';
SELECT ' Remaining Auth Users:' as label, count(*) FROM auth.users WHERE email LIKE 'jcamilo%';
