-- ===========================================================================
-- GBU One - owner seed. RUN THIS ONCE, BY HAND.
--
-- The main schema (supabase/schema.sql) deliberately does NOT seed the
-- moderator allowlist: pasting it must never overwrite a live role.
--
-- HOW TO USE
-- ----------
-- 1. Open the Supabase dashboard -> SQL Editor -> New query.
-- 2. Replace the TWO placeholder addresses below with the owner's real
--    Supabase Auth address (the one the owner signs in with in the admin
--    console) and, optionally, a trusted student's.
-- 3. Run it.
--
-- The owner must already have a Supabase Auth account for the email below
-- (create it from the admin console's "Setup" tab on first run, or from the
-- Supabase dashboard -> Authentication -> Users).
--
-- This is idempotent: running it again only refreshes the role.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- GUARD: fail loudly if the placeholders were not replaced.
--
-- Seeding 'owner@example.com' would (a) grant owner rights to a mailbox that
-- does not exist, and (b) - much worse - make public.admin_claims non-empty,
-- which makes public.claim_initial_admin() refuse to claim the console. The
-- real owner would then be locked out of first-run setup with no way to fix it
-- from the app.
-- ---------------------------------------------------------------------------
do $$
declare
  placeholder constant text := 'owner@example.com';
begin
  if exists (
    select 1 from public.moderators where lower(email) = placeholder
  ) or exists (
    select 1 from public.admin_claims where lower(email) = placeholder
  ) then
    raise exception
      'GBU One seed: the placeholder address % is still in the allowlist. '
      'Replace it with your real Supabase Auth email before running this script, '
      'and delete the placeholder rows first.', placeholder;
  end if;
end;
$$;

-- 1. Mark the console as claimed, so no one else can run "Initial Setup".
insert into public.admin_claims (email)
values ('owner@example.com')
on conflict (email) do nothing;

-- 2. The owner. role = 'owner' may moderate and manage the allowlist.
insert into public.moderators (email, role)
values ('owner@example.com', 'owner')
on conflict (email) do update set role = excluded.role;

-- 3. Optional: a trusted student moderator.
-- insert into public.moderators (email, role)
-- values ('student@example.com', 'moderator')
-- on conflict (email) do update set role = excluded.role;

-- ---------------------------------------------------------------------------
-- Verify (run this and read the output):
--
--   select email, role from public.moderators order by added_at;
--   select email, claimed_at from public.admin_claims;
-- ---------------------------------------------------------------------------
