-- Migration: Create Pause Reasons Table

CREATE TABLE IF NOT EXISTS public.pause_reasons (
    id SERIAL PRIMARY KEY,
    reason_text TEXT NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed Initial Reasons
INSERT INTO public.pause_reasons (reason_text) VALUES 
('Esperando Información del Usuario'),
('Esperando Repuestos (Proveedores)'),
('Esperando Disponibilidad de Área'),
('Horario No Laboral'),
('Prioridad Reasignada')
ON CONFLICT (reason_text) DO NOTHING;
