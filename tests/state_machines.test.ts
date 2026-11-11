/**
 * GBU One — Typed State Machines Unit Test Suite
 *
 * Verifies all 5 state machines:
 * 1. S2 Auth Machine (src/state/authMachine.ts)
 * 2. S8 Class Alarm Machine (src/state/alarmMachine.ts)
 * 3. S11 Notices Source Machine (src/state/noticesMachine.ts)
 * 4. S12 Timetable Source Machine (src/state/timetableMachine.ts)
 * 5. Results Watcher Machine (src/state/resultsMachine.ts)
 *
 * Checks:
 * - Complete state space coverage
 * - Valid transition sequences & context state updates
 * - Rejection of invalid transitions with diagnostic errors
 * - Invariant assertions across every state
 */

import {
  // S2 Auth
  createInitialAuthState,
  authMachineReducer,
  transitionAuth,
  canTransitionAuth,
  validateAuthInvariants,

  // S8 Alarm
  createInitialAlarmState,
  alarmMachineReducer,
  transitionAlarm,
  canTransitionAlarm,
  validateAlarmInvariants,

  // S11 Notices
  createInitialNoticesState,
  noticesMachineReducer,
  transitionNotices,
  canTransitionNotices,
  validateNoticesInvariants,

  // S12 Timetable
  createInitialTimetableState,
  timetableMachineReducer,
  transitionTimetable,
  canTransitionTimetable,
  validateTimetableInvariants,

  // Results Watcher
  createInitialResultsState,
  resultsMachineReducer,
  transitionResults,
  canTransitionResults,
  validateResultsInvariants,
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
      expect(canTransitionAuth(s0, 'LOGOUT')).toBe(false);

      const res = transitionAuth(s0, { type: 'LOGOUT' });
      expect(res.ok).toBe(false);
      expect(res.error).toContain('cannot process');
      expect(res.state.value).toBe('guest'); // state preserved
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
  describe('S8 Class Alarm State Machine (src/state/alarmMachine.ts)', () => {
    it('initializes in idle state by default', () => {
      const state = createInitialAlarmState();
      expect(state.value).toBe('idle');
      expect(state.context.slotId).toBeNull();
      expect(validateAlarmInvariants(state).valid).toBe(true);
    });

    it('schedules an alarm from idle', () => {
      const s0 = createInitialAlarmState('idle');
      const targetTime = Date.now() + 3600000;
      const res = transitionAlarm(s0, {
        type: 'SCHEDULE',
        payload: {
          slotId: 'mon_p1_cs101',
          subjectCode: 'CS101',
          subjectName: 'Data Structures',
          roomName: 'SOICT-014',
          scheduledTime: targetTime,
          leadMinutes: 10,
          notificationId: 'notif_998',
        },
      });
      expect(res.ok).toBe(true);
      expect(res.state.value).toBe('scheduled');
      expect(res.state.context.slotId).toBe('mon_p1_cs101');
      expect(res.state.context.subjectCode).toBe('CS101');
      expect(res.state.context.roomName).toBe('SOICT-014');
      expect(validateAlarmInvariants(res.state).valid).toBe(true);
    });

    it('cancels a scheduled alarm returning to idle', () => {
      const s0 = createInitialAlarmState('scheduled', {
        slotId: 'mon_p1_cs101',
        scheduledTime: Date.now() + 3600000,
      });
      const res = transitionAlarm(s0, { type: 'CANCEL' });
      expect(res.ok).toBe(true);
      expect(res.state.value).toBe('idle');
      expect(res.state.context.slotId).toBeNull();
    });

    it('triggers fire when alarm time arrives', () => {
      const s0 = createInitialAlarmState('scheduled', {
        slotId: 'slot_1',
        scheduledTime: Date.now(),
      });
      const fireTime = Date.now();
      const res = transitionAlarm(s0, {
        type: 'TRIGGER_FIRE',
        payload: { firedAt: fireTime },
      });
      expect(res.ok).toBe(true);
      expect(res.state.value).toBe('firing');
      expect(res.state.context.firingStartedAt).toBe(fireTime);
      expect(validateAlarmInvariants(res.state).valid).toBe(true);
    });

    it('snoozes firing alarm and obeys max snooze limit', () => {
      const state = createInitialAlarmState('firing', {
        slotId: 'slot_1',
        firingStartedAt: Date.now(),
        snoozeCount: 0,
        maxSnoozes: 3,
        snoozeDurationMinutes: 5,
      });

      // Snooze 1
      let res = transitionAlarm(state, { type: 'SNOOZE', payload: { now: 1000000 } });
      expect(res.ok).toBe(true);
      expect(res.state.value).toBe('snoozed');
      expect(res.state.context.snoozeCount).toBe(1);
      expect(res.state.context.snoozedUntil).toBe(1000000 + 5 * 60 * 1000);
      expect(validateAlarmInvariants(res.state).valid).toBe(true);

      // Re-fire after snooze 1
      res = transitionAlarm(res.state, { type: 'TRIGGER_FIRE', payload: { firedAt: 1300000 } });
      expect(res.state.value).toBe('firing');

      // Snooze 2
      res = transitionAlarm(res.state, { type: 'SNOOZE', payload: { now: 1300000 } });
      expect(res.state.context.snoozeCount).toBe(2);

      // Re-fire after snooze 2
      res = transitionAlarm(res.state, { type: 'TRIGGER_FIRE', payload: { firedAt: 1600000 } });
      expect(res.state.value).toBe('firing');

      // Snooze 3 (max reached)
      res = transitionAlarm(res.state, { type: 'SNOOZE', payload: { now: 1600000 } });
      expect(res.state.context.snoozeCount).toBe(3);

      // Re-fire after snooze 3
      res = transitionAlarm(res.state, { type: 'TRIGGER_FIRE', payload: { firedAt: 1900000 } });
      expect(res.state.value).toBe('firing');

      // 4th Snooze should be REJECTED by guard
      const rejectRes = transitionAlarm(res.state, { type: 'SNOOZE' });
      expect(rejectRes.ok).toBe(false);
      expect(rejectRes.error).toContain('max snoozes (3) reached');
      expect(rejectRes.state.value).toBe('firing');
    });

    it('dismisses firing or snoozed alarm', () => {
      const s0 = createInitialAlarmState('firing', {
        slotId: 'slot_1',
        firingStartedAt: Date.now(),
      });
      const now = Date.now();
      const res = transitionAlarm(s0, { type: 'DISMISS', payload: { dismissedAt: now } });
      expect(res.ok).toBe(true);
      expect(res.state.value).toBe('dismissed');
      expect(res.state.context.dismissedAt).toBe(now);
      expect(validateAlarmInvariants(res.state).valid).toBe(true);
    });

    it('transitions to missed when unanswered past deadline', () => {
      const s0 = createInitialAlarmState('firing', {
        slotId: 'slot_1',
        firingStartedAt: Date.now() - 30 * 60 * 1000,
      });
      const now = Date.now();
      const res = transitionAlarm(s0, {
        type: 'TIME_OUT_MISSED',
        payload: { missedAt: now, reason: 'Ringing timeout exceeded' },
      });
      expect(res.ok).toBe(true);
      expect(res.state.value).toBe('missed');
      expect(res.state.context.missedAt).toBe(now);
      expect(validateAlarmInvariants(res.state).valid).toBe(true);

      // Student acknowledges missed alarm
      const ackRes = transitionAlarm(res.state, { type: 'ACKNOWLEDGE_MISSED' });
      expect(ackRes.ok).toBe(true);
      expect(ackRes.state.value).toBe('idle');
    });

    it('invokes pure alarm reducer directly', () => {
      const s0 = createInitialAlarmState('idle');
      const s1 = alarmMachineReducer(s0, {
        type: 'SCHEDULE',
        payload: {
          slotId: 'slot_direct',
          subjectCode: 'CS102',
          scheduledTime: Date.now() + 10000,
        },
      });
      expect(s1.value).toBe('scheduled');
      expect(s1.context.subjectCode).toBe('CS102');

      const sInvalid = alarmMachineReducer(s0, { type: 'TRIGGER_FIRE' });
      expect(sInvalid.value).toBe('idle');
      expect(sInvalid.context.errorMessage).toContain('Invalid alarm transition');
    });

    it('rejects invalid transitions from idle', () => {
      const s0 = createInitialAlarmState('idle');
      expect(canTransitionAlarm(s0, 'SNOOZE')).toBe(false);
      expect(canTransitionAlarm(s0, 'DISMISS')).toBe(false);
      expect(canTransitionAlarm(s0, 'TRIGGER_FIRE')).toBe(false);

      const res = transitionAlarm(s0, { type: 'SNOOZE' });
      expect(res.ok).toBe(false);
      expect(res.error).toContain("cannot process 'SNOOZE' from state 'idle'");
    });
  });

  // =========================================================================
  // 3. S11 NOTICES SOURCE STATE MACHINE
  // =========================================================================
  describe('S11 Notices Source State Machine (src/state/noticesMachine.ts)', () => {
    it('initializes in idle state', () => {
      const state = createInitialNoticesState();
      expect(state.value).toBe('idle');
      expect(state.context.itemCount).toBe(0);
      expect(validateNoticesInvariants(state).valid).toBe(true);
    });

    it('moves to loading on fetch start and resolves to live notices', () => {
      const s0 = createInitialNoticesState('idle');
      const startRes = transitionNotices(s0, {
        type: 'FETCH_START',
        payload: { sources: ['https://gbu.ac.in/notices'], schoolFilter: 'SOICT' },
      });
      expect(startRes.ok).toBe(true);
      expect(startRes.state.value).toBe('loading');
      expect(startRes.state.context.schoolFilter).toBe('SOICT');

      const now = Date.now();
      const liveRes = transitionNotices(startRes.state, {
        type: 'RECEIVE_LIVE',
        payload: { itemCount: 42, sources: ['https://gbu.ac.in/notices'], timestamp: now },
      });
      expect(liveRes.ok).toBe(true);
      expect(liveRes.state.value).toBe('live');
      expect(liveRes.state.context.itemCount).toBe(42);
      expect(liveRes.state.context.lastSyncedAt).toBe(now);
      expect(validateNoticesInvariants(liveRes.state).valid).toBe(true);
    });

    it('falls back to offline cache when live fetch fails', () => {
      const loadingState = createInitialNoticesState('loading');
      const cacheTime = Date.now() - 3600000;
      const res = transitionNotices(loadingState, {
        type: 'RECEIVE_CACHE',
        payload: { itemCount: 25, cacheTimestamp: cacheTime, reason: 'Network offline' },
      });
      expect(res.ok).toBe(true);
      expect(res.state.value).toBe('cached');
      expect(res.state.context.itemCount).toBe(25);
      expect(res.state.context.cacheTimestamp).toBe(cacheTime);
      expect(validateNoticesInvariants(res.state).valid).toBe(true);
    });

    it('falls back to sample data when no cache and no network exist', () => {
      const loadingState = createInitialNoticesState('loading');
      const res = transitionNotices(loadingState, {
        type: 'RECEIVE_SAMPLE',
        payload: { sampleNoticeCount: 10, reason: 'First launch offline' },
      });
      expect(res.ok).toBe(true);
      expect(res.state.value).toBe('sample');
      expect(res.state.context.sampleNoticeCount).toBe(10);
      expect(validateNoticesInvariants(res.state).valid).toBe(true);
    });

    it('transitions to error state upon network exception without fallback', () => {
      const loadingState = createInitialNoticesState('loading');
      const res = transitionNotices(loadingState, {
        type: 'FETCH_FAIL',
        payload: { error: '503 Service Unavailable' },
      });
      expect(res.ok).toBe(true);
      expect(res.state.value).toBe('error');
      expect(res.state.context.errorMessage).toBe('503 Service Unavailable');
      expect(res.state.context.retryCount).toBe(1);
      expect(validateNoticesInvariants(res.state).valid).toBe(true);

      // Retry moves back to loading
      const retryRes = transitionNotices(res.state, { type: 'RETRY' });
      expect(retryRes.ok).toBe(true);
      expect(retryRes.state.value).toBe('loading');
    });

    it('syncs cached state to live when network is restored', () => {
      const cachedState = createInitialNoticesState('cached', {
        itemCount: 15,
        cacheTimestamp: Date.now() - 10000,
      });
      const now = Date.now();
      const res = transitionNotices(cachedState, {
        type: 'SYNC_LIVE',
        payload: { itemCount: 30, timestamp: now },
      });
      expect(res.ok).toBe(true);
      expect(res.state.value).toBe('live');
      expect(res.state.context.itemCount).toBe(30);
    });

    it('invokes pure notices reducer directly', () => {
      const s0 = createInitialNoticesState('idle');
      const s1 = noticesMachineReducer(s0, { type: 'FETCH_START' });
      expect(s1.value).toBe('loading');

      const sInvalid = noticesMachineReducer(s0, { type: 'RECEIVE_LIVE', payload: { itemCount: 5 } });
      expect(sInvalid.value).toBe('idle');
      expect(sInvalid.context.errorMessage).toContain('Invalid notices transition');
    });

    it('rejects invalid direct transitions from idle', () => {
      const s0 = createInitialNoticesState('idle');
      expect(canTransitionNotices(s0, 'RECEIVE_LIVE')).toBe(false);

      const res = transitionNotices(s0, {
        type: 'RECEIVE_LIVE',
        payload: { itemCount: 10 },
      });
      expect(res.ok).toBe(false);
      expect(res.error).toContain("cannot process 'RECEIVE_LIVE' from state 'idle'");
    });
  });

  // =========================================================================
  // 4. S12 TIMETABLE SOURCE STATE MACHINE
  // =========================================================================
  describe('S12 Timetable Source State Machine (src/state/timetableMachine.ts)', () => {
    it('initializes in idle state', () => {
      const state = createInitialTimetableState();
      expect(state.value).toBe('idle');
      expect(state.context.slotsCount).toBe(0);
      expect(state.context.classKey).toBeNull();
      expect(validateTimetableInvariants(state).valid).toBe(true);
    });

    it('requests timetable and completes with live schedule & detected room changes', () => {
      const s0 = createInitialTimetableState('idle');
      const reqRes = transitionTimetable(s0, {
        type: 'REQUEST_TIMETABLE',
        payload: { classKey: 'BTECH_CSE_SEM4' },
      });
      expect(reqRes.ok).toBe(true);
      expect(reqRes.state.value).toBe('loading');
      expect(reqRes.state.context.classKey).toBe('BTECH_CSE_SEM4');

      const now = Date.now();
      const liveRes = transitionTimetable(reqRes.state, {
        type: 'RECEIVE_LIVE',
        payload: { slotsCount: 28, detectedChangesCount: 2, timestamp: now },
      });
      expect(liveRes.ok).toBe(true);
      expect(liveRes.state.value).toBe('live');
      expect(liveRes.state.context.slotsCount).toBe(28);
      expect(liveRes.state.context.detectedChangesCount).toBe(2);
      expect(validateTimetableInvariants(liveRes.state).valid).toBe(true);
    });

    it('serves cached timetable snapshot when network request is pending or offline', () => {
      const loadingState = createInitialTimetableState('loading', {
        classKey: 'BTECH_CSE_SEM4',
      });
      const cacheTime = Date.now() - 7200000;
      const res = transitionTimetable(loadingState, {
        type: 'RECEIVE_CACHE',
        payload: { slotsCount: 28, cacheTimestamp: cacheTime, isStale: true },
      });
      expect(res.ok).toBe(true);
      expect(res.state.value).toBe('cached');
      expect(res.state.context.isStale).toBe(true);
      expect(res.state.context.cacheTimestamp).toBe(cacheTime);
      expect(validateTimetableInvariants(res.state).valid).toBe(true);
    });

    it('serves sample timetable when no cache exists for newly selected class', () => {
      const loadingState = createInitialTimetableState('loading', {
        classKey: 'NEW_PROGRAMME_SEM1',
      });
      const res = transitionTimetable(loadingState, {
        type: 'RECEIVE_SAMPLE',
        payload: { slotsCount: 20, reason: 'Bundled demo schedule' },
      });
      expect(res.ok).toBe(true);
      expect(res.state.value).toBe('sample');
      expect(res.state.context.slotsCount).toBe(20);
      expect(validateTimetableInvariants(res.state).valid).toBe(true);
    });

    it('switches class seamlessly from live state', () => {
      const liveState = createInitialTimetableState('live', {
        classKey: 'BTECH_CSE_SEM4',
        slotsCount: 28,
        lastSyncedAt: Date.now(),
      });
      const switchRes = transitionTimetable(liveState, {
        type: 'SWITCH_CLASS',
        payload: { classKey: 'MBA_SEM2' },
      });
      expect(switchRes.ok).toBe(true);
      expect(switchRes.state.value).toBe('loading');
      expect(switchRes.state.context.classKey).toBe('MBA_SEM2');
    });

    it('handles request failure and retry', () => {
      const loadingState = createInitialTimetableState('loading', {
        classKey: 'BTECH_CSE_SEM4',
      });
      const failRes = transitionTimetable(loadingState, {
        type: 'REQUEST_FAIL',
        payload: { error: 'Timetable server connection timeout' },
      });
      expect(failRes.ok).toBe(true);
      expect(failRes.state.value).toBe('error');
      expect(failRes.state.context.errorMessage).toContain('timeout');
      expect(validateTimetableInvariants(failRes.state).valid).toBe(true);

      const retryRes = transitionTimetable(failRes.state, { type: 'RETRY' });
      expect(retryRes.ok).toBe(true);
      expect(retryRes.state.value).toBe('loading');
    });

    it('invokes pure timetable reducer directly', () => {
      const s0 = createInitialTimetableState('idle');
      const s1 = timetableMachineReducer(s0, {
        type: 'REQUEST_TIMETABLE',
        payload: { classKey: 'SOICT_CS101' },
      });
      expect(s1.value).toBe('loading');

      const sInvalid = timetableMachineReducer(s0, {
        type: 'RECEIVE_LIVE',
        payload: { slotsCount: 5 },
      });
      expect(sInvalid.value).toBe('idle');
      expect(sInvalid.context.errorMessage).toContain('Invalid timetable transition');
    });

    it('rejects invalid transitions', () => {
      const s0 = createInitialTimetableState('idle');
      expect(canTransitionTimetable(s0, 'RECEIVE_LIVE')).toBe(false);

      const res = transitionTimetable(s0, {
        type: 'RECEIVE_LIVE',
        payload: { slotsCount: 10 },
      });
      expect(res.ok).toBe(false);
      expect(res.error).toContain("cannot process 'RECEIVE_LIVE' from state 'idle'");
    });
  });

  // =========================================================================
  // 5. RESULTS WATCHER STATE MACHINE
  // =========================================================================
  describe('Results Watcher State Machine (src/state/resultsMachine.ts)', () => {
    it('initializes in idle state', () => {
      const state = createInitialResultsState();
      expect(state.value).toBe('idle');
      expect(state.context.school).toBeNull();
      expect(validateResultsInvariants(state).valid).toBe(true);
    });

    it('starts watch and arms watching state with baseline', () => {
      const s0 = createInitialResultsState('idle');
      const startRes = transitionResults(s0, {
        type: 'START_WATCH',
        payload: {
          school: 'SOICT',
          sheetCode: 'soict_results',
          baseline: {
            lastModified: 'Wed, 21 Oct 2026 08:30:00 GMT',
            bytes: 145020,
          },
        },
      });
      expect(startRes.ok).toBe(true);
      expect(startRes.state.value).toBe('watching');
      expect(startRes.state.context.school).toBe('SOICT');
      expect(startRes.state.context.lastModifiedHeader).toBe('Wed, 21 Oct 2026 08:30:00 GMT');
      expect(startRes.state.context.contentLengthBytes).toBe(145020);
      expect(validateResultsInvariants(startRes.state).valid).toBe(true);
    });

    it('polls with no change returning to watching state', () => {
      const watchingState = createInitialResultsState('watching', {
        school: 'SOICT',
        lastModifiedHeader: 'Wed, 21 Oct 2026 08:30:00 GMT',
      });
      const pollStart = transitionResults(watchingState, { type: 'TRIGGER_POLL' });
      expect(pollStart.ok).toBe(true);
      expect(pollStart.state.value).toBe('polling');

      const checkedTime = Date.now();
      const unchangedRes = transitionResults(pollStart.state, {
        type: 'POLL_SUCCESS_UNCHANGED',
        payload: { checkedAt: checkedTime },
      });
      expect(unchangedRes.ok).toBe(true);
      expect(unchangedRes.state.value).toBe('watching');
      expect(unchangedRes.state.context.lastCheckedAt).toBe(checkedTime);
      expect(unchangedRes.state.context.detectedChangesCount).toBe(0);
    });

    it('detects revised result sheet and moves to notified state', () => {
      const pollingState = createInitialResultsState('polling', {
        school: 'SOICT',
        lastModifiedHeader: 'Wed, 21 Oct 2026 08:30:00 GMT',
        contentLengthBytes: 145020,
      });

      const detectedTime = Date.now();
      const changedRes = transitionResults(pollingState, {
        type: 'POLL_SUCCESS_CHANGED',
        payload: {
          lastModified: 'Thu, 22 Oct 2026 14:00:00 GMT',
          bytes: 152000,
          detectedAt: detectedTime,
        },
      });
      expect(changedRes.ok).toBe(true);
      expect(changedRes.state.value).toBe('notified');
      expect(changedRes.state.context.lastModifiedHeader).toBe('Thu, 22 Oct 2026 14:00:00 GMT');
      expect(changedRes.state.context.contentLengthBytes).toBe(152000);
      expect(changedRes.state.context.lastNotifiedAt).toBe(detectedTime);
      expect(changedRes.state.context.detectedChangesCount).toBe(1);
      expect(validateResultsInvariants(changedRes.state).valid).toBe(true);

      // Student acknowledges notification, returning to watching
      const ackRes = transitionResults(changedRes.state, {
        type: 'ACKNOWLEDGE_NOTIFICATION',
      });
      expect(ackRes.ok).toBe(true);
      expect(ackRes.state.value).toBe('watching');
    });

    it('transitions to error upon network failure during poll and recovers', () => {
      const pollingState = createInitialResultsState('polling', { school: 'SOICT' });
      const failRes = transitionResults(pollingState, {
        type: 'POLL_FAILURE',
        payload: { error: 'Network 502 Bad Gateway' },
      });
      expect(failRes.ok).toBe(true);
      expect(failRes.state.value).toBe('error');
      expect(failRes.state.context.consecutiveFailures).toBe(1);
      expect(validateResultsInvariants(failRes.state).valid).toBe(true);

      // Retry triggers polling again
      const retryRes = transitionResults(failRes.state, { type: 'RETRY' });
      expect(retryRes.ok).toBe(true);
      expect(retryRes.state.value).toBe('polling');
    });

    it('stops watch from any active state back to idle', () => {
      const watching = createInitialResultsState('watching', { school: 'SOICT' });
      const stopRes = transitionResults(watching, { type: 'STOP_WATCH' });
      expect(stopRes.ok).toBe(true);
      expect(stopRes.state.value).toBe('idle');
      expect(stopRes.state.context.school).toBeNull();
    });

    it('invokes pure results watcher reducer directly', () => {
      const s0 = createInitialResultsState('idle');
      const s1 = resultsMachineReducer(s0, {
        type: 'START_WATCH',
        payload: { school: 'SOICT' },
      });
      expect(s1.value).toBe('watching');

      const sInvalid = resultsMachineReducer(s0, {
        type: 'TRIGGER_POLL',
      });
      expect(sInvalid.value).toBe('idle');
      expect(sInvalid.context.errorMessage).toContain('Invalid results transition');
    });

    it('rejects invalid transitions', () => {
      const s0 = createInitialResultsState('idle');
      expect(canTransitionResults(s0, 'POLL_SUCCESS_CHANGED')).toBe(false);

      const res = transitionResults(s0, {
        type: 'POLL_SUCCESS_CHANGED',
        payload: { lastModified: 'today' },
      });
      expect(res.ok).toBe(false);
      expect(res.error).toContain("cannot process 'POLL_SUCCESS_CHANGED' from state 'idle'");
    });
  });
});
