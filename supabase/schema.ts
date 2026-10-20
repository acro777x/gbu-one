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
`;
