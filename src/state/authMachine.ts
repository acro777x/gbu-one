/**
 * GBU One — S2 Auth State Machine
 *
 * INTEGRATION STATUS: **WIRED IN.**
 *
 * `src/store/useAuthStore.ts` drives this machine and derives
 * `isGuest` / `isAuthenticated` from it, so the flags and the machine can
 * never disagree.
 *
 * Implements the deterministic S2 Authentication lifecycle:
 *   'uninitialized' -> 'onboarding' | 'guest' | 'authenticated' | 'locked'
 *
 * Adheres strictly to the university security guidelines in `docs/SCREENS_AUTH.md`:
 * - University passwords are NEVER accepted, stored, or processed.
 * - Anonymous guest mode has first-class citizen support.
 * - Brute-force lockout and session timeouts transition to 'locked'.
 */

import type { InvariantValidationResult, TransitionResult } from './types';

export type AuthMachineStateValue =
  | 'uninitialized'
  | 'onboarding'
  | 'guest'
  | 'unverified'
  | 'authenticated'
  | 'locked';

export interface AuthMachineContext {
  userId: string | null;
  rollNo: string | null;
  name: string | null;
  email: string | null;
  isGuest: boolean;
  failedAttempts: number;
  maxFailedAttempts: number;
  lockoutUntil: number | null;
  lockReason: string | null;
  previousState: 'guest' | 'authenticated' | null;
  lastActiveTimestamp: number | null;
  errorMessage: string | null;
}

export interface AuthMachineState {
  value: AuthMachineStateValue;
  context: AuthMachineContext;
}

export type AuthMachineEvent =
  | { type: 'BOOT_FIRST_LAUNCH' }
  | { type: 'BOOT_EXISTING_GUEST'; payload?: { guestId?: string; name?: string } }
  | {
      /**
       * A stored profile was found but the server could not confirm a live
       * session (the device is offline, or the session was revoked).
       *
       * This is NOT a sign-in. The app keeps the profile so the student is
       * not logged out by a lost connection, but it must never be presented
       * as a verified account - which is why it has its own state instead of
       * being folded into 'guest' or 'authenticated'.
       */
      type: 'BOOT_OFFLINE_SESSION';
      payload?: { userId?: string; rollNo?: string; email?: string; name?: string };
    }
  | {
      type: 'BOOT_EXISTING_USER';
      payload: { userId: string; rollNo?: string; email?: string; name?: string };
    }
  | { type: 'BOOT_LOCKED'; payload?: { lockoutUntil?: number; reason?: string } }
  | { type: 'START_ONBOARDING' }
  | { type: 'COMPLETE_ONBOARDING_AS_GUEST'; payload?: { guestId?: string; name?: string } }
  | { type: 'CONTINUE_AS_GUEST'; payload?: { guestId?: string; name?: string } }
  | {
      type: 'LOGIN_SUCCESS';
      payload: { userId: string; rollNo?: string; email?: string; name?: string };
    }
  | {
      type: 'LOGIN_FAILURE';
      payload?: { reason?: string; lockoutDurationMs?: number; now?: number };
    }
  | {
      type: 'LOCK_SESSION';
      payload?: { reason?: string; lockoutUntil?: number };
    }
  | {
      type: 'UNLOCK_SUCCESS';
      payload?: { targetState?: 'guest' | 'authenticated' };
    }
  | { type: 'LOGOUT' }
  | { type: 'SESSION_EXPIRED' }
  | { type: 'RESET_ACCOUNT' }
  | { type: 'CLEAR_ERROR' };

export type AuthMachineEventType = AuthMachineEvent['type'];

const DEFAULT_MAX_FAILED_ATTEMPTS = 5;
const DEFAULT_LOCKOUT_MS = 5 * 60 * 1000; // 5 minutes (300 seconds)

export function createInitialAuthContext(
  overrides?: Partial<AuthMachineContext>,
): AuthMachineContext {
  return {
    userId: null,
    rollNo: null,
    name: null,
    email: null,
    isGuest: false,
    failedAttempts: 0,
    maxFailedAttempts: DEFAULT_MAX_FAILED_ATTEMPTS,
    lockoutUntil: null,
    lockReason: null,
    previousState: null,
    lastActiveTimestamp: null,
    errorMessage: null,
    ...overrides,
  };
}

