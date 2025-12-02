-- MEJORAS ADMIN: TABLAS DE CONFIGURACIÓN
-- Este script crea las tablas para gestionar dinámicamente Categorías y Áreas.

-- 1. Tabla de Áreas
CREATE TABLE IF NOT EXISTS public.areas (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insertar áreas por defecto
INSERT INTO public.areas (name) VALUES 
('Mesa de Ayuda'),
('Desarrollo'),
('Infraestructura'),
('Administrativa'),
('Comercial')
ON CONFLICT (name) DO NOTHING;

-- 2. Tabla de Categorías
CREATE TABLE IF NOT EXISTS public.categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insertar categorías por defecto
INSERT INTO public.categories (name) VALUES 
('HARDWARE'),
('SOFTWARE'),
('REDES'),
('OTROS')
ON CONFLICT (name) DO NOTHING;

-- 3. Habilitar permisos para 'anon' (necesario por el login personalizado)
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir lectura de areas a todos" ON public.areas FOR SELECT TO anon USING (true);
CREATE POLICY "Permitir todo en areas a todos" ON public.areas FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Permitir lectura de categorias a todos" ON public.categories FOR SELECT TO anon USING (true);
CREATE POLICY "Permitir todo en categorias a todos" ON public.categories FOR ALL TO anon USING (true) WITH CHECK (true);
