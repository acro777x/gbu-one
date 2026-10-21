/**
 * GBU One — Supabase schema bootstrap SQL.
 * Applied once via the Supabase dashboard SQL editor (or `supabase db push`
 * if the CLI is linked). The worker's `supabaseClient.ts` also calls the
 * idempotent `ensureSchema()` guard: every table/index is created with
 * IF NOT EXISTS, so reruns are safe on a self-hosted / long-lived project.
 *
 * Decision log (owner-approved defaults, 2026-10-20):
 * - OCR provider: Tesseract (free, offline, no key) is the default worker
 *   path; a vision-model key (VISION_API_KEY + OCR_PROVIDER=vision) is an
 *   optional upgrade. See worker/ocrService.ts and OPEN_QUESTIONS #4.
 * - PYQ moderation: owner + trusted-student moderators via the `moderators`
 *   table below (email allowlist, role owner|moderator). Managed in the
 *   Supabase dashboard — no app code needed to add/remove. OPEN_QUESTIONS #5.
 */
export const SCHEMA_SQL = `
create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  source_id text not null unique,
  title text not null,
  clean_title text not null,
  posted_at timestamptz not null,
  file_url text not null default '',
  file_type text not null default 'pdf',
  raw_text text,
  category text not null default 'other',
  audience jsonb not null default '{}'::jsonb,
  importance integer not null default 0,
  deadline_at timestamptz,
  thread_id text,
  thread_update_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists notices_posted_at_idx on public.notices (posted_at desc);
create index if not exists notices_category_idx on public.notices (category);
create index if not exists notices_importance_idx on public.notices (importance desc);

-- Attachment extraction log. content_hash is the SHA-256 of the downloaded
-- bytes, so the same file is downloaded and OCR'd at most once even when it
-- is attached to several notices. notices.raw_text holds the extracted text.
create table if not exists public.notice_attachments (
  content_hash text primary key,
  source_id text not null,
  file_url text not null default '',
  file_name text not null default '',
  kind text not null default 'unknown',
  byte_size integer not null default 0,
  provider text not null default 'tesseract',
  is_scanned boolean not null default false,
  extracted_deadlines jsonb not null default '[]'::jsonb,
  raw_text_length integer not null default 0,
  processed_at timestamptz not null default now()
);
create index if not exists notice_attachments_source_idx
  on public.notice_attachments (source_id);

create table if not exists public.notice_threads (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  latest_notice_id uuid references public.notices (id) on delete set null,
  updates_count integer not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists public.timetable_snapshots (
  id uuid primary key default gen_random_uuid(),
  class_key text not null,
  hash text not null,
  payload jsonb not null,
  fetched_at timestamptz not null default now(),
  unique (class_key)
);

create table if not exists public.timetable_changes (
  id uuid primary key default gen_random_uuid(),
  class_key text not null,
  diff jsonb not null,
  detected_at timestamptz not null default now()
);
create index if not exists timetable_changes_class_idx
  on public.timetable_changes (class_key, detected_at desc);

-- Push dedupe for timetable changes: one push per deterministic change key
-- (class + session + diff signature). Written only after a successful send,
-- so a failed push is retried on the next worker run.
create table if not exists public.timetable_push_log (
  change_key text primary key,
  class_key text not null,
  semester_session_id text not null default '',
  recipients integer not null default 0,
  pushed_at timestamptz not null default now()
);
create index if not exists timetable_push_log_class_idx
  on public.timetable_push_log (class_key, pushed_at desc);

create table if not exists public.exam_datesheets (
  id uuid primary key default gen_random_uuid(),
  school text not null,
  programme_code text not null,
  semester text not null,
  file_url text not null,
  version integer not null default 1,
  posted_at timestamptz not null default now()
);

create table if not exists public.results (
  id uuid primary key default gen_random_uuid(),
  programme text not null,
  file_url text not null,
  posted_at timestamptz not null default now(),
  text_index_url text
);

-- The official academic calendar and the holiday list, as read from the
-- university's own documents. The event_key keeps the upsert idempotent.
create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  title text not null,
  date_from date not null,
  date_to date not null,
  type text not null default 'academic',
  semester text not null default '',
  source_url text not null default '',
  source text not null default '',
  updated_at timestamptz not null default now()
);

create index if not exists idx_calendar_events_from on public.calendar_events (date_from);

-- The end-semester date sheet, read from the per-school PDF the examination
-- portal publishes.
create table if not exists public.exam_date_slots (
  id uuid primary key default gen_random_uuid(),
  slot_key text not null unique,
  school_code text not null,
  programme text not null default '',
  exam_date date not null,
  slot text not null,
  subject_code text not null default '',
  subject_name text not null,
  is_back_paper boolean not null default false,
  source_url text not null default '',
  updated_at timestamptz not null default now()
);

create index if not exists idx_exam_date_slots_date on public.exam_date_slots (exam_date);

create table if not exists public.pyq_papers (
  id uuid primary key default gen_random_uuid(),
  school text not null,
  programme_code text not null default '',
  semester text not null,
  subject_code text not null,
  subject_name text not null,
  year integer not null,
  exam_type text not null default 'End Sem',
  file_path text not null,
  uploader_id uuid,
  status text not null default 'pending',
  downloads integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists pyq_papers_status_idx on public.pyq_papers (status);
create index if not exists pyq_papers_subject_idx
  on public.pyq_papers (programme_code, semester, subject_code, year, exam_type);

create table if not exists public.moderators (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  role text not null default 'moderator',
  added_at timestamptz not null default now()
);

-- Moderation trail: every approve / reject / request-changes decision.
create table if not exists public.pyq_moderation_log (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.pyq_papers (id) on delete cascade,
  action text not null,
  moderator_email text,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists pyq_moderation_log_paper_idx
  on public.pyq_moderation_log (paper_id, created_at desc);

create table if not exists public.profiles (
  id uuid primary key,
  class_key text,
  school text,
  programme_code text,
  semester text,
  section text,
  created_at timestamptz not null default now()
);

create table if not exists public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  token text not null unique,
  platform text not null default 'android',
  class_key text,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_prefs (
  user_id uuid primary key,
  prefs jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.saved_notices (
  user_id uuid not null,
  notice_id uuid not null references public.notices (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, notice_id)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid,
  pyq_id uuid references public.pyq_papers (id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  date_from date not null,
  date_to date,
  type text not null default 'academic',
  source_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.worker_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  status text not null,
  items_found integer not null default 0,
  items_new integer not null default 0,
  error text,
  ran_at timestamptz not null default now()
);
create index if not exists worker_runs_source_idx
  on public.worker_runs (source, ran_at desc);

-- ---------------------------------------------------------------------------
-- Storage buckets for PYQ papers (docs/ARCHITECTURE.md)
--
-- pyq-pending  : uploads land here and stay private until a moderator
--                approves them. 20 MB cap, PDF/JPG/PNG only.
-- pyq          : approved papers, readable by everyone.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('pyq-pending', 'pyq-pending', false, 20971520, array['application/pdf','image/jpeg','image/png']),
  ('pyq', 'pyq', true, 20971520, array['application/pdf','image/jpeg','image/png'])
on conflict (id) do nothing;

-- Students may upload into the pending bucket; the object path must start
-- with the bucket folder. The row in pyq_papers is still created by the app
-- and only a moderator can move a file to the approved bucket.
drop policy if exists "pyq pending upload" on storage.objects;
create policy "pyq pending upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'pyq-pending'
    and (storage.foldername(name))[1] = 'pyq-pending'
  );

-- A uploader can read their own pending file.
drop policy if exists "pyq pending read own" on storage.objects;
create policy "pyq pending read own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'pyq-pending'
    and owner_id = auth.uid()::text
  );

-- Approved papers are public (the bucket itself is public, so the read
-- policy is only needed for the private bucket).
drop policy if exists "pyq approved read" on storage.objects;
create policy "pyq approved read" on storage.objects
  for select to public
  using (bucket_id = 'pyq');

-- Moderators move files between the buckets.
drop policy if exists "pyq moderator move" on storage.objects;
create policy "pyq moderator move" on storage.objects
  for all to authenticated
  using (
    bucket_id in ('pyq-pending','pyq')
    and exists (
      select 1 from public.moderators m
      where m.email = auth.jwt() ->> 'email'
    )
  )
  with check (
    bucket_id in ('pyq-pending','pyq')
    and exists (
      select 1 from public.moderators m
      where m.email = auth.jwt() ->> 'email'
    )
  );

-- Download counter for an approved paper.
create or replace function public.increment_paper_downloads(paper_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.pyq_papers
     set downloads = downloads + 1
   where id = paper_id and status = 'approved';
end;
$$;
`;
