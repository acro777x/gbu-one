# Admin & moderation setup (owner)

This is the one-time setup that makes the PYQ upload → review → publish loop
actually work on the live Supabase project, plus how to sign in as the admin who
approves things. Background and evidence: `docs/OPEN_QUESTIONS.md` #21, #5.

## Why this exists

The project runs **deny-by-default**: row level security is switched on and,
until a policy exists for a table, *every* read and write from the app is
refused. The app is offline-first, so it hid that perfectly — the screens fell
back to their bundled data and looked normal. Measured on 2026-10-23:

| What the app does | What the live project did |
|---|---|
| `isModerator()` reads `public.moderators` | no policy → `false` for **everyone, including you** → "Moderator access required" |
| The queue lists pending papers | no policy → always empty |
| The upload form inserts a pending row | `42501` refused |
| Approve/Reject updates the row | no policy → refused |
| Approving moves the file between buckets | the policy's `exists (select 1 from public.moderators …)` subquery is itself filtered by that table's row level security → never matched → refused |
| Push registration writes `device_tokens` | `403` refused |
| Reporting a paper writes `reports` | `403` refused |
| A student browses approved papers | no read policy → nothing, ever |

## 1. The one paste that fixes it

There is **no way to run SQL against this project from a machine**: the Postgres
password is not in the repo, there is no Management API token, `pg/query` is not
exposed, and the project has no `exec_sql` RPC (that is also why the worker's
`ensureSchema()` guard has never succeeded — it only warns). So the fix is one
manual paste, and it is idempotent, so running it twice is harmless:

1. Open the Supabase dashboard for project `pjnxllnncsoroevgfbmt`.
2. **SQL Editor → New query**.
3. Paste the whole contents of [`supabase/schema.sql`](../supabase/schema.sql)
   (generated from `supabase/schema.ts` by `node tools/emit-sql.mjs`).
4. **Run**. You should see "Success. No rows returned".

What it creates that matters here:

- `public.is_moderator()` — a `security definer` function, the *only* place
  allowed to read `public.moderators`. Every policy that needs to know "is this
  the owner?" calls it, which is what removes the filtered-subquery trap.
- `moderators read own` — lets a signed-in account read its own allowlist row
  (this is what `isModerator()` asks for).
- `pyq papers approved read` (everyone), `pyq papers moderator read`,
  `pyq papers insert pending` (the uploader's own row),
  `pyq papers moderator update` (the only way a status changes).
- `pyq moderator move` on `storage.objects`, rewritten to call the helper.
- `device tokens own` and `reports insert`, so push and reporting work again.
- Readable published data: `notices`, `notice_attachments`, `notice_threads`,
  `calendar_events`, `exam_datesheets`, `exam_date_slots`, `results`,
  `timetable_changes`.

Verify afterwards (needs the keys in `.env`):

```
node scripts/_rls-probe.js
```

Every line should read `ALLOWED`, and the moderator should see the real rows:

```
[1] SELECT pending rows    owner (moderator)   ALLOWED (39 row(s))
[3] UPDATE a pending row   owner (moderator)   ALLOWED (1 row(s))
[6] storage                upload into the public bucket: 200
```

## 2. The admin account

The owner account is a normal Supabase Auth user whose email is also in
`public.moderators` with `role = 'owner'`. It is **not** a university account:
no university password is ever collected from anyone (`docs/SCREENS_AUTH.md`).

| | |
|---|---|
| Email | `ashishkhola56@gmail.com` |
| Role | `owner` (in `public.moderators`) |
| Password | the value of `GBU_ADMIN_PASSWORD` in `.env` — **git-ignored, never committed; rotate it if it ever leaks** |

To sign in from the app: open **Login** and type that email address into the
first field (the field takes either a roll number or an email address — see
`toLoginEmail()` in `src/store/useAuthStore.ts`), plus the password. Then
**Profile → Moderation Queue** (or `app/moderation.tsx` directly).

To change the password: Supabase dashboard → **Authentication → Users →** the
user → **Reset password** (or `PUT /auth/v1/admin/users/{id}` with
`{"password": "…"}`), then update `GBU_ADMIN_PASSWORD` in `.env`. Seeding or
rotating from this machine:

```
node scripts/_seed-admin.js        # creates/updates the account + allowlist row
```

### Adding another moderator (a trusted student)

One SQL row in the dashboard — no app release:

```sql
insert into public.moderators (email, role)
values ('student@example.com', 'moderator')
on conflict (email) do update set role = excluded.role;
```

Remove one with `delete from public.moderators where email = '…';`.

## 3. Reviewing the queue

`app/moderation.tsx` shows every `pending` paper with its subject, year, exam
type, school, programme and semester, plus **Approve**, **Reject** and, for a
batch, **Approve all N**.

- **Approve** downloads the file from `pyq-pending`, uploads it to `pyq`,
  deletes the pending copy, then flips `status` to `approved` — the status only
  changes after the file move succeeds, so a failed move can never publish an
  unapproved paper.
- **Approve all** runs the same call per paper, one at a time. The owner asked
  for the 39-paper imported archive to be clearable without 39 taps; each paper
  still gets its own `pyq_moderation_log` entry naming your account.
- Students only ever see `approved` rows, and their files only exist in the
  public `pyq` bucket.

### The 39 imported papers

`node scripts/pyq-import/importPyq.js --status` lists them. They carry
`uploader_id = null` (they came from the Telegram archive, not from an app
upload) and their metadata is whatever the plan resolved — the two name matches
worth a second look before you approve them are listed in
`docs/OPEN_QUESTIONS.md` #20.

## 4. If the queue still refuses you

- **Moderator access required**, with a reason naming your email → step 1 has not
  been applied yet (the message says so), or the address you typed does not match
  the allowlist row (check the `public.moderators` table).
- **The server blocked the queue** → the request itself failed; the reason line
  carries the Postgres error.
- **Sign in to review** → you are in guest mode or signed out.

## 5. Guest uploads and the offline queue

A guest has no JWT, so the `insert pending` policy (which is `to authenticated`)
cannot apply to them: their paper stays on the phone in
`src/features/pyq/localUploadQueue.ts` and goes up as soon as they sign in,
exactly as `app/(tabs)/pyq.tsx` promises. Nothing is lost and nothing is
silently published.