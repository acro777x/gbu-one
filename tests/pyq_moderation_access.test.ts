/**
 * The moderation gate must explain itself.
 *
 * The old `isModerator()` returned `false` for every failure, so a project
 * whose row level security had no policy on `moderators` was indistinguishable
 * from "this account is not a moderator" — the owner saw "Moderator access
 * required" while their own allowlist row was sitting in the table. These tests
 * pin the three states apart (docs/ADMIN_MODERATION.md, OPEN_QUESTIONS #21).
 *
 * The allowlist is read with a CASE-INSENSITIVE match, because the server
 * helper `public.is_moderator()` compares `lower(m.email)` with the JWT
 * email: a row written as `Admin@GBU.ac.in` matches on the server and must
 * match in the app too.
 */
import { moderatorStatus, isModerator } from '../src/features/pyq/pyqRepository';

const mockConfig = { configured: true };
let moderatorRow: { role: string } | null = null;
let listError: { message: string } | null = null;
/** How the allowlist was read: `ilike` is case-insensitive, `eq` is not. */
let lastLookup: { method: 'eq' | 'ilike'; value: string } | null = null;

jest.mock('../src/lib/supabase', () => {
  const query = {
    select: () => query,
    eq: (column: string, value: string) => {
      lastLookup = { method: 'eq', value };
      return query;
    },
    ilike: (column: string, value: string) => {
      lastLookup = { method: 'ilike', value };
      return query;
    },
    maybeSingle: () =>
      Promise.resolve({ data: moderatorRow, error: listError }),
  };
  return {
    get isSupabaseConfigured() {
      return mockConfig.configured;
    },
    supabase: {
      from: () => query,
      auth: {
        getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      },
      storage: { from: () => ({ download: jest.fn(), upload: jest.fn(), remove: jest.fn() }) },
    },
  };
});

describe('moderator access', () => {
  beforeEach(() => {
    mockConfig.configured = true;
    moderatorRow = null;
    listError = null;
    lastLookup = null;
  });

  it('is signed-out when no account is signed in', async () => {
    const status = await moderatorStatus(null);
    expect(status.state).toBe('signed-out');
    expect(status.reason).toMatch(/sign in/i);
  });

  it('is moderator when the email is on the allowlist', async () => {
    moderatorRow = { role: 'owner' };
    const status = await moderatorStatus('Owner@GBUOne.test');
    expect(status.state).toBe('moderator');
    expect(status.reason).toBe('');
    await expect(isModerator('owner@gbuone.test')).resolves.toBe(true);
  });

  it('matches the allowlist case-insensitively', async () => {
    moderatorRow = { role: 'owner' };
    await moderatorStatus('Admin@GBU.ac.in');
    // `public.is_moderator()` compares `lower(m.email)`, so the app has to
    // compare the same way: an allowlist row written as `Admin@GBU.ac.in`
    // must match the account `admin@gbu.ac.in`.
    expect(lastLookup?.method).toBe('ilike');
    expect(lastLookup?.value).toBe('Admin@GBU.ac.in');
  });

  it('explains a readable allowlist that does not contain the account', async () => {
    const status = await moderatorStatus('student@gbuone.test');
    expect(status.state).toBe('not-moderator');
    // The owner may be looking at a project whose policies are missing, so the
    // message has to name the account it checked and point at the fix.
    expect(status.reason).toContain('student@gbuone.test');
    expect(status.reason).toContain('ADMIN_MODERATION');
    await expect(isModerator('student@gbuone.test')).resolves.toBe(false);
  });

  it('surfaces a refused read instead of calling it a denial', async () => {
    listError = { message: 'permission denied' };
    const status = await moderatorStatus('owner@gbuone.test');
    expect(status.state).toBe('backend-refused');
    expect(status.reason).toContain('permission denied');
  });

  it('says so when the cloud is not configured at all', async () => {
    mockConfig.configured = false;
    const status = await moderatorStatus('owner@gbuone.test');
    expect(status.state).toBe('backend-refused');
    expect(status.reason).toMatch(/not configured/i);
  });
});
