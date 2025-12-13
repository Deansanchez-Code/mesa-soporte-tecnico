-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL, -- e.g., 'LOGIN', 'CREATE_TICKET', 'UPDATE_STATUS'
    resource TEXT, -- e.g., 'tickets', 'assets'
    resource_id TEXT, -- ID of the resource
    details JSONB, -- Previous vs New values, or just generic info
    ip_address TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- RLS Policies
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only Admins and Superadmins can VIEW logs
CREATE POLICY "Admins can view all audit logs" ON audit_logs
    FOR SELECT
    USING (
        auth.uid() IN (
            SELECT id FROM public.users 
            WHERE role IN ('admin', 'superadmin')
        )
    );

-- Authenticated users (including agents) can INSERT logs (e.g. self-actions)
CREATE POLICY "Users can insert audit logs" ON audit_logs
    FOR INSERT
    WITH CHECK (auth.uid() = actor_id);

-- Optional: Superadmin bypass if needed, but existing policy covers it via role check.
