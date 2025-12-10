-- AUDIT FIXES MIGRATION
-- Purpose: Resolve schema mismatches between Frontend and Backend, and improve RLS policies.

-- 1. RESERVATIONS TABLE FIXES
-- Frontend sends 'auditorium_id' and 'resources', but they were missing.
DO $$ 
BEGIN 
    -- Add auditorium_id if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'auditorium_id') THEN
        ALTER TABLE public.reservations ADD COLUMN auditorium_id TEXT;
    END IF;

    -- Add resources if missing (storing as Text Array)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'resources') THEN
        ALTER TABLE public.reservations ADD COLUMN resources TEXT[];
    END IF;
END $$;

-- 2. TICKETS TABLE FIXES
-- Frontend UserRequestForm sends 'asset_serial', ensure it exists.
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'asset_serial') THEN
        ALTER TABLE public.tickets ADD COLUMN asset_serial TEXT;
    END IF;
END $$;

-- 3. IMPROVE RESERVATIONS RLS
-- Existing policy for UPDATE might exclude superadmin/staff in some versions.
-- Re-defining "Gestionar reserva" to be explicit.

DROP POLICY IF EXISTS "Dueño o Admin puede actualizar" ON public.reservations;
DROP POLICY IF EXISTS "Gestionar reserva (Dueño o Admin)" ON public.reservations;

CREATE POLICY "Gestionar reserva (Dueño, Admin, Superadmin)" 
ON public.reservations 
FOR ALL 
TO authenticated 
USING (
    auth.uid() = user_id OR 
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'superadmin', 'agent') -- Expanded roles for management
    )
);

-- 4. IMPROVE TICKETS RLS (Ensure agents can view/edit all)
DROP POLICY IF EXISTS "Ver tickets (Propio o Staff)" ON public.tickets;
CREATE POLICY "Ver tickets (Propio o Staff)" 
ON public.tickets 
FOR SELECT 
TO authenticated 
USING (
    user_id = auth.uid() OR 
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'agent', 'superadmin')
    )
);

DROP POLICY IF EXISTS "Editar tickets (Staff)" ON public.tickets;
CREATE POLICY "Editar tickets (Staff)" 
ON public.tickets 
FOR UPDATE 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'agent', 'superadmin')
    )
);
