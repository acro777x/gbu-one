-- Supabase Migration: Campus Events ("What's On") Schema & RLS
-- Allows university clubs and departments to publish campus events, workshops,
-- hackathons, cultural nights, placement drives, and sports tournaments.

CREATE TABLE IF NOT EXISTS public.campus_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'other',
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ,
    venue TEXT NOT NULL DEFAULT '',
    is_free BOOLEAN NOT NULL DEFAULT true,
    registration_required BOOLEAN NOT NULL DEFAULT false,
    registration_url TEXT,
    image_url TEXT,
    audience JSONB NOT NULL DEFAULT '["all"]'::jsonb,
    source TEXT NOT NULL DEFAULT 'admin',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indices for filtering by start date and category
CREATE INDEX IF NOT EXISTS idx_campus_events_start ON public.campus_events(start_date);
CREATE INDEX IF NOT EXISTS idx_campus_events_category ON public.campus_events(category);

-- Enable Row Level Security (RLS)
ALTER TABLE public.campus_events ENABLE ROW LEVEL SECURITY;

-- Policy 1: Public read access for everyone
DROP POLICY IF EXISTS "Public read for campus events" ON public.campus_events;
CREATE POLICY "Public read for campus events"
ON public.campus_events FOR SELECT
TO anon, authenticated
USING (true);

-- Policy 2: Moderators/admin can insert and manage events
DROP POLICY IF EXISTS "Moderator write for campus events" ON public.campus_events;
CREATE POLICY "Moderator write for campus events"
ON public.campus_events FOR ALL
TO authenticated
USING (public.is_moderator())
WITH CHECK (public.is_moderator());
