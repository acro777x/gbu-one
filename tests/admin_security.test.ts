import crypto from 'crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../src/lib/supabase';
import {
  authenticateAdmin,
  authenticateAdminWithSupabase,
  signOutAdmin,
  checkHasAnyAdmin,
  verifyAdminCredentials,
  getLockoutState,
  getRemainingLockoutSeconds,
  isLockedOut,
  recordFailedAttempt,
  resetLockoutState,
  formatLockoutTime,
  touchAdminSession,
  isSessionExpired,
  checkSessionValidity,
  clearAdminSession,
  setAdminSessionActivityForTesting,
  recordAdminAction,
  getAdminAuditLog,
  clearAdminAuditLog,
  verifyAuditLedgerIntegrity,
  sha256,
  ADMIN_LOCKOUT_STORAGE_KEY,
  ADMIN_AUDIT_LOG_STORAGE_KEY,
  MAX_ADMIN_ATTEMPTS,
  ADMIN_LOCKOUT_SECONDS,
  ADMIN_SESSION_TIMEOUT_MS,
  requestAdminPasswordResetEmail,
  resetAdminPasswordWithEmailCode,
} from '../src/features/admin/adminSecurity';

const mockState = {
  configured: true,
  moderatorRow: null as { role: string } | null,
};

jest.mock('../src/lib/supabase', () => {
  const query: any = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    maybeSingle: jest.fn(() => Promise.resolve({ data: mockState.moderatorRow, error: null })),
    insert: jest.fn(() => Promise.resolve({ error: null })),
  };

  return {
    get isSupabaseConfigured() {
      return mockState.configured;
    },
    supabase: {
      auth: {
        signInWithPassword: jest.fn(),
        signUp: jest.fn(),
        signOut: jest.fn().mockResolvedValue({ error: null }),
        getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
        resetPasswordForEmail: jest.fn().mockResolvedValue({ data: {}, error: null }),
        verifyOtp: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
        updateUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
      rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
      from: jest.fn(() => query),
    },
  };
});

