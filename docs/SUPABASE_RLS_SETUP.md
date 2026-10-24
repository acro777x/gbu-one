# Supabase RLS Setup Guide

## Why this matters
The app calls `supabase.from('table').select('*')` everywhere. If **Row Level Security (RLS)** is off, everyone can read *and* write every table — including moderator-only tables (`moderators`, `pyq_moderation_log`, `reports`). The service layer gates uploads and moderations, but RLS is the real safety net.

## Quick checklist (you must complete these in the Supabase Dashboard)

### 1. Enable RLS on every table the app reads/writes
In **SQL Editor**, run:

```sql
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campus_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campus_events SET (wal_level='replica');
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pyq_papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pyq_moderation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;
```

### 2. Create the helper functions

```sql
-- Caller-is-moderator helper (used by every moderation policy)
CREATE OR REPLACE FUNCTION public.is_moderator()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.moderators
    WHERE email = CURRENT_USER
       OR email = CURRENT_ROLE
  );
$$;

-- Create the moderator table if missing
CREATE TABLE IF NOT EXISTS public.moderators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  role text NOT NULL CHECK (role IN ('owner', 'moderator')),
  created_at timestamptz DEFAULT now()
);

-- Seed the owner
INSERT INTO public.moderators (email, role)
VALUES ('owner@example.com', 'owner')
ON CONFLICT (email) DO NOTHING;
```

### 3. Add policies (paste this into the Dashboard SQL editor)

```sql
-- ---------- app_users ----------
CREATE POLICY "Users read own profile"
  ON public.app_users FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users update own profile"
  ON public.app_users FOR UPDATE
  USING (id = auth.uid());

-- ---------- campus_events ----------
CREATE POLICY "Everyone read events"
  ON public.campus_events FOR SELECT
  USING (true);

-- ---------- notices ----------
CREATE POLICY "Users read main notices"
  ON public.notices FOR SELECT
  USING (true);

-- ---------- pyq_papers ----------
CREATE POLICY "Moderators read all PYQ"
  ON public.pyq_papers FOR SELECT
  USING (public.is_moderator());

CREATE POLICY "Students read approved PYQ"
  ON public.pyq_papers FOR SELECT
  USING (
    is_supabase_configured
    AND status = 'approved'
  );

-- ---------- pyq_moderation_log ----------
CREATE POLICY "Moderators write log"
  ON public.pyq_moderation_log FOR INSERT
  WITH CHECK (public.is_moderator());

-- ---------- reports ----------
CREATE POLICY "Students write reports"
  ON public.reports FOR INSERT
  WITH CHECK (true);

-- ---------- moderators (moderator table itself) ----------
CREATE POLICY "Moderators read list"
  ON public.moderators FOR SELECT
  USING (public.is_moderator());

CREATE POLICY "Moderator row access"
  ON public.moderators FOR ALL
  USING (public.is_moderator());

-- ---------- device_tokens ----------
CREATE POLICY "Self manage tokens"
  ON public.device_tokens FOR ALL
  USING (auth.uid() = user_id);

-- ---------- Default: deny everything else ----------
CREATE POLICY "Deny all"
  ON ALL TABLES IN SCHEMA public
  FOR ALL
  USING (false);
```

### 4. Verify
Run `node scripts/_rls_probe.js` (or the equivalent SQL in the dashboard) and confirm **all 6 steps read ALLOWED**.

## What is what
| Table | Purpose | Who can read | Who can write |
|---|---|---|---|
| `app_users` | App account + profile | Self | Self |
| `campus_events` | Live campus events feed | Everyone | Moderators (future) |
| `notices` | University notices feed | Everyone | Moderators (future) |
| `pyq_papers` | PYQ library with moderation | Approved only (students) | Moderators (all) |
| `pyq_moderation_log` | Approval trace | Moderators | Moderators |
| `reports` | Takedown reports | Public | Public (insert) |
| `moderators` | Email allowlist | Moderators | Moderators |
| `device_tokens` | FCM push registration | Self | Self |

## Notes
- `is_supabase_configured` is a server function that returns `true` when the Supabase URL is valid. The app checks it before firing queries.
- If you see a `403` error on a Supabase call, **RLS is blocking it**. Enable/write the policies above.
- Never disable RLS on production tables.
