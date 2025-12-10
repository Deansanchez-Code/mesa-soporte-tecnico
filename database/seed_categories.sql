-- Seed: Ticket Classification Configuration

-- 1. Create Configuration Table
CREATE TABLE IF NOT EXISTS public.ticket_categories_config (
    id SERIAL PRIMARY KEY,
    user_selection_text TEXT NOT NULL UNIQUE, -- What user sees: "Internet lento"
    internal_type ticket_type_enum NOT NULL, -- INC or REQ
    priority_level TEXT DEFAULT 'medium', -- high, medium, low
    sla_hours_std INT DEFAULT 24, -- Standard SLA
    sla_hours_vip INT DEFAULT 12, -- VIP SLA
    is_active BOOLEAN DEFAULT true
);

-- 2. Populate Reference Data (The "Black Box")
INSERT INTO public.ticket_categories_config 
(user_selection_text, internal_type, priority_level, sla_hours_std, sla_hours_vip) VALUES 
('Hardware: Equipo no enciende', 'INC', 'high', 4, 2),
('Hardware: Pantalla/Monitor falla', 'INC', 'medium', 8, 4),
('Hardware: Periféricos (Mouse/Teclado)', 'REQ', 'low', 48, 24), -- Pedir cambio es un REQ
('Software: Internet lento o caído', 'INC', 'high', 4, 2),
('Software: Error en aplicación', 'INC', 'medium', 8, 4),
('Software: Instalar Programa', 'REQ', 'medium', 24, 12),
('Software: Permisos de Carpeta/Red', 'REQ', 'medium', 24, 12),
('Solicitud: Equipo Nuevo', 'REQ', 'low', 72, 48),
('Solicitud: Préstamo Auditorio', 'REQ', 'low', 24, 12)
ON CONFLICT (user_selection_text) DO UPDATE SET
internal_type = EXCLUDED.internal_type,
sla_hours_std = EXCLUDED.sla_hours_std,
sla_hours_vip = EXCLUDED.sla_hours_vip;
