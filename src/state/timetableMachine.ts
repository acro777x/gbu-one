/**
 * GBU One — S12 Timetable Source State Machine
 *
 * Implements the deterministic S12 Timetable Source lifecycle:
 *   'idle' -> 'loading' -> 'live' | 'cached' | 'sample' | 'error'
 *
 * Reflects the timetable resolution engine:
 * 1. Live schedule matrix from university Samay API / Supabase
 * 2. SQLite local offline snapshot with room-diff change detection
 * 3. Bundled offline mock schedule for initial onboarding or fallback
 * 4. Honest error state with retry support when no data exists
 */

import type { InvariantValidationResult, TransitionResult } from './types';

export type TimetableMachineStateValue =
  | 'idle'
  | 'loading'
  | 'live'
  | 'cached'
  | 'sample'
  | 'error';

export interface TimetableMachineContext {
  classKey: string | null;
  slotsCount: number;
  detectedChangesCount: number;
  lastSyncedAt: number | null;
  cacheTimestamp: number | null;
  isStale: boolean;
  errorMessage: string | null;
  retryCount: number;
}

export interface TimetableMachineState {
  value: TimetableMachineStateValue;
  context: TimetableMachineContext;
}

export type TimetableMachineEvent =
  | {
      type: 'REQUEST_TIMETABLE';
      payload: { classKey: string };
    }
  | {
      type: 'RECEIVE_LIVE';
      payload: {
        slotsCount: number;
        detectedChangesCount?: number;
        timestamp?: number;
      };
    }
  | {
      type: 'RECEIVE_CACHE';
      payload: {
        slotsCount: number;
        cacheTimestamp?: number;
        isStale?: boolean;
      };
    }
  | {
      type: 'RECEIVE_SAMPLE';
      payload: {
        slotsCount: number;
        reason?: string;
      };
    }
  | {
      type: 'REQUEST_FAIL';
      payload: { error: string };
    }
  | {
      type: 'SWITCH_CLASS';
      payload: { classKey: string };
    }
  | {
      type: 'SYNC_LIVE';
      payload: {
        slotsCount: number;
        detectedChangesCount?: number;
        timestamp?: number;
      };
    }
  | { type: 'RETRY' }
  | { type: 'CLEAR' }
  | { type: 'CLEAR_ERROR' };

export type TimetableMachineEventType = TimetableMachineEvent['type'];

export function createInitialTimetableContext(
  overrides?: Partial<TimetableMachineContext>,
): TimetableMachineContext {
  return {
    classKey: null,
    slotsCount: 0,
    detectedChangesCount: 0,
    lastSyncedAt: null,
    cacheTimestamp: null,
    isStale: false,
    errorMessage: null,
    retryCount: 0,
    ...overrides,
  };
}

export function createInitialTimetableState(
  initialValue: TimetableMachineStateValue = 'idle',
  contextOverrides?: Partial<TimetableMachineContext>,
): TimetableMachineState {
  return {
    value: initialValue,
    context: createInitialTimetableContext(contextOverrides),
  };
}

export function canTransitionTimetable(
  from: TimetableMachineState | TimetableMachineStateValue,
  eventType: TimetableMachineEventType,
): boolean {
  const stateVal = typeof from === 'string' ? from : from.value;

  switch (stateVal) {
    case 'idle':
      return [
        'REQUEST_TIMETABLE',
        'RECEIVE_CACHE',
        'RECEIVE_SAMPLE',
        'CLEAR',
        'CLEAR_ERROR',
      ].includes(eventType);

    case 'loading':
      return [
        'RECEIVE_LIVE',
        'RECEIVE_CACHE',
        'RECEIVE_SAMPLE',
        'REQUEST_FAIL',
        'SWITCH_CLASS',
        'CLEAR',
        'CLEAR_ERROR',
      ].includes(eventType);

    case 'live':
      return [
        'REQUEST_TIMETABLE',
        'SWITCH_CLASS',
        'RECEIVE_CACHE',
        'CLEAR',
        'CLEAR_ERROR',
      ].includes(eventType);

    case 'cached':
      return [
        'REQUEST_TIMETABLE',
        'SWITCH_CLASS',
        'SYNC_LIVE',
        'RECEIVE_SAMPLE',
        'CLEAR',
        'CLEAR_ERROR',
      ].includes(eventType);

    case 'sample':
      return [
        'REQUEST_TIMETABLE',
        'SWITCH_CLASS',
        'SYNC_LIVE',
        'RECEIVE_CACHE',
        'CLEAR',
        'CLEAR_ERROR',
      ].includes(eventType);

    case 'error':
      return [
        'RETRY',
        'REQUEST_TIMETABLE',
        'SWITCH_CLASS',
        'RECEIVE_CACHE',
        'RECEIVE_SAMPLE',
        'CLEAR',
        'CLEAR_ERROR',
      ].includes(eventType);

    default:
      return false;
  }
}

