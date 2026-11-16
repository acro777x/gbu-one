/**
 * GBU One - Typed State Machines Unit Test Suite
 *
 * Verifies the S2 Auth Machine (src/state/authMachine.ts):
 * - Complete state space coverage
 * - Valid transition sequences & context state updates
 * - Rejection of invalid transitions with diagnostic errors
 * - Invariant assertions across every state
 *
 * The other four machines were removed: they were specifications of a
 * lifecycle that the app implements in its own modules (the alarm
 * scheduling in src/features/notifications/classAlarm.ts, the notices
 * tiers in src/features/notices/useNoticesQuery.ts, the timetable tiers
 * in src/features/timetable/timetableStore.ts and the results watch in
 * src/features/exams/resultsWatch.ts). They were never imported by the
 * app, so they were 1,850 lines of code and 33 KB of tests that proved
 * nothing about the running app.
 *
 * tests/state_machine_integration.test.ts now forbids that from happening
 * again: every machine in src/state has to be imported by production code.
 */

import {
  // S2 Auth
  createInitialAuthState,
  authMachineReducer,
  transitionAuth,
  canTransitionAuth,
  validateAuthInvariants,
} from '../src/state';

describe('Typed State-Machine Layer', () => {
  // =========================================================================
  // 1. S2 AUTH STATE MACHINE
  // =========================================================================
  describe('S2 Auth State Machine (src/state/authMachine.ts)', () => {
    it('initializes in uninitialized state by default', () => {
      const state = createInitialAuthState();
      expect(state.value).toBe('uninitialized');
      expect(state.context.userId).toBeNull();
      expect(state.context.isGuest).toBe(false);
      expect(validateAuthInvariants(state).valid).toBe(true);
    });

    it('boots fresh install to onboarding', () => {
      const s0 = createInitialAuthState('uninitialized');
      const res = transitionAuth(s0, { type: 'BOOT_FIRST_LAUNCH' });
      expect(res.ok).toBe(true);
      expect(res.state.value).toBe('onboarding');
      expect(validateAuthInvariants(res.state).valid).toBe(true);
    });

    it('completes onboarding as guest user', () => {
      const s0 = createInitialAuthState('onboarding');
      const res = transitionAuth(s0, {
        type: 'COMPLETE_ONBOARDING_AS_GUEST',
        payload: { guestId: 'GBU-78A4B2', name: 'Scholar Guest' },
      });
      expect(res.ok).toBe(true);
      expect(res.state.value).toBe('guest');
      expect(res.state.context.userId).toBe('GBU-78A4B2');
      expect(res.state.context.isGuest).toBe(true);
      expect(validateAuthInvariants(res.state).valid).toBe(true);
    });

    it('logs in authenticated student from guest mode', () => {
      const s0 = createInitialAuthState('guest', { userId: 'GBU-78A4B2', isGuest: true });
      const res = transitionAuth(s0, {
        type: 'LOGIN_SUCCESS',
        payload: {
          userId: 'usr_abc123',
          rollNo: '21/ICS/045',
          email: 'aarav@gbu.ac.in',
          name: 'Aarav Sharma',
        },
      });
      expect(res.ok).toBe(true);
      expect(res.state.value).toBe('authenticated');
      expect(res.state.context.userId).toBe('usr_abc123');
      expect(res.state.context.rollNo).toBe('21/ICS/045');
      expect(res.state.context.isGuest).toBe(false);
      expect(validateAuthInvariants(res.state).valid).toBe(true);
    });

    it('handles student logout transitioning back to guest mode', () => {
      const s0 = createInitialAuthState('authenticated', {
        userId: 'usr_abc123',
        rollNo: '21/ICS/045',
        isGuest: false,
      });
      const res = transitionAuth(s0, { type: 'LOGOUT' });
      expect(res.ok).toBe(true);
      expect(res.state.value).toBe('guest');
      expect(res.state.context.isGuest).toBe(true);
      expect(res.state.context.rollNo).toBeNull();
      expect(validateAuthInvariants(res.state).valid).toBe(true);
    });

    it('handles session expiration returning to guest mode with notice', () => {
      const s0 = createInitialAuthState('authenticated', {
        userId: 'usr_abc123',
        isGuest: false,
      });
      const res = transitionAuth(s0, { type: 'SESSION_EXPIRED' });
      expect(res.ok).toBe(true);
      expect(res.state.value).toBe('guest');
      expect(res.state.context.isGuest).toBe(true);
      expect(res.state.context.errorMessage).toContain('Session expired');
    });

    it('locks session upon brute-force lockout threshold', () => {
      let state = createInitialAuthState('guest', { failedAttempts: 0, maxFailedAttempts: 5 });

      // 4 failed attempts should stay in guest mode
      for (let i = 1; i <= 4; i++) {
        const res = transitionAuth(state, {
          type: 'LOGIN_FAILURE',
          payload: { reason: 'Incorrect credentials' },
        });
        expect(res.ok).toBe(true);
        expect(res.state.value).toBe('guest');
        expect(res.state.context.failedAttempts).toBe(i);
        state = res.state;
      }

      // 5th failed attempt triggers transition to 'locked'
      const now = 1700000000000;
      const res5 = transitionAuth(state, {
        type: 'LOGIN_FAILURE',
        payload: { reason: 'Brute force triggered', lockoutDurationMs: 300000, now },
      });
      expect(res5.ok).toBe(true);
      expect(res5.state.value).toBe('locked');
      expect(res5.state.context.failedAttempts).toBe(5);
      expect(res5.state.context.lockoutUntil).toBe(now + 300000);
      expect(res5.state.context.previousState).toBe('guest');
      expect(validateAuthInvariants(res5.state).valid).toBe(true);
    });

    it('unlocks locked session back to target or previous state', () => {
      const lockedState = createInitialAuthState('locked', {
        failedAttempts: 5,
        lockoutUntil: Date.now() + 60000,
        previousState: 'guest',
      });
      const res = transitionAuth(lockedState, { type: 'UNLOCK_SUCCESS' });
      expect(res.ok).toBe(true);
      expect(res.state.value).toBe('guest');
      expect(res.state.context.failedAttempts).toBe(0);
      expect(res.state.context.lockoutUntil).toBeNull();
    });

    it('manual session lock from authenticated and unlock', () => {
      const s0 = createInitialAuthState('authenticated', {
        userId: 'usr_admin',
        isGuest: false,
      });
      const lockRes = transitionAuth(s0, {
        type: 'LOCK_SESSION',
        payload: { reason: 'Inactivity auto-lock' },
      });
      expect(lockRes.ok).toBe(true);
      expect(lockRes.state.value).toBe('locked');
      expect(lockRes.state.context.previousState).toBe('authenticated');

      const unlockRes = transitionAuth(lockRes.state, {
        type: 'UNLOCK_SUCCESS',
        payload: { targetState: 'authenticated' },
      });
      expect(unlockRes.ok).toBe(true);
      expect(unlockRes.state.value).toBe('authenticated');
    });

    it('invokes pure reducer directly for valid and invalid events', () => {
      const s0 = createInitialAuthState('uninitialized');
      const s1 = authMachineReducer(s0, { type: 'BOOT_FIRST_LAUNCH' });
      expect(s1.value).toBe('onboarding');

      const sInvalid = authMachineReducer(s1, { type: 'BOOT_FIRST_LAUNCH' });
      expect(sInvalid.value).toBe('onboarding');
      expect(sInvalid.context.errorMessage).toContain('Invalid transition');
    });

    it('rejects invalid transitions gracefully', () => {
      const s0 = createInitialAuthState('guest');
      // Booting an existing account is only valid from 'uninitialized': a
      // guest session that has already been established cannot suddenly
      // discover a stored account.
      expect(canTransitionAuth(s0, 'BOOT_EXISTING_USER')).toBe(false);

      const res = transitionAuth(s0, { type: 'BOOT_EXISTING_USER', payload: { userId: 'usr_1' } });
      expect(res.ok).toBe(false);
      expect(res.error).toContain('cannot process');
      expect(res.state.value).toBe('guest'); // state preserved
    });

    it('allows a sign-out from every unlocked state', () => {
      // The student pressed "Log out", so it must take effect - including
      // before the app has finished hydrating, and from a guest or an
      // unverified session.
      for (const value of ['uninitialized', 'onboarding', 'guest', 'unverified'] as const) {
        const state = createInitialAuthState(value, { userId: 'usr_1' });
        expect(canTransitionAuth(state, 'LOGOUT')).toBe(true);
        const res = transitionAuth(state, { type: 'LOGOUT' });
        expect(res.ok).toBe(true);
        expect(res.state.value).toBe('uninitialized');
      }
      // Signing out of a real account leaves the app in guest mode.
      const authed = createInitialAuthState('authenticated', { userId: 'usr_1' });
      const res = transitionAuth(authed, { type: 'LOGOUT' });
      expect(res.ok).toBe(true);
      expect(res.state.value).toBe('guest');
    });

    it('counts a failed sign-in from every unlocked state', () => {
      // A wrong password on a FRESH install must still count towards the
      // brute-force lockout. It used to be reachable only from 'guest', so
      // the lockout never started until after one successful sign-in.
      for (const value of ['uninitialized', 'onboarding', 'guest', 'unverified'] as const) {
        const state = createInitialAuthState(value, { userId: 'usr_1' });
        expect(canTransitionAuth(state, 'LOGIN_FAILURE')).toBe(true);
        const res = transitionAuth(state, { type: 'LOGIN_FAILURE' });
        expect(res.ok).toBe(true);
        expect(res.state.context.failedAttempts).toBe(1);
      }
    });

    it('keeps an unverified offline session distinct from guest and authenticated', () => {
      const state = createInitialAuthState('unverified', { userId: 'usr_1', isGuest: false });
      expect(validateAuthInvariants(state).valid).toBe(true);
      expect(state.value).toBe('unverified');
    });

    it('detects invariant violations in corrupted state', () => {
      // Authenticated but isGuest is true
      const corruptedAuth = createInitialAuthState('authenticated', {
        userId: 'usr_1',
        isGuest: true,
      });
      const check1 = validateAuthInvariants(corruptedAuth);
      expect(check1.valid).toBe(false);
      expect(check1.violations[0]).toContain("isGuest is true");

      // Guest but isGuest is false
      const corruptedGuest = createInitialAuthState('guest', {
        isGuest: false,
      });
      const check2 = validateAuthInvariants(corruptedGuest);
      expect(check2.valid).toBe(false);
      expect(check2.violations[0]).toContain("isGuest is false");
    });
  });

  // =========================================================================
  // 2. S8 CLASS ALARM STATE MACHINE
  // =========================================================================

});