export function createInitialAuthState(
  initialValue: AuthMachineStateValue = 'uninitialized',
  contextOverrides?: Partial<AuthMachineContext>,
): AuthMachineState {
  const baseDefaults: Partial<AuthMachineContext> = {};
  if (initialValue === 'guest') {
    baseDefaults.isGuest = true;
  } else if (initialValue === 'authenticated') {
    baseDefaults.isGuest = false;
  }
  const context = createInitialAuthContext({ ...baseDefaults, ...contextOverrides });
  return {
    value: initialValue,
    context,
  };
}

/**
 * Validates whether an event transition is permitted from the current state.
 */
export function canTransitionAuth(
  from: AuthMachineState | AuthMachineStateValue,
  eventType: AuthMachineEventType,
): boolean {
  const stateVal = typeof from === 'string' ? from : from.value;

  switch (stateVal) {
    case 'uninitialized':
      return [
        'BOOT_FIRST_LAUNCH',
        'BOOT_EXISTING_GUEST',
        'BOOT_EXISTING_USER',
        'BOOT_OFFLINE_SESSION',
        'BOOT_LOCKED',
        'START_ONBOARDING',
        'CONTINUE_AS_GUEST',
        'LOGIN_SUCCESS',
        // A failed sign-in attempt is legitimate from any unlocked state. It
        // used to be reachable only from 'guest', which meant the very first
        // wrong password on a fresh install could not be counted - so the
        // brute-force lockout would never start until after a successful
        // sign-in had already happened once.
        'LOGIN_FAILURE',
        'LOCK_SESSION',
        // Signing out is always allowed, even before the app has finished
        // hydrating: the student pressed "Log out", so it must take effect.
        'LOGOUT',
      ].includes(eventType);

    case 'onboarding':
      return [
        'COMPLETE_ONBOARDING_AS_GUEST',
        'CONTINUE_AS_GUEST',
        'LOGIN_SUCCESS',
        'LOGIN_FAILURE',
        'LOCK_SESSION',
        'LOGOUT',
        'RESET_ACCOUNT',
        'CLEAR_ERROR',
      ].includes(eventType);

    case 'guest':
      return [
        'LOGIN_SUCCESS',
        'LOGIN_FAILURE',
        'LOCK_SESSION',
        'RESET_ACCOUNT',
        'CONTINUE_AS_GUEST',
        'LOGOUT',
        'CLEAR_ERROR',
      ].includes(eventType);

    case 'unverified':
      return [
        'LOGIN_SUCCESS',
        'LOGIN_FAILURE',
        'LOCK_SESSION',
        'RESET_ACCOUNT',
        'CONTINUE_AS_GUEST',
        'BOOT_OFFLINE_SESSION',
        'LOGOUT',
        'CLEAR_ERROR',
      ].includes(eventType);

    case 'authenticated':
      return [
        'LOGOUT',
        'LOCK_SESSION',
        'SESSION_EXPIRED',
        'RESET_ACCOUNT',
        'CLEAR_ERROR',
      ].includes(eventType);

    case 'locked':
      return ['UNLOCK_SUCCESS', 'RESET_ACCOUNT', 'CLEAR_ERROR'].includes(eventType);

    default:
      return false;
  }
}

/**
 * A successful sign-in, from any unlocked state.
 *
 * Shared by the 'guest', 'onboarding' and 'unverified' states so the three
 * paths cannot drift apart.
 */
function applyLoginSuccess(
  context: AuthMachineContext,
  payload: { userId: string; rollNo?: string; email?: string; name?: string },
): AuthMachineState {
  return {
    value: 'authenticated',
    context: {
      ...context,
      userId: payload.userId,
      rollNo: payload.rollNo ?? null,
      name: payload.name ?? null,
      email: payload.email ?? null,
      isGuest: false,
      failedAttempts: 0,
      errorMessage: null,
    },
  };
}

/**
 * A failed sign-in attempt. Counts towards the brute-force lockout and locks
 * the account once the limit is reached.
 *
 * Shared by the 'guest', 'onboarding' and 'unverified' states: a failed
 * attempt must be counted no matter where the student started from.
 */