export function timetableMachineReducer(
  state: TimetableMachineState,
  event: TimetableMachineEvent,
): TimetableMachineState {
  const { value, context } = state;

  if (!canTransitionTimetable(state, event.type)) {
    return {
      value,
      context: {
        ...context,
        errorMessage: `Invalid timetable transition: cannot process '${event.type}' from state '${value}'`,
      },
    };
  }

  switch (value) {
    case 'idle': {
      switch (event.type) {
        case 'REQUEST_TIMETABLE':
          return {
            value: 'loading',
            context: {
              ...context,
              classKey: event.payload.classKey,
              errorMessage: null,
            },
          };

        case 'RECEIVE_CACHE':
          return {
            value: 'cached',
            context: {
              ...context,
              slotsCount: event.payload.slotsCount,
              cacheTimestamp: event.payload.cacheTimestamp ?? Date.now(),
              isStale: event.payload.isStale ?? false,
              errorMessage: null,
            },
          };

        case 'RECEIVE_SAMPLE':
          return {
            value: 'sample',
            context: {
              ...context,
              slotsCount: event.payload.slotsCount,
              errorMessage: null,
            },
          };

        case 'CLEAR':
          return createInitialTimetableState('idle');

        case 'CLEAR_ERROR':
          return { value: 'idle', context: { ...context, errorMessage: null } };
      }
      break;
    }

    case 'loading': {
      switch (event.type) {
        case 'RECEIVE_LIVE':
          return {
            value: 'live',
            context: {
              ...context,
              slotsCount: event.payload.slotsCount,
              detectedChangesCount: event.payload.detectedChangesCount ?? 0,
              lastSyncedAt: event.payload.timestamp ?? Date.now(),
              isStale: false,
              retryCount: 0,
              errorMessage: null,
            },
          };

        case 'RECEIVE_CACHE':
          return {
            value: 'cached',
            context: {
              ...context,
              slotsCount: event.payload.slotsCount,
              cacheTimestamp: event.payload.cacheTimestamp ?? Date.now(),
              isStale: event.payload.isStale ?? false,
              errorMessage: null,
            },
          };

        case 'RECEIVE_SAMPLE':
          return {
            value: 'sample',
            context: {
              ...context,
              slotsCount: event.payload.slotsCount,
              errorMessage: event.payload.reason ?? null,
            },
          };

        case 'REQUEST_FAIL':
          return {
            value: 'error',
            context: {
              ...context,
              errorMessage: event.payload.error,
              retryCount: context.retryCount + 1,
            },
          };

        case 'SWITCH_CLASS':
          return {
            value: 'loading',
            context: {
              ...context,
              classKey: event.payload.classKey,
              slotsCount: 0,
              detectedChangesCount: 0,
              errorMessage: null,
            },
          };

        case 'CLEAR':
          return createInitialTimetableState('idle');

        case 'CLEAR_ERROR':
          return { value: 'loading', context: { ...context, errorMessage: null } };
      }
      break;
    }

    case 'live': {
      switch (event.type) {
        case 'REQUEST_TIMETABLE':
        case 'SWITCH_CLASS':
          return {
            value: 'loading',
            context: {
              ...context,
              classKey: event.payload.classKey,
              errorMessage: null,
            },
          };

        case 'RECEIVE_CACHE':
          return {
            value: 'cached',
            context: {
              ...context,
              slotsCount: event.payload.slotsCount,
              cacheTimestamp: event.payload.cacheTimestamp ?? context.cacheTimestamp ?? Date.now(),
              isStale: event.payload.isStale ?? true,
            },
          };

        case 'CLEAR':
          return createInitialTimetableState('idle');

        case 'CLEAR_ERROR':
          return { value: 'live', context: { ...context, errorMessage: null } };
      }
      break;
    }

    case 'cached': {
      switch (event.type) {
        case 'REQUEST_TIMETABLE':
        case 'SWITCH_CLASS':
          return {
            value: 'loading',
            context: {
              ...context,
              classKey: event.payload.classKey,
              errorMessage: null,
            },
          };

        case 'SYNC_LIVE':
          return {
            value: 'live',
            context: {
              ...context,
              slotsCount: event.payload.slotsCount,
              detectedChangesCount: event.payload.detectedChangesCount ?? 0,
              lastSyncedAt: event.payload.timestamp ?? Date.now(),
              isStale: false,
              retryCount: 0,
              errorMessage: null,
            },
          };

        case 'RECEIVE_SAMPLE':
          return {
            value: 'sample',
            context: {
              ...context,
              slotsCount: event.payload.slotsCount,
              errorMessage: event.payload.reason ?? null,
            },
          };

        case 'CLEAR':
          return createInitialTimetableState('idle');

        case 'CLEAR_ERROR':
          return { value: 'cached', context: { ...context, errorMessage: null } };
      }
      break;
    }

    case 'sample': {
      switch (event.type) {
        case 'REQUEST_TIMETABLE':
        case 'SWITCH_CLASS':
          return {
            value: 'loading',
            context: {
              ...context,
              classKey: event.payload.classKey,
              errorMessage: null,
            },
          };

        case 'SYNC_LIVE':
          return {
            value: 'live',
            context: {
              ...context,
              slotsCount: event.payload.slotsCount,
              detectedChangesCount: event.payload.detectedChangesCount ?? 0,
              lastSyncedAt: event.payload.timestamp ?? Date.now(),
              isStale: false,
              retryCount: 0,
              errorMessage: null,
            },
          };

        case 'RECEIVE_CACHE':
          return {
            value: 'cached',
            context: {
              ...context,
              slotsCount: event.payload.slotsCount,
              cacheTimestamp: event.payload.cacheTimestamp ?? Date.now(),
              isStale: event.payload.isStale ?? false,
              errorMessage: null,
            },
          };

        case 'CLEAR':
          return createInitialTimetableState('idle');

        case 'CLEAR_ERROR':
          return { value: 'sample', context: { ...context, errorMessage: null } };
      }
      break;
    }

    case 'error': {
      switch (event.type) {
        case 'RETRY':
          return {
            value: 'loading',
            context: {
              ...context,
              errorMessage: null,
            },
          };

        case 'REQUEST_TIMETABLE':
        case 'SWITCH_CLASS':
          return {
            value: 'loading',
            context: {
              ...context,
              classKey: event.payload.classKey,
              errorMessage: null,
            },
          };

        case 'RECEIVE_CACHE':
          return {
            value: 'cached',
            context: {
              ...context,
              slotsCount: event.payload.slotsCount,
              cacheTimestamp: event.payload.cacheTimestamp ?? Date.now(),
              isStale: event.payload.isStale ?? false,
              errorMessage: null,
            },
          };

        case 'RECEIVE_SAMPLE':
          return {
            value: 'sample',
            context: {
              ...context,
              slotsCount: event.payload.slotsCount,
              errorMessage: null,
            },
          };

        case 'CLEAR':
          return createInitialTimetableState('idle');

        case 'CLEAR_ERROR':
          return { value: 'error', context: { ...context, errorMessage: null } };
      }
      break;
    }
  }

  return state;
}

