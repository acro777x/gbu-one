# Apply the new database schema to Supabase — step by step

**Status as of 12 November 2026: the live database is still running the OLD schema.**
The app code now targets the NEW schema, so several features are broken until you
paste it. This document is the exact procedure.

---

## What is currently wrong (verified against the live project)

| Thing | Live now | After the paste |
|---|---|---|
| Table `admin_claims` | **missing** | created |
| Table `campus_events` | **missing** | created |
| Table `app_versions` | **missing** | created |
| `pyq_papers.uploader_student_id` | **missing** | added |
| `pyq_papers.uploader_name` | **missing** | added |
| `pyq_papers.uploader_avatar` | **missing** | added |
| `pyq_papers.file_size_bytes` | **missing** | added |
| `reports.reporter_student_id` | **missing** | added |
| `reports.reporter_email` | **missing** | added |
| `reports.status` | **missing** | added |
| Function `public.is_moderator()` | **missing** | created |
| Function `public.is_owner()` | **missing** | created |
| Function `public.claim_initial_admin()` | **missing** | created |
| Function `public.has_any_moderator()` | **missing** | created |
| Function `public.set_moderator()` / `remove_moderator()` | **missing** | created |
| View `public.pyq_contributor_points` | **missing** | created |
| Policy `pyq papers own read` | **missing** | created (a student can see their own pending/rejected uploads) |
| Policy `device tokens guest update` | **missing** | created (a guest could register a push token but never update it, so changing section kept the old class key) |
| Table `results_push_log` | **missing** | created (without it the worker's results stage refuses to push, because otherwise the whole backlog would be re-announced to every device) |
| Storage bucket `pyq-files` | **missing** | created |
| Storage bucket `pyq-pending` | private | **still private** (the old script could flip it public — the new one cannot) |
| Row level security | weak (`using (true)` on writes) | **deny-by-default**, moderator-only writes |

> **One behaviour change to know about.** The contributor-points view now groups
> by the real Supabase account, not by the device identity. A guest's upload
> (which has no account) therefore earns **no** leaderboard points. That is
> deliberate: the device identity is written by the client, so one device
> could otherwise claim another student's points. Signing in turns on
> attribution.

**Consequence of not pasting:** the admin console's "Initial Setup", the What's-On
events screen, the compulsory-update screen, PYQ uploads, and the student report
list all fail at runtime. The app does not crash — it silently falls back to
bundled data, which is why the problem is easy to miss.

---

## The two files

| File | What it is | When to run it |
|---|---|---|
| `supabase/schema.sql` | The full schema: tables, columns, indexes, storage buckets, row level security, helper functions. **This is the one you paste.** | Once, now. Safe to run again later after an upgrade. |
| `supabase/seed.sql` | Adds YOU to the moderator allowlist. | Once, after the schema. You must edit it first (see step 5). |

`supabase/schema.sql` is generated from `supabase/schema.ts` by
`node tools/emit-sql.mjs`, and `tests/schema_sql_sync.test.ts` fails the build if
the two ever drift apart. So **never edit `schema.sql` by hand** — edit
`supabase/schema.ts` and regenerate.

---

## Before you start: rotate the API key (this is mandatory)

Right now the key in your `.env` is a **secret** key (`sb_secret_...`) used as the
app's client key. It was baked into the shipped APK, so every student who installed
the app held a key that bypasses every security policy. The build script now
**refuses to produce a release build** while that is true.

1. Open the Supabase dashboard for your project.
2. Go to **Project Settings → API Keys**.
3. Create a new **Publishable** key (`sb_publishable_...`). Call it
   `gbu-one-mobile`.
4. Leave the existing **secret** key alone for now — the worker still needs it.
   But copy it into the GitHub secret (step 7) if it is not there already.
5. Open your local `.env` and change **one line**:

   ```
   EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxxxxxxxxxxxxxxx
   ```

   Keep `SUPABASE_SERVICE_ROLE_KEY` exactly as it is — that one is worker-only.

---

## Step-by-step

### Step 1 — open the SQL editor

1. Log in to <https://supabase.com/dashboard>.
2. Pick your project (the one whose URL is
   `https://pjnxllnncsoroevgfbmt.supabase.co`).
3. In the left sidebar click **SQL Editor** (the icon that looks like a page).
4. Click **New query**. You get a big empty white editor.

### Step 2 — paste the schema

1. On your computer open this file:

   ```
   C:\Users\Public\Downloads\chrome downloads\gbu one\supabase\schema.sql
   ```

2. Select **all** of it (`Ctrl+A`), copy it (`Ctrl+C`).
3. Paste it into the Supabase SQL editor (`Ctrl+V`).
4. The editor may show a warning like *"This statement may contain unsafe
   operations"* — click **Run** anyway. The script is written for exactly this.

### Step 3 — run it and read the result

Press **Run** (or `Ctrl+Enter`).

**What success looks like:** a green **"Success. No rows returned"** message, or a
list of statements each marked with a green check. That is normal — the script
creates things, it does not select rows.

**If you see a red error:** copy the error text and send it to me. The script is
idempotent, so you can simply fix the reported line and run it again — it will
not damage anything that already exists.

> The script is safe to run more than once. Every statement is
> `create ... if not exists` or `drop policy if exists` + `create policy`.

### Step 4 — verify the paste worked

Still in the SQL editor, click **New query** and paste this check:

```sql
select
  (select count(*) from information_schema.tables
     where table_schema = 'public' and table_name in
       ('admin_claims','campus_events','app_versions','results_push_log')) as new_tables,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname in
       ('is_moderator','is_owner','claim_initial_admin','has_any_moderator',
        'set_moderator','remove_moderator'))               as new_functions,
  (select count(*) from pg_policies p join pg_class c on c.oid = p.polymorphic
     where n.nspname = 'public')                           as policies,
  (select count(*) from pg_tables
     where schemaname = 'public' and rowsecurity)          as rls_enabled;
```

You are looking for:

* `new_tables` = **4**
* `new_functions` = **6**
* `rls_enabled` = the number of public tables (they should all be protected)

### Step 5 — add yourself as the owner

1. Open `supabase/seed.sql` on your computer.
2. Find the line `values ('owner@example.com')` — there are **two** such lines
   (one for `admin_claims`, one for `moderators`).
3. Replace `owner@example.com` with **your own** Supabase Auth email — the one
   you actually sign in with in the admin console. It is currently
   `ashishkhola56@gmail.com`.
4. Also find the commented-out student moderator line and, if you want a
   trusted student to help moderate, fill it in and uncomment it.
5. Copy the whole file and paste it into the SQL editor, then **Run**.

The script refuses to run if you forgot to replace the placeholder — it will
raise a clear error rather than silently giving owner rights to a mailbox that
does not exist.

> **Important:** there are currently **two** `owner` rows in the live
> `moderators` table — `ashishkhola56@gmail.com` and `admin@gbu.ac.in`.
> `admin@gbu.ac.in` is a **fabricated address that does not exist** (it is on no
> official GBU page). Leaving it as an owner is harmless but confusing; you can
> remove it with:
>
> ```sql
> delete from public.moderators where lower(email) = 'admin@gbu.ac.in';
> ```

### Step 6 — create the storage bucket `pyq-files`

The schema script creates this for you, so by the time you have run it the bucket
should exist. To confirm, open **Storage** in the sidebar; you should see:

* `campus-events` (public)
* `pyq` (public)
* `pyq-files` (public)
* `pyq-pending` (**private** — this is the moderation queue, it must stay private)

If `pyq-pending` is listed as **public**, stop and tell me: the old script could
flip it, and that would expose unmoderated uploads.

### Step 7 — fix the GitHub secret that is silently breaking the worker

**This is a separate, urgent problem.** The scheduled worker has been running
"successfully" every 15 minutes since **3 November** without writing a single
row, because the `SUPABASE_SERVICE_ROLE_KEY` secret is missing or wrong in
GitHub Actions. The worker silently switched to a "parse-only" mode and the job
still reported a green tick.

1. Open your repository on GitHub: <https://github.com/acro777x/gbu-one>
2. **Settings → Secrets and variables → Actions → Secrets tab**.
3. You need these three:

   | Secret name | Value |
   |---|---|
   | `SUPABASE_URL` | `https://pjnxllnncsoroevgfbmt.supabase.co` |
   | `SUPABASE_SERVICE_ROLE_KEY` | your **secret** key (`sb_secret_...`) — the one from the dashboard, **not** the publishable key |
   | `EXPO_ACCESS_TOKEN` | your Expo access token (only needed for push) |

4. Save each one.
5. Go to the **Actions** tab, pick **Worker cron (notices)**, and click
   **Run workflow** to trigger it by hand.

The workflow now has two new guards that did not exist before:

* it **fails immediately** if a secret is missing or empty;
* after the worker runs, it **reads `worker_runs` and fails the job** if no new
  row appeared.

So you will now *see* the failure instead of a silent no-op.

### Step 8 — rebuild the app

The build script now refuses to produce a release build while the client key is
still a secret key:

```
python tools/build_android_apk.py --release
```

If it stops with *"REFUSING TO BUILD: EXPO_PUBLIC_SUPABASE_ANON_KEY holds a
Supabase SECRET key"*, that is the guard working. Fix the key (step 0) and run
it again.

---

## How to undo / recover

* The script is idempotent — running it again is always safe.
* If a paste fails halfway, just fix the reported error and run it again.
* Nothing in the script deletes student data: no `truncate`, no `drop table`.

---

## One-line summary

1. Create a **publishable** key in the dashboard → put it in `.env` as
   `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
2. Dashboard → **SQL Editor** → paste `supabase/schema.sql` → **Run**.
3. Run the verification query → expect `new_tables = 4`, `new_functions = 6`.
4. Edit `supabase/seed.sql` with your real email → paste → **Run**.
5. Add `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` to the GitHub Actions
   secrets → run the workflow by hand.
6. Rebuild the APK.