function applyLoginFailure(
  context: AuthMachineContext,
  event: Extract<AuthMachineEvent, { type: 'LOGIN_FAILURE' }>,
  previousState: 'guest' | 'authenticated',
): AuthMachineState {
  const nextAttempts = context.failedAttempts + 1;
  const now = event.payload?.now ?? Date.now();
  if (nextAttempts >= context.maxFailedAttempts) {
    const duration = event.payload?.lockoutDurationMs ?? DEFAULT_LOCKOUT_MS;
    return {
      value: 'locked',
      context: {
        ...context,
        failedAttempts: nextAttempts,
        lockoutUntil: now + duration,
        lockReason: event.payload?.reason ?? 'Too many invalid login attempts',
        previousState,
        errorMessage: 'Account locked due to multiple failed login attempts',
      },
    };
  }
  return {
    value: previousState === 'guest' ? 'guest' : 'unverified',
    context: {
      ...context,
      failedAttempts: nextAttempts,
      errorMessage: event.payload?.reason ?? 'Invalid credentials',
    },
  };
}

/**
 * Pure state machine reducer for S2 Auth.
 * Invalid transitions return the unmodified state with an optional error context.
 */
export function authMachineReducer(
  state: AuthMachineState,
  event: AuthMachineEvent,
): AuthMachineState {
  const { value, context } = state;

  if (!canTransitionAuth(state, event.type)) {
    return {
      value,
      context: {
        ...context,
        errorMessage: `Invalid transition: cannot process event '${event.type}' from state '${value}'`,
      },
    };
  }

  switch (value) {
    case 'uninitialized': {
      switch (event.type) {
        case 'BOOT_FIRST_LAUNCH':
        case 'START_ONBOARDING':
          return {
            value: 'onboarding',
            context: {
              ...context,
              errorMessage: null,
            },
          };

        case 'LOGIN_FAILURE':
          // A wrong password on a fresh install still counts towards the
          // lockout. Without this the counter stayed at zero until the
          // student had signed in successfully once.
          return applyLoginFailure(context, event, 'guest');

        case 'LOGOUT':
          return {
            value: 'uninitialized',
            context: createInitialAuthContext(),
          };

        case 'BOOT_EXISTING_GUEST':
        case 'CONTINUE_AS_GUEST': {
          const guestId = event.payload?.guestId ?? 'guest';
          return {
            value: 'guest',
            context: {
              ...context,
              userId: guestId,
              name: event.payload?.name ?? 'Guest Student',
              isGuest: true,
              errorMessage: null,
            },
          };
        }

        case 'BOOT_EXISTING_USER':
          return {
            value: 'authenticated',
            context: {
              ...context,
              userId: event.payload.userId,
              rollNo: event.payload.rollNo ?? null,
              name: event.payload.name ?? null,
              email: event.payload.email ?? null,
              isGuest: false,
              failedAttempts: 0,
              errorMessage: null,
            },
          };

        case 'BOOT_OFFLINE_SESSION':
          // The profile is kept, but the session is NOT verified: the server
          // could not confirm it. `isGuest` stays false because the student
          // did not choose guest mode - they simply could not be reached.
          return {
            value: 'unverified',
            context: {
              ...context,
              userId: event.payload?.userId ?? null,
              rollNo: event.payload?.rollNo ?? null,
              name: event.payload?.name ?? null,
              email: event.payload?.email ?? null,
              isGuest: false,
              errorMessage: null,
            },
          };

        case 'BOOT_LOCKED':
          return {
            value: 'locked',
            context: {
              ...context,
              lockoutUntil: event.payload?.lockoutUntil ?? Date.now() + DEFAULT_LOCKOUT_MS,
              lockReason: event.payload?.reason ?? 'Persisted security lockout',
              errorMessage: null,
            },
          };

        case 'LOGIN_SUCCESS':
          return {
            value: 'authenticated',
            context: {
              ...context,
              userId: event.payload.userId,
              rollNo: event.payload.rollNo ?? null,
              name: event.payload.name ?? null,
              email: event.payload.email ?? null,
              isGuest: false,
              failedAttempts: 0,
              errorMessage: null,
            },
          };
      }
      break;
    }

    case 'onboarding': {
      switch (event.type) {
        case 'COMPLETE_ONBOARDING_AS_GUEST':
        case 'CONTINUE_AS_GUEST':
          return {
            value: 'guest',
            context: {
              ...context,
              userId: event.payload?.guestId ?? 'guest',
              name: event.payload?.name ?? 'Guest Student',
              isGuest: true,
              errorMessage: null,
            },
          };

        case 'LOGIN_SUCCESS':
          return applyLoginSuccess(context, event.payload);

        case 'LOGIN_FAILURE':
          return applyLoginFailure(context, event, 'guest');

        case 'LOCK_SESSION':
          return {
            value: 'locked',
            context: {
              ...context,
              lockoutUntil: event.payload?.lockoutUntil ?? null,
              lockReason: event.payload?.reason ?? 'Session locked by user or security policy',
              previousState: 'guest',
              errorMessage: null,
            },
          };

        case 'RESET_ACCOUNT':
          return {
            value: 'onboarding',
            context: createInitialAuthContext(),
          };

        case 'LOGOUT':
          return {
            value: 'uninitialized',
            context: createInitialAuthContext(),
          };

        case 'CLEAR_ERROR':
          return {
            value: 'onboarding',
            context: { ...context, errorMessage: null },
          };
      }
      break;
    }

    case 'guest': {
      switch (event.type) {
        case 'LOGIN_SUCCESS':
          return applyLoginSuccess(context, event.payload);

        case 'LOGIN_FAILURE':
          return applyLoginFailure(context, event, 'guest');

        case 'LOCK_SESSION':
          return {
            value: 'locked',
            context: {
              ...context,
              lockoutUntil: event.payload?.lockoutUntil ?? null,
              lockReason: event.payload?.reason ?? 'Session locked by user or security policy',
              previousState: 'guest',
              errorMessage: null,
            },
          };

        case 'CONTINUE_AS_GUEST':
          return {
            value: 'guest',
            context: {
              ...context,
              name: event.payload?.name ?? context.name,
              userId: event.payload?.guestId ?? context.userId,
            },
          };

        case 'RESET_ACCOUNT':
          return {
            value: 'onboarding',
            context: createInitialAuthContext(),
          };

        case 'LOGOUT':
          // Signing out of a guest session is legitimate: the device simply
          // returns to a clean, unidentified state.
          return {
            value: 'uninitialized',
            context: createInitialAuthContext(),
          };

        case 'CLEAR_ERROR':
          return {
            value: 'guest',
            context: { ...context, errorMessage: null },
          };
      }
      break;
    }

    case 'unverified': {
      // A stored profile the server could not confirm. The student is not a
      // guest (they did not choose that) and not authenticated (the server
      // did not say so). Everything else behaves like a signed-out student
      // with a remembered profile.
      switch (event.type) {
        case 'LOGIN_SUCCESS':
          return applyLoginSuccess(context, event.payload);

        case 'LOGIN_FAILURE':
          return applyLoginFailure(context, event, 'authenticated');

        case 'LOCK_SESSION':
          return {
            value: 'locked',
            context: {
              ...context,
              lockoutUntil: event.payload?.lockoutUntil ?? null,
              lockReason: event.payload?.reason ?? 'Session locked by user or security policy',
              previousState: 'authenticated',
              errorMessage: null,
            },
          };

        case 'CONTINUE_AS_GUEST':
          return {
            value: 'guest',
            context: {
              ...context,
              name: event.payload?.name ?? context.name,
              userId: event.payload?.guestId ?? context.userId,
              isGuest: true,
            },
          };

        case 'BOOT_OFFLINE_SESSION':
          return {
            value: 'unverified',
            context: {
              ...context,
              userId: event.payload?.userId ?? context.userId,
              rollNo: event.payload?.rollNo ?? context.rollNo,
              name: event.payload?.name ?? context.name,
              email: event.payload?.email ?? context.email,
              isGuest: false,
              errorMessage: null,
            },
          };

        case 'RESET_ACCOUNT':
          return {
            value: 'onboarding',
            context: createInitialAuthContext(),
          };

        case 'LOGOUT':
          return {
            value: 'uninitialized',
            context: createInitialAuthContext(),
          };

        case 'CLEAR_ERROR':
          return {
            value: 'unverified',
            context: { ...context, errorMessage: null },
          };
      }
      break;
    }

    case 'authenticated': {
      switch (event.type) {
        case 'LOGOUT':
          return {
            value: 'guest',
            context: {
              ...context,
              userId: 'guest',
              rollNo: null,
              email: null,
              name: 'Guest Student',
              isGuest: true,
              failedAttempts: 0,
              errorMessage: null,
            },
          };

        case 'SESSION_EXPIRED':
          return {
            value: 'guest',
            context: {
              ...context,
              userId: 'guest',
              rollNo: null,
              email: null,
              name: 'Guest Student',
              isGuest: true,
              errorMessage: 'Session expired, operating in guest mode',
            },
          };

        case 'LOCK_SESSION':
          return {
            value: 'locked',
            context: {
              ...context,
              lockoutUntil: event.payload?.lockoutUntil ?? null,
              lockReason: event.payload?.reason ?? 'Manual security lock or inactivity timeout',
              previousState: 'authenticated',
              errorMessage: null,
            },
          };

        case 'RESET_ACCOUNT':
          return {
            value: 'onboarding',
            context: createInitialAuthContext(),
          };

        case 'CLEAR_ERROR':
          return {
            value: 'authenticated',
            context: { ...context, errorMessage: null },
          };
      }
      break;
    }

    case 'locked': {
      switch (event.type) {
        case 'UNLOCK_SUCCESS': {
          const target = event.payload?.targetState ?? context.previousState ?? 'guest';
          return {
            value: target,
            context: {
              ...context,
              failedAttempts: 0,
              lockoutUntil: null,
              lockReason: null,
              previousState: null,
              errorMessage: null,
              isGuest: target === 'guest',
            },
          };
        }

        case 'RESET_ACCOUNT':
          return {
            value: 'onboarding',
            context: createInitialAuthContext(),
          };

        case 'CLEAR_ERROR':
          return {
            value: 'locked',
            context: { ...context, errorMessage: null },
          };
      }
      break;
    }
  }

  return state;
}