export function transitionTimetable(
  state: TimetableMachineState,
  event: TimetableMachineEvent,
): TransitionResult<TimetableMachineState> {
  if (!canTransitionTimetable(state, event.type)) {
    const errorMsg = `Invalid timetable transition: cannot process '${event.type}' from state '${state.value}'`;
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

  const nextState = timetableMachineReducer(state, event);
  return {
    ok: true,
    state: nextState,
  };
}

export function validateTimetableInvariants(
  state: TimetableMachineState,
): InvariantValidationResult {
  const violations: string[] = [];
  const { value, context } = state;

  if (value === 'live') {
    if (context.slotsCount < 0) {
      violations.push("State is 'live' but slotsCount is negative");
    }
    if (!context.lastSyncedAt) {
      violations.push("State is 'live' but lastSyncedAt timestamp is missing");
    }
  }

  if (value === 'cached') {
    if (context.slotsCount < 0) {
      violations.push("State is 'cached' but slotsCount is negative");
    }
    if (!context.cacheTimestamp) {
      violations.push("State is 'cached' but cacheTimestamp is missing");
    }
  }

  if (value === 'sample') {
    if (context.slotsCount <= 0) {
      violations.push("State is 'sample' but slotsCount is not positive");
    }
  }

  if (value === 'error') {
    if (!context.errorMessage) {
      violations.push("State is 'error' but errorMessage is missing");
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}
