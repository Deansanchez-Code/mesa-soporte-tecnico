
-- Migration: Create Knowledge Base (Repositorio de Soporte)
-- Date: 2026-01-02
-- Description: Creates table for solutions and storage bucket for manuals.

-- 1. Create Table
CREATE TABLE IF NOT EXISTS public.knowledge_articles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('Hardware', 'Software', 'Otro')),
    problem_type TEXT NOT NULL,
    solution TEXT NOT NULL, -- Rich text / Markdown
    file_urls TEXT[], -- Array of URLs for attached files
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE public.knowledge_articles ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
-- VISIBILITY: STRICT (Only Agents, Admins, Superadmins)
CREATE POLICY "Staff can view knowledge articles"
ON public.knowledge_articles
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.role IN ('agent', 'admin', 'superadmin')
    )
);

-- WRITABILITY: STRICT (Only Agents, Admins, Superadmins)
CREATE POLICY "Staff can insert knowledge articles"
ON public.knowledge_articles
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.role IN ('agent', 'admin', 'superadmin')
    )
);

CREATE POLICY "Staff can update knowledge articles"
ON public.knowledge_articles
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.role IN ('agent', 'admin', 'superadmin')
    )
);

CREATE POLICY "Staff can delete knowledge articles"
ON public.knowledge_articles
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.role IN ('agent', 'admin', 'superadmin')
    )
);

-- 4. Storage Bucket Setup
-- We need to insert into storage.buckets if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('kb_documents', 'kb_documents', true) -- Public true allowing signed URL generation easier, but RLS protects
ON CONFLICT (id) DO NOTHING;

-- Storage RLS
-- READ: Staff only
CREATE POLICY "Staff can read kb documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'kb_documents'
    AND EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.role IN ('agent', 'admin', 'superadmin')
    )
);

-- UPLOAD: Staff only
CREATE POLICY "Staff can upload kb documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'kb_documents'
    AND EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.role IN ('agent', 'admin', 'superadmin')
    )
);

-- UPDATE/DELETE: Staff only
CREATE POLICY "Staff can update kb documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'kb_documents'
    AND EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.role IN ('agent', 'admin', 'superadmin')
    )
);

CREATE POLICY "Staff can delete kb documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'kb_documents'
    AND EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.role IN ('agent', 'admin', 'superadmin')
    )
);