/**
 * Executes a transition with explicit success flag and error diagnostics.
 */
export function transitionAuth(
  state: AuthMachineState,
  event: AuthMachineEvent,
): TransitionResult<AuthMachineState> {
  if (!canTransitionAuth(state, event.type)) {
    const errorMsg = `Invalid auth transition: cannot process '${event.type}' from state '${state.value}'`;
    return {
      ok: false,
      state: {
        ...state,
        context: {
          ...state.context,
          errorMessage: errorMsg,
        },
      },
      error: errorMsg,
    };
  }

  const nextState = authMachineReducer(state, event);
  return {
    ok: true,
    state: nextState,
  };
}

/**
 * Validates domain invariant rules for the S2 Auth state.
 */
export function validateAuthInvariants(state: AuthMachineState): InvariantValidationResult {
  const violations: string[] = [];
  const { value, context } = state;

  if (value === 'guest') {
    if (!context.isGuest) {
      violations.push("State is 'guest' but isGuest is false");
    }
  }

  if (value === 'unverified') {
    // A remembered-but-unconfirmed profile: neither a guest (the student did
    // not choose guest mode) nor authenticated (the server did not say so).
    if (context.isGuest) {
      violations.push("State is 'unverified' but isGuest is true");
    }
  }

  if (value === 'authenticated') {
    if (context.isGuest) {
      violations.push("State is 'authenticated' but isGuest is true");
    }
    if (!context.userId) {
      violations.push("State is 'authenticated' but userId is null or empty");
    }
  }

  if (value === 'locked') {
    if (context.failedAttempts >= context.maxFailedAttempts && !context.lockoutUntil) {
      violations.push("State is 'locked' from brute force but lockoutUntil is missing");
    }
  }

  if (value === 'uninitialized') {
    if (context.userId && !context.isGuest) {
      violations.push("State is 'uninitialized' but active user credential exists");
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}
