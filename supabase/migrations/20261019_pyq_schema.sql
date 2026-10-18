-- Supabase Migration: PYQ Schema, RLS & Storage Buckets
-- Per docs/ARCHITECTURE.md section 4 (PYQ) & docs/DATA_SOURCES.md

CREATE TABLE IF NOT EXISTS public.pyq_papers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school TEXT NOT NULL,
    programme_code TEXT NOT NULL,
    semester TEXT NOT NULL,
    subject_code TEXT NOT NULL,
    subject_name TEXT NOT NULL,
    year INT NOT NULL,
    exam_type TEXT NOT NULL CHECK (exam_type IN ('Mid Sem', 'End Sem', 'Back Paper')),
    file_path TEXT NOT NULL,
    file_size_bytes BIGINT,
    uploader_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    downloads INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexing for fast search and hierarchical browse flow
CREATE INDEX IF NOT EXISTS idx_pyq_browse ON public.pyq_papers(school, programme_code, semester);
CREATE INDEX IF NOT EXISTS idx_pyq_subject ON public.pyq_papers(subject_code, year);
CREATE INDEX IF NOT EXISTS idx_pyq_status ON public.pyq_papers(status);

-- Enable Row Level Security (RLS)
ALTER TABLE public.pyq_papers ENABLE ROW LEVEL SECURITY;

-- Policy 1: Anyone can view approved question papers
CREATE POLICY "Public read for approved PYQs" 
ON public.pyq_papers FOR SELECT 
USING (status = 'approved');

-- Policy 2: Authenticated students can upload papers (status defaults to pending)
CREATE POLICY "Authenticated users can insert PYQs" 
ON public.pyq_papers FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = uploader_id AND status = 'pending');

-- Policy 3: Uploaders can see their own pending papers
CREATE POLICY "Uploaders can view their own pending papers" 
ON public.pyq_papers FOR SELECT 
TO authenticated 
USING (auth.uid() = uploader_id);

-- Policy 4: Reports table for copyright or incorrect papers
CREATE TABLE IF NOT EXISTS public.pyq_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_id UUID REFERENCES public.pyq_papers(id) ON DELETE CASCADE,
    reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.pyq_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can report a paper" ON public.pyq_reports FOR INSERT WITH CHECK (true);

-- Storage buckets setup
INSERT INTO storage.buckets (id, name, public) 
VALUES ('pyq', 'pyq', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('pyq-pending', 'pyq-pending', false)
ON CONFLICT (id) DO NOTHING;
