-- SECURE CALENDAR DATA (Column Level Security)
-- This migration restricts 'SELECT *' permissions for anonymous users
-- allowing access ONLY to the columns required for the Public Calendar/Kiosk.

BEGIN;

-------------------------------------------------------------------------------
-- 1. AREAS
-------------------------------------------------------------------------------
REVOKE SELECT ON public.areas FROM anon, public;
-- Only expose essential info for dropdowns/labels
GRANT SELECT (id, name) ON public.areas TO anon, public;
GRANT SELECT ON public.areas TO authenticated;

-------------------------------------------------------------------------------
-- 2. INSTRUCTOR ASSIGNMENTS
-------------------------------------------------------------------------------
REVOKE SELECT ON public.instructor_assignments FROM anon, public;
-- Expose schedule info, hiding generic system metadata if any
GRANT SELECT (id, instructor_id, area_id, assignment_date, time_block) 
ON public.instructor_assignments TO anon, public;
GRANT SELECT ON public.instructor_assignments TO authenticated;

-------------------------------------------------------------------------------
-- 3. RESERVATIONS
-------------------------------------------------------------------------------
REVOKE SELECT ON public.reservations FROM anon, public;
-- Expose schedule info. 
-- 'user_id' is needed to fetch the user name/avatar (which is now CLS secured too).
-- 'title' is exposed (Ensure generic titles in frontend if sensitive).
GRANT SELECT (id, title, start_time, end_time, status, user_id, auditorium_id, resources) 
ON public.reservations TO anon, public;
GRANT SELECT ON public.reservations TO authenticated;

COMMIT;
