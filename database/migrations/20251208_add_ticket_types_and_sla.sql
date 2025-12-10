-- Migration: Add Ticket Types, SLA Columns, and Sequences

-- 1. Create Enums
DO $$ BEGIN
    CREATE TYPE ticket_type_enum AS ENUM ('INC', 'REQ');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE sla_status_enum AS ENUM ('running', 'paused', 'breached', 'completed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create Sequences for Independent Numbering
CREATE SEQUENCE IF NOT EXISTS seq_inc START 1;
CREATE SEQUENCE IF NOT EXISTS seq_req START 1;

-- 3. Add Columns to tickets table
ALTER TABLE public.tickets
ADD COLUMN IF NOT EXISTS ticket_type ticket_type_enum,
ADD COLUMN IF NOT EXISTS ticket_code TEXT, -- INC-001, REQ-001
ADD COLUMN IF NOT EXISTS sla_status sla_status_enum DEFAULT 'running',
ADD COLUMN IF NOT EXISTS sla_start_at TIMESTAMPTZ DEFAULT now(),
ADD COLUMN IF NOT EXISTS sla_expected_end_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS sla_total_paused_duration INTERVAL DEFAULT '0 seconds',
ADD COLUMN IF NOT EXISTS sla_last_paused_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS sla_pause_reason TEXT,
ADD COLUMN IF NOT EXISTS is_vip_ticket BOOLEAN DEFAULT false;

-- 4. Index for performance
CREATE INDEX IF NOT EXISTS idx_tickets_ticket_code ON public.tickets(ticket_code);
CREATE INDEX IF NOT EXISTS idx_tickets_sla_status ON public.tickets(sla_status);
