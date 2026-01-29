-- SQL Migration: Add Performance Indexes
-- Reservations Table
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations (status);
CREATE INDEX IF NOT EXISTS idx_reservations_start_time ON reservations (start_time);
CREATE INDEX IF NOT EXISTS idx_reservations_user_id ON reservations (user_id);
-- Tickets Table
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets (status);
CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON tickets (user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_agent_id ON tickets (assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_is_vip ON tickets (is_vip_ticket)
WHERE is_vip_ticket = true;
-- Users Table (Optional if search is common)
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users (auth_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);