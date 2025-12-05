
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS employment_type TEXT DEFAULT 'planta';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS job_category TEXT DEFAULT 'funcionario';

-- Add check constraints to enforce values (optional but good practice)
-- ALTER TABLE public.users ADD CONSTRAINT check_employment_type CHECK (employment_type IN ('planta', 'contratista'));
-- ALTER TABLE public.users ADD CONSTRAINT check_job_category CHECK (job_category IN ('instructor', 'funcionario'));