describe('Admin Security & Lockout System', () => {
  const originalEnv = process.env;

  beforeEach(async () => {
    process.env = { ...originalEnv };
    delete process.env.EXPO_PUBLIC_ADMIN_PIN;
    delete process.env.EXPO_PUBLIC_ADMIN_MFA_KEY;
    await AsyncStorage.clear();
    clearAdminSession();
    jest.useRealTimers();
    mockState.configured = true;
    mockState.moderatorRow = null;
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('NIST FIPS 180-4 SHA-256 Engine Compliance', () => {
    it('matches official NIST test vectors for standard strings', () => {
      const testCases = [
        '',
        'a',
        'abc',
        'hello world',
        'GBU One Admin 2026',
        'Examination Schedule 2026 - SoICT',
      ];

      for (const str of testCases) {
        const expected = crypto.createHash('sha256').update(str, 'utf8').digest('hex');
        expect(sha256(str)).toBe(expected);
      }
    });

    it('matches official NIST SHA-256 for multibyte UTF-8 Hindi and emoji text', () => {
      const unicodeCases = [
        'गौतम बुद्ध विश्वविद्यालय',
        'दीक्षांत समारोह 2026 • मुख्य सूचना',
        'Exam Alert 🔔 🔒 🚀',
        'Special characters: «§»—–•…',
      ];

      for (const str of unicodeCases) {
        const expected = crypto.createHash('sha256').update(str, 'utf8').digest('hex');
        expect(sha256(str)).toBe(expected);
      }
    });
  });

  describe('Brute-force lockout manager', () => {
    it('initial state starts with 0 failed attempts and not locked out', async () => {
      const state = await getLockoutState();
      expect(state.failedAttempts).toBe(0);
      expect(state.lockoutUntil).toBeNull();
      expect(await isLockedOut()).toBe(false);
      expect(await getRemainingLockoutSeconds()).toBe(0);
    });

    it('increments failed attempts up to 4 without locking out', async () => {
      for (let i = 1; i <= 4; i++) {
        const state = await recordFailedAttempt();
        expect(state.failedAttempts).toBe(i);
        expect(state.lockoutUntil).toBeNull();
        expect(await isLockedOut()).toBe(false);
        expect(await getRemainingLockoutSeconds()).toBe(0);
      }
    });

    it('triggers 300-second lockout on the 5th failed attempt', async () => {
      const baseTime = 1700000000000;
      jest.spyOn(Date, 'now').mockReturnValue(baseTime);

      // 4 failures
      for (let i = 0; i < 4; i++) {
        await recordFailedAttempt();
      }

      // 5th failure activates lockout
      const fifthState = await recordFailedAttempt();
      expect(fifthState.failedAttempts).toBe(5);
      expect(fifthState.lockoutUntil).toBe(baseTime + ADMIN_LOCKOUT_SECONDS * 1000);

      expect(await isLockedOut()).toBe(true);
      expect(await getRemainingLockoutSeconds()).toBe(ADMIN_LOCKOUT_SECONDS);
    });

    it('persists lockout state in AsyncStorage (@gbu_admin_lockout_state)', async () => {
      const baseTime = 1700000000000;
      jest.spyOn(Date, 'now').mockReturnValue(baseTime);

      for (let i = 0; i < 5; i++) {
        await recordFailedAttempt();
      }

      const storedRaw = await AsyncStorage.getItem(ADMIN_LOCKOUT_STORAGE_KEY);
      expect(storedRaw).toBeTruthy();
      const parsed = JSON.parse(storedRaw!);
      expect(parsed.failedAttempts).toBe(5);
      expect(parsed.lockoutUntil).toBe(baseTime + ADMIN_LOCKOUT_SECONDS * 1000);
    });

    it('lockout countdown decreases and expires properly over time', async () => {
      let currentTime = 1700000000000;
      jest.spyOn(Date, 'now').mockImplementation(() => currentTime);

      // Trigger lockout
      for (let i = 0; i < 5; i++) {
        await recordFailedAttempt();
      }

      expect(await isLockedOut()).toBe(true);
      expect(await getRemainingLockoutSeconds()).toBe(300);

      // Advance by 120 seconds (2 minutes)
      currentTime += 120 * 1000;
      expect(await isLockedOut()).toBe(true);
      expect(await getRemainingLockoutSeconds()).toBe(180);

      // Advance past the 300 seconds (total 301 seconds)
      currentTime += 181 * 1000;
      expect(await isLockedOut()).toBe(false);
      expect(await getRemainingLockoutSeconds()).toBe(0);

      // After expiry, state resets failedAttempts to 0
      const refreshedState = await getLockoutState();
      expect(refreshedState.failedAttempts).toBe(0);
      expect(refreshedState.lockoutUntil).toBeNull();
    });

    it('formatLockoutTime formats remaining seconds correctly as MM:SS', () => {
      expect(formatLockoutTime(300)).toBe('05:00');
      expect(formatLockoutTime(299)).toBe('04:59');
      expect(formatLockoutTime(65)).toBe('01:05');
      expect(formatLockoutTime(9)).toBe('00:09');
      expect(formatLockoutTime(0)).toBe('00:00');
      expect(formatLockoutTime(-5)).toBe('00:00');
    });

    it('prevents concurrent race conditions when multiple failed attempts occur simultaneously', async () => {
      const baseTime = 1700000000000;
      jest.spyOn(Date, 'now').mockReturnValue(baseTime);

      // Send 5 rapid parallel requests
      const promises = [
        recordFailedAttempt(),
        recordFailedAttempt(),
        recordFailedAttempt(),
        recordFailedAttempt(),
        recordFailedAttempt(),
      ];
      await Promise.all(promises);

      const state = await getLockoutState();
      expect(state.failedAttempts).toBe(5);
      expect(state.lockoutUntil).toBe(baseTime + ADMIN_LOCKOUT_SECONDS * 1000);
      expect(await isLockedOut()).toBe(true);
    });
  });

  describe('Multi-factor & Master Key Verification', () => {
    it('fails when no master PIN is configured in environment', async () => {
      delete process.env.EXPO_PUBLIC_ADMIN_PIN;
      const result = await verifyAdminCredentials('852096');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid Master PIN');
    });

    it('authenticates with configured env master PIN (EXPO_PUBLIC_ADMIN_PIN)', async () => {
      process.env.EXPO_PUBLIC_ADMIN_PIN = '999111';
      const result = await verifyAdminCredentials('999111');
      expect(result.success).toBe(true);
      expect(result.lockedOut).toBe(false);
      expect(result.remainingAttempts).toBe(MAX_ADMIN_ATTEMPTS);
    });

    it('authenticates with valid secondary MFA key when configured in env', async () => {
      process.env.EXPO_PUBLIC_ADMIN_PIN = '852096';
      process.env.EXPO_PUBLIC_ADMIN_MFA_KEY = 'GBU-SECURE-2026';
      const result = await verifyAdminCredentials('852096', 'GBU-SECURE-2026');
      expect(result.success).toBe(true);
      expect(result.lockedOut).toBe(false);
    });

    it('authenticates with custom env MFA key (EXPO_PUBLIC_ADMIN_MFA_KEY)', async () => {
      process.env.EXPO_PUBLIC_ADMIN_PIN = '852096';
      process.env.EXPO_PUBLIC_ADMIN_MFA_KEY = 'GBU-SUPER-ADMIN-2026';
      const result = await verifyAdminCredentials('852096', 'GBU-SUPER-ADMIN-2026');
      expect(result.success).toBe(true);
      expect(result.lockedOut).toBe(false);
    });

    it('fails when invalid secondary key is supplied even if PIN is correct', async () => {
      process.env.EXPO_PUBLIC_ADMIN_PIN = '852096';
      process.env.EXPO_PUBLIC_ADMIN_MFA_KEY = 'GBU-SECURE-2026';
      const result = await verifyAdminCredentials('852096', 'WRONG-MFA');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid Secondary Security Key');
      expect(result.remainingAttempts).toBe(4);
    });

    it('fails with invalid PIN and increments failed attempts', async () => {
      process.env.EXPO_PUBLIC_ADMIN_PIN = '852096';
      const result = await verifyAdminCredentials('000000');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid Master PIN');
      expect(result.remainingAttempts).toBe(4);

      const state = await getLockoutState();
      expect(state.failedAttempts).toBe(1);
    });

    it('successful auth resets attempt counter back to 0', async () => {
      process.env.EXPO_PUBLIC_ADMIN_PIN = '852096';
      // Fail 3 times
      await verifyAdminCredentials('wrong1');
      await verifyAdminCredentials('wrong2');
      await verifyAdminCredentials('wrong3');

      let state = await getLockoutState();
      expect(state.failedAttempts).toBe(3);

      // Now authenticate successfully
      const successResult = await verifyAdminCredentials('852096');
      expect(successResult.success).toBe(true);

      state = await getLockoutState();
      expect(state.failedAttempts).toBe(0);
      expect(state.lockoutUntil).toBeNull();
    });

    it('locks out on the 5th bad attempt in verifyAdminCredentials', async () => {
      for (let i = 0; i < 4; i++) {
        const res = await verifyAdminCredentials('wrong');
        expect(res.success).toBe(false);
        expect(res.lockedOut).toBe(false);
        expect(res.remainingAttempts).toBe(4 - i);
      }

      // 5th attempt
      const fifth = await verifyAdminCredentials('wrong');
      expect(fifth.success).toBe(false);
      expect(fifth.lockedOut).toBe(true);
      expect(fifth.remainingAttempts).toBe(0);
      expect(fifth.lockoutSeconds).toBe(300);
      expect(fifth.error).toContain('Access Temporarily Locked: Try again in 05:00');

      // Subsequent attempt while locked out
      const lockedAttempt = await verifyAdminCredentials('852096');
      expect(lockedAttempt.success).toBe(false);
      expect(lockedAttempt.lockedOut).toBe(true);
      expect(lockedAttempt.error).toContain('Access Temporarily Locked');
    });

    it('safely serializes concurrent bad passcode submissions preventing brute force race', async () => {
      const results = await Promise.all([
        verifyAdminCredentials('wrong1'),
        verifyAdminCredentials('wrong2'),
        verifyAdminCredentials('wrong3'),
        verifyAdminCredentials('wrong4'),
        verifyAdminCredentials('wrong5'),
      ]);

      expect(results.filter((r) => r.success)).toHaveLength(0);
      const state = await getLockoutState();
      expect(state.failedAttempts).toBe(5);
      expect(await isLockedOut()).toBe(true);

      // Sixth attempt is locked out immediately
      const sixth = await verifyAdminCredentials('wrong6');
      expect(sixth.lockedOut).toBe(true);
      expect(sixth.error).toContain('Access Temporarily Locked');
    });
  });

  describe('Session auto-lock (15-minute inactivity timeout)', () => {
    it('identifies uninitialized session as expired', () => {
      clearAdminSession();
      expect(isSessionExpired()).toBe(true);
      expect(checkSessionValidity()).toBe(false);
    });

    it('keeps session active when touched within 15 minutes', () => {
      const now = 1700000000000;
      jest.spyOn(Date, 'now').mockReturnValue(now);

      touchAdminSession();
      expect(isSessionExpired()).toBe(false);
      expect(checkSessionValidity()).toBe(true);

      // Advance by 14 minutes
      jest.spyOn(Date, 'now').mockReturnValue(now + 14 * 60 * 1000);
      expect(isSessionExpired()).toBe(false);
      expect(checkSessionValidity()).toBe(true);
    });

    it('continuous activity keeps session alive past 15 minutes', () => {
      let currentTime = 1700000000000;
      jest.spyOn(Date, 'now').mockImplementation(() => currentTime);

      touchAdminSession();

      // Simulate 5 actions, each 5 minutes apart (total 25 minutes of active usage)
      for (let i = 0; i < 5; i++) {
        currentTime += 5 * 60 * 1000;
        touchAdminSession();
        expect(isSessionExpired()).toBe(false);
        expect(checkSessionValidity()).toBe(true);
      }

      // Now go idle for 16 minutes without touching
      currentTime += 16 * 60 * 1000;
      expect(isSessionExpired()).toBe(true);
      expect(checkSessionValidity()).toBe(false);
    });

    it('expires session after 15 minutes of inactivity (ADMIN_SESSION_TIMEOUT_MS)', () => {
      const now = 1700000000000;
      jest.spyOn(Date, 'now').mockReturnValue(now);

      touchAdminSession();

      // Advance by 15 minutes + 1 second
      jest.spyOn(Date, 'now').mockReturnValue(now + ADMIN_SESSION_TIMEOUT_MS + 1000);
      expect(isSessionExpired()).toBe(true);
      expect(checkSessionValidity()).toBe(false);
    });

    it('clearAdminSession explicitly clears the active session', () => {
      touchAdminSession();
      clearAdminSession();
      expect(isSessionExpired()).toBe(true);
    });
  });

  describe('Tamper-evident Audit Ledger', () => {
    beforeEach(async () => {
      await clearAdminAuditLog();
    });

    it('starts with empty audit log', async () => {
      const log = await getAdminAuditLog();
      expect(log).toEqual([]);
      const check = await verifyAuditLedgerIntegrity();
      expect(check.valid).toBe(true);
      expect(check.totalEntries).toBe(0);
    });

    it('records all supported admin action types properly with cryptographic chaining', async () => {
      const entry1 = await recordAdminAction('publish_notice', {
        id: 'notice_101',
        title: 'End Term Datesheet',
      });
      expect(entry1.action).toBe('publish_notice');
      expect(entry1.prevHash).toBe('0000000000000000000000000000000000000000000000000000000000000000');
      expect(entry1.hash).toHaveLength(64);

      const entry2 = await recordAdminAction('upload_datesheet', {
        fileName: 'SOICT_EndSem.xlsx',
        school: 'soict',
      });
      expect(entry2.action).toBe('upload_datesheet');
      expect(entry2.prevHash).toBe(entry1.hash);
      expect(entry2.hash).toHaveLength(64);

      const entry3 = await recordAdminAction('moderate_pyq', {
        paperId: 'pyq_202',
        decision: 'approved',
      });
      expect(entry3.action).toBe('moderate_pyq');
      expect(entry3.prevHash).toBe(entry2.hash);

      const entry4 = await recordAdminAction('publish_update', {
        version: '1.2.0',
        mandatory: true,
      });
      expect(entry4.action).toBe('publish_update');
      expect(entry4.prevHash).toBe(entry3.hash);

      const entry5 = await recordAdminAction('delete_notice', {
        id: 'notice_101',
      });
      expect(entry5.action).toBe('delete_notice');
      expect(entry5.prevHash).toBe(entry4.hash);

      const entry6 = await recordAdminAction('revert_notice', {
        id: 'notice_101',
      });
      expect(entry6.action).toBe('revert_notice');
      expect(entry6.prevHash).toBe(entry5.hash);

      // Verify retrieval
      const storedLog = await getAdminAuditLog();
      expect(storedLog).toHaveLength(6);
      expect(storedLog[0].id).toBe(entry1.id);
      expect(storedLog[5].id).toBe(entry6.id);

      // Check integrity
      const integrity = await verifyAuditLedgerIntegrity();
      expect(integrity.valid).toBe(true);
      expect(integrity.totalEntries).toBe(6);
    });

    it('correctly hashes and verifies Unicode and Hindi notice entries', async () => {
      const hindiEntry = await recordAdminAction('publish_notice', {
        id: 'hindi_notice_1',
        title: 'गौतम बुद्ध विश्वविद्यालय 10वां दीक्षांत समारोह',
        category: 'academic',
        bulletPoints: ['• आवश्यक सूचना', '• सभी छात्र उपस्थित रहें'],
      });

      expect(hindiEntry.hash).toHaveLength(64);
      const integrity = await verifyAuditLedgerIntegrity();
      expect(integrity.valid).toBe(true);
      expect(integrity.totalEntries).toBe(1);
    });

    it('preserves hash chain continuity under concurrent parallel action logging', async () => {
      const actions = [
        recordAdminAction('publish_notice', { idx: 1 }),
        recordAdminAction('upload_datesheet', { idx: 2 }),
        recordAdminAction('moderate_pyq', { idx: 3 }),
        recordAdminAction('publish_update', { idx: 4 }),
        recordAdminAction('delete_notice', { idx: 5 }),
      ];

      await Promise.all(actions);

      const log = await getAdminAuditLog();
      expect(log).toHaveLength(5);

      const integrity = await verifyAuditLedgerIntegrity();
      expect(integrity.valid).toBe(true);
      expect(integrity.totalEntries).toBe(5);
    });

    it('detects tampering if an entry details are modified', async () => {
      await recordAdminAction('publish_notice', { title: 'Authentic Notice' });
      await recordAdminAction('upload_datesheet', { school: 'soict' });

      // Tamper with the first record in storage
      const log = await getAdminAuditLog();
      log[0].details.title = 'Hacked Notice Title';
      await AsyncStorage.setItem(ADMIN_AUDIT_LOG_STORAGE_KEY, JSON.stringify(log));

      const integrity = await verifyAuditLedgerIntegrity();
      expect(integrity.valid).toBe(false);
      expect(integrity.corruptedIndex).toBe(0);
      expect(integrity.error).toContain('Content tampering detected');
    });

    it('detects tampering if a chain link (prevHash) is broken', async () => {
      await recordAdminAction('publish_notice', { title: 'First Notice' });
      await recordAdminAction('publish_notice', { title: 'Second Notice' });

      // Tamper with chain link
      const log = await getAdminAuditLog();
      log[1].prevHash = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
      await AsyncStorage.setItem(ADMIN_AUDIT_LOG_STORAGE_KEY, JSON.stringify(log));

      const integrity = await verifyAuditLedgerIntegrity();
      expect(integrity.valid).toBe(false);
      expect(integrity.corruptedIndex).toBe(1);
      expect(integrity.error).toContain('Broken chain link');
    });
  });

  describe('Server-Side Supabase Auth & Role Verification', () => {
    it('rejects empty email or empty password without consuming lockout attempts', async () => {
      const res1 = await authenticateAdminWithSupabase('', 'password');
      expect(res1.success).toBe(false);
      expect(res1.error).toContain('required');

      const res2 = await authenticateAdminWithSupabase('admin@gbu.ac.in', '');
      expect(res2.success).toBe(false);
      expect(res2.error).toContain('required');

      const state = await getLockoutState();
      expect(state.failedAttempts).toBe(0);
    });

    it('informs user and protects against lockout when cloud server is unconfigured', async () => {
      mockState.configured = false;
      const res = await authenticateAdminWithSupabase('admin@gbu.ac.in', 'password123');
      expect(res.success).toBe(false);
      expect(res.error).toContain('offline or unconfigured');
      expect(res.error).toContain('Emergency Master Key');

      const state = await getLockoutState();
      expect(state.failedAttempts).toBe(0);
    });

    it('increments failed attempts and triggers lockout at 5 invalid credentials', async () => {
      (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid login credentials' },
      });

      for (let i = 1; i <= 4; i++) {
        const res = await authenticateAdminWithSupabase('admin@gbu.ac.in', 'wrongpass');
        expect(res.success).toBe(false);
        expect(res.remainingAttempts).toBe(5 - i);
        expect(res.lockedOut).toBe(false);
      }

      // 5th attempt activates lockout
      const fifth = await authenticateAdminWithSupabase('admin@gbu.ac.in', 'wrongpass');
      expect(fifth.success).toBe(false);
      expect(fifth.lockedOut).toBe(true);
      expect(fifth.lockoutSeconds).toBe(300);
      expect(fifth.error).toContain('Access Temporarily Locked');

      // Check audit log recorded failed attempts
      const auditLog = await getAdminAuditLog();
      const failedEntries = auditLog.filter((e) => e.action === 'admin_login_failed');
      expect(failedEntries.length).toBeGreaterThanOrEqual(5);
    });

    it('distinguishes network connectivity failure without penalizing lockout attempts', async () => {
      (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: { user: null },
        error: { message: 'Network request failed. Failed to fetch.' },
      });

      const res = await authenticateAdminWithSupabase('admin@gbu.ac.in', 'password123');
      expect(res.success).toBe(false);
      expect(res.error).toContain('Server Unreachable');
      expect(res.error).toContain('Emergency Master Key');

      const state = await getLockoutState();
      expect(state.failedAttempts).toBe(0);
    });

    it('rejects authenticated users who lack an authorized record in public.moderators', async () => {
      (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: { user: { id: 'usr-student-1', email: 'unauthorized_student@gbu.ac.in' } },
        error: null,
      });
      (supabase.rpc as jest.Mock).mockResolvedValue({ data: false, error: null });
      mockState.moderatorRow = null;

      const res = await authenticateAdminWithSupabase('unauthorized_student@gbu.ac.in', 'validPass123');
      expect(res.success).toBe(false);
      expect(res.error).toContain('Access Denied: Account is not authorized as a GBU administrator or moderator');
      expect(supabase.auth.signOut).toHaveBeenCalled();

      // Consumed 1 failed attempt for unauthorized access attempt
      const state = await getLockoutState();
      expect(state.failedAttempts).toBe(1);

      // Recorded in audit log
      const auditLog = await getAdminAuditLog();
      expect(
        auditLog.some(
          (e) => e.action === 'admin_login_failed' && String(e.details.email).includes('unauthorized_student'),
        ),
      ).toBe(true);
    });

    it('successfully authenticates verified administrator and resets lockout attempts', async () => {
      // Failed attempts previously recorded
      await recordFailedAttempt();
      await recordFailedAttempt();
      expect((await getLockoutState()).failedAttempts).toBe(2);

      // Valid moderator
      (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: { user: { id: 'usr-admin-1', email: 'verified_mod@gbu.ac.in' } },
        error: null,
      });
      (supabase.rpc as jest.Mock).mockResolvedValue({ data: true, error: null });
      mockState.moderatorRow = { role: 'moderator' };

      const res = await authenticateAdminWithSupabase('verified_mod@gbu.ac.in', 'correctPassword');
      expect(res.success).toBe(true);
      expect(res.authMethod).toBe('server');
      expect(res.userEmail).toBe('verified_mod@gbu.ac.in');
      expect(res.role).toBe('moderator');
      expect(res.remainingAttempts).toBe(MAX_ADMIN_ATTEMPTS);
      expect(res.lockedOut).toBe(false);

      // Reset lockout counter back to 0
      const state = await getLockoutState();
      expect(state.failedAttempts).toBe(0);

      // Session activity touched
      expect(isSessionExpired()).toBe(false);

      // Verified audit log entry
      const auditLog = await getAdminAuditLog();
      const loginSuccess = auditLog.find((e) => e.action === 'admin_login_success');
      expect(loginSuccess).toBeDefined();
      expect(loginSuccess?.details.method).toBe('server');
      expect(loginSuccess?.details.email).toBe('verified_mod@gbu.ac.in');
    });

    it('performs secure initial admin setup claiming owner role when uninitialized', async () => {
      (supabase.auth.signUp as jest.Mock).mockResolvedValue({
        data: { user: { id: 'owner-uuid', email: 'owner@gbu.ac.in' } },
        error: null,
      });
      (supabase.rpc as jest.Mock).mockImplementation((fn: string) => {
        if (fn === 'claim_initial_admin') return Promise.resolve({ data: true, error: null });
        if (fn === 'is_moderator') return Promise.resolve({ data: true, error: null });
        return Promise.resolve({ data: null, error: null });
      });

      const res = await authenticateAdminWithSupabase('owner@gbu.ac.in', 'masterPassword123', true);
      expect(res.success).toBe(true);
      expect(res.authMethod).toBe('server');
      expect(res.userEmail).toBe('owner@gbu.ac.in');
      expect(res.role).toBe('owner');

      // Audit log records admin_setup and admin_login_success
      const auditLog = await getAdminAuditLog();
      expect(auditLog.some((e) => e.action === 'admin_setup' && e.details.role === 'owner')).toBe(true);
      expect(auditLog.some((e) => e.action === 'admin_login_success')).toBe(true);
    });

    it('initial admin setup is rejected if an administrator already exists', async () => {
      (supabase.auth.signUp as jest.Mock).mockResolvedValue({
        data: { user: { id: 'attacker-uuid', email: 'attacker@gbu.ac.in' } },
        error: null,
      });
      (supabase.rpc as jest.Mock).mockImplementation((fn: string) => {
        if (fn === 'claim_initial_admin') return Promise.resolve({ data: false, error: null });
        if (fn === 'is_moderator') return Promise.resolve({ data: false, error: null });
        return Promise.resolve({ data: null, error: null });
      });
      mockState.moderatorRow = null;

      const res = await authenticateAdminWithSupabase('attacker@gbu.ac.in', 'hackPass123', true);
      expect(res.success).toBe(false);
      expect(res.error).toContain('Admin Setup Denied');
      expect(supabase.auth.signOut).toHaveBeenCalled();
    });
  });

  describe('Unified authenticateAdmin Entrypoint & Offline Fallback', () => {
    it('routes email and password through server authentication', async () => {
      (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: { user: { id: 'admin-uuid', email: 'admin@gbu.ac.in' } },
        error: null,
      });
      (supabase.rpc as jest.Mock).mockResolvedValue({ data: true, error: null });
      mockState.moderatorRow = { role: 'owner' };

      const res = await authenticateAdmin({
        email: 'admin@gbu.ac.in',
        password: 'adminPassword123',
      });

      expect(res.success).toBe(true);
      expect(res.authMethod).toBe('server');
      expect(res.role).toBe('owner');
    });

    it('routes offlinePin through NIST SHA-256 Emergency Master Key engine', async () => {
      process.env.EXPO_PUBLIC_ADMIN_PIN = '852096';
      process.env.EXPO_PUBLIC_ADMIN_MFA_KEY = 'GBU-SECURE-2026';
      const res = await authenticateAdmin({
        offlinePin: '852096',
        secondaryKey: 'GBU-SECURE-2026',
      });

      expect(res.success).toBe(true);
      expect(res.authMethod).toBe('offline_emergency');
      expect(res.role).toBe('emergency_admin');

      // Verified audit entry created
      const auditLog = await getAdminAuditLog();
      const emergencyEntry = auditLog.find(
        (e) => e.action === 'admin_login_success' && e.details.method === 'offline_emergency',
      );
      expect(emergencyEntry).toBeDefined();
    });

    it('fails when bad offline emergency PIN is provided', async () => {
      const res = await authenticateAdmin({
        offlinePin: '000000',
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('Invalid Master PIN');

      const auditLog = await getAdminAuditLog();
      expect(
        auditLog.some(
          (e) => e.action === 'admin_login_failed' && e.details.method === 'offline_emergency',
        ),
      ).toBe(true);
    });
  });

  describe('Admin Sign Out & Admin Count Checks', () => {
    it('signOutAdmin clears session, calls supabase.auth.signOut and logs admin_logout in audit ledger', async () => {
      touchAdminSession();
      expect(isSessionExpired()).toBe(false);

      await signOutAdmin();
      expect(isSessionExpired()).toBe(true);
      expect(supabase.auth.signOut).toHaveBeenCalled();

      const auditLog = await getAdminAuditLog();
      expect(auditLog.some((e) => e.action === 'admin_logout')).toBe(true);
    });

    it('checkHasAnyAdmin calls has_any_moderator RPC', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({ data: true, error: null });
      expect(await checkHasAnyAdmin()).toBe(true);

      (supabase.rpc as jest.Mock).mockResolvedValue({ data: false, error: null });
      expect(await checkHasAnyAdmin()).toBe(false);
    });
  });

  describe('Email Password Reset System (Supabase Free Email Recovery)', () => {
    it('rejects password reset request for unauthorized email', async () => {
      const res = await requestAdminPasswordResetEmail('unauthorized@gbu.ac.in');
      expect(res.success).toBe(false);
      expect(res.error).toContain('Password reset is strictly restricted');
    });

    it('sends password reset OTP email for authorized owner email', async () => {
      (supabase.auth.resetPasswordForEmail as jest.Mock).mockResolvedValueOnce({
        data: {},
        error: null,
      });
      const res = await requestAdminPasswordResetEmail('admin@gbu.ac.in');
      expect(res.success).toBe(true);
      expect(res.message).toContain('Verification code sent');
    });

    it('rejects email code reset for unauthorized email', async () => {
      const res = await resetAdminPasswordWithEmailCode('stranger@gmail.com', '123456', 'NewPass123');
      expect(res.success).toBe(false);
      expect(res.error).toContain('Reset Restricted');
    });

    it('rejects empty verification code', async () => {
      const res = await resetAdminPasswordWithEmailCode('admin@gbu.ac.in', '', 'NewPass123');
      expect(res.success).toBe(false);
      expect(res.error).toContain('verification code');
    });

    it('rejects short passwords under 6 characters', async () => {
      const res = await resetAdminPasswordWithEmailCode('admin@gbu.ac.in', '123456', '123');
      expect(res.success).toBe(false);
      expect(res.error).toContain('at least 6 characters');
    });

    it('resets password successfully when OTP code is valid', async () => {
      (supabase.auth.verifyOtp as jest.Mock).mockResolvedValueOnce({
        data: { session: { user: { email: 'admin@gbu.ac.in' } } },
        error: null,
      });
      (supabase.auth.updateUser as jest.Mock).mockResolvedValueOnce({
        data: { user: { email: 'admin@gbu.ac.in' } },
        error: null,
      });

      const res = await resetAdminPasswordWithEmailCode('admin@gbu.ac.in', '123456', 'NewPass1234');
      expect(res.success).toBe(true);
      expect(res.userEmail).toBe('admin@gbu.ac.in');
      expect(res.role).toBe('owner');
    });
  });
});
