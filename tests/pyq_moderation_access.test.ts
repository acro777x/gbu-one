/**
 * The moderation gate must explain itself.
 *
 * The old `isModerator()` returned `false` for every failure, so a project
 * whose row level security had no policy on `moderators` was indistinguishable
 * from "this account is not a moderator" — the owner saw "Moderator access
 * required" while their own allowlist row was sitting in the table. These tests
 * pin the three states apart (docs/ADMIN_MODERATION.md, OPEN_QUESTIONS #21).
 */
import { moderatorStatus, isModerator } from '../src/features/pyq/pyqRepository';

const mockConfig = { configured: true };
let moderatorRow: { role: string } | null = null;
let listError: { message: string } | null = null;

jest.mock('../src/lib/supabase', () => {
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: () =>
      Promise.resolve({ data: moderatorRow, error: listError }),
  };
  return {
    get isSupabaseConfigured() {
      return mockConfig.configured;
    },
    supabase: {
      from: () => query,
      storage: { from: () => ({ download: jest.fn(), upload: jest.fn(), remove: jest.fn() }) },
    },
  };
});

describe('moderator access', () => {
  beforeEach(() => {
    mockConfig.configured = true;
    moderatorRow = null;
    listError = null;
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