-- Add RLS policy for VIPs and Admins to update reservations
BEGIN;
-- Policy: VIP and Admins can update any reservation
-- This allows VIPs and Admins to update (including cancel) reservations created by others.
-- The check ensures the user has is_vip=true OR is 'admin'/'superadmin'.
CREATE POLICY "VIP and Admins can update any reservation" ON public.reservations FOR
UPDATE TO authenticated USING (
        EXISTS (
            SELECT 1
            FROM public.users
            WHERE users.auth_id = auth.uid()
                AND (
                    users.is_vip = true
                    OR users.role IN ('admin', 'superadmin', 'vip')
                )
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.users
            WHERE users.auth_id = auth.uid()
                AND (
                    users.is_vip = true
                    OR users.role IN ('admin', 'superadmin', 'vip')
                )
        )
    );
COMMIT;