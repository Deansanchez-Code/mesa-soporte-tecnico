-- Create storage buckets if they don't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('ticket_evidence', 'ticket_evidence', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public)
VALUES ('kb_documents', 'kb_documents', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public)
VALUES (
        'asset-authorizations',
        'asset-authorizations',
        true
    ) ON CONFLICT (id) DO NOTHING;
-- Set up storage policies for public access (Read)
CREATE POLICY "Public Access" ON storage.objects FOR
SELECT USING (
        bucket_id IN (
            'ticket_evidence',
            'kb_documents',
            'asset-authorizations'
        )
    );
-- Set up storage policies for authenticated uploads
CREATE POLICY "Authenticated Upload" ON storage.objects FOR
INSERT WITH CHECK (
        bucket_id IN (
            'ticket_evidence',
            'kb_documents',
            'asset-authorizations'
        )
        AND auth.role() = 'authenticated'
    );