-- Migration: Fix Knowledge Base Relations
-- Date: 2026-02-05
-- Description: Adds a proper foreign key relationship between knowledge_articles and public.users 
-- to allow the API to join correctly.
-- 1. Ensure the created_by column exists and is UUID
-- (It should already exist from the initial migration, but we make sure)
-- The initial migration defined it as: created_by UUID REFERENCES auth.users(id)
-- 2. Add foreign key to public.users
-- This allows PostgREST (Supabase API) to understand the relationship name knowledge_articles_created_by_fkey
ALTER TABLE public.knowledge_articles DROP CONSTRAINT IF EXISTS knowledge_articles_created_by_fkey;
ALTER TABLE public.knowledge_articles
ADD CONSTRAINT knowledge_articles_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE
SET NULL;
-- 3. Verify RLS (It was already defined in the initial migration, but we ensure it works with the new relationship)
-- The existing policies use public.users so they should be fine.