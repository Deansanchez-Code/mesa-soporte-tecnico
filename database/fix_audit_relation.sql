-- 1. Create Foreign Key
ALTER TABLE IF EXISTS public.audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_actor_id_fkey;

ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_actor_id_fkey
  FOREIGN KEY (actor_id)
  REFERENCES public.users(id)
  ON UPDATE CASCADE
  ON DELETE SET NULL;

-- 2. Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 3. Create Policy for Admins
DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.audit_logs;

CREATE POLICY "Admins can view all audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.auth_id = auth.uid() -- auth_id links to auth.users
    AND (users.role = 'admin' OR users.role = 'superadmin')
  )
);
