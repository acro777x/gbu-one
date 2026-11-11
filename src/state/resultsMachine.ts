/**
 * GBU One — Results Watcher State Machine
 *
 * Implements the deterministic Results Watcher lifecycle:
 *   'idle' -> 'watching' -> 'polling' -> 'notified' | 'error'
 *
 * Integrates with `src/features/exams/resultsWatch.ts`:
 * - Monitors public school result sheet PDF headers (Last-Modified, Content-Length).
 * - Avoids false positives on first look (baseline capture).
 * - Notifies student on verified result publication or revision.
 * - Enforces per-school scoping and persistent watch preferences.
 */

import type { InvariantValidationResult, TransitionResult } from './types';

export type ResultsMachineStateValue =
  | 'idle'
  | 'watching'
  | 'polling'
  | 'notified'
  | 'error';

export interface ResultsMachineContext {
  school: string | null;
  sheetCode: string | null;
  lastCheckedAt: number | null;
  lastModifiedHeader: string | null;
  contentLengthBytes: number | null;
  detectedChangesCount: number;
  lastNotifiedAt: number | null;
  pollIntervalMs: number;
  consecutiveFailures: number;
  errorMessage: string | null;
}

export interface ResultsMachineState {
  value: ResultsMachineStateValue;
  context: ResultsMachineContext;
}

export type ResultsMachineEvent =
  | {
      type: 'START_WATCH';
      payload: {
        school: string;
        sheetCode?: string;
        pollIntervalMs?: number;
        baseline?: {
          lastModified?: string | null;
          bytes?: number | null;
        };
      };
    }
  | { type: 'TRIGGER_POLL' }
  | {
      type: 'POLL_SUCCESS_UNCHANGED';
      payload?: { checkedAt?: number };
    }
  | {
      type: 'POLL_SUCCESS_CHANGED';
      payload: {
        lastModified?: string | null;
        bytes?: number | null;
        detectedAt?: number;
      };
    }
  | {
      type: 'POLL_FAILURE';
      payload: { error: string };
    }
  | { type: 'ACKNOWLEDGE_NOTIFICATION' }
  | { type: 'STOP_WATCH' }
  | { type: 'RETRY' }
  | { type: 'CLEAR_ERROR' };

export type ResultsMachineEventType = ResultsMachineEvent['type'];

const DEFAULT_POLL_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

export function createInitialResultsContext(
  overrides?: Partial<ResultsMachineContext>,
): ResultsMachineContext {
  return {
    school: null,
    sheetCode: null,
    lastCheckedAt: null,
    lastModifiedHeader: null,
    contentLengthBytes: null,
    detectedChangesCount: 0,
    lastNotifiedAt: null,
    pollIntervalMs: DEFAULT_POLL_INTERVAL_MS,
    consecutiveFailures: 0,
    errorMessage: null,
    ...overrides,
  };
}

export function createInitialResultsState(
  initialValue: ResultsMachineStateValue = 'idle',
  contextOverrides?: Partial<ResultsMachineContext>,
): ResultsMachineState {
  return {
    value: initialValue,
    context: createInitialResultsContext(contextOverrides),
  };
}

export function canTransitionResults(
  from: ResultsMachineState | ResultsMachineStateValue,
  eventType: ResultsMachineEventType,
): boolean {
  const stateVal = typeof from === 'string' ? from : from.value;

  switch (stateVal) {
    case 'idle':
      return ['START_WATCH', 'CLEAR_ERROR'].includes(eventType);

    case 'watching':
      return [
        'TRIGGER_POLL',
        'STOP_WATCH',
        'START_WATCH',
        'CLEAR_ERROR',
      ].includes(eventType);

    case 'polling':
      return [
        'POLL_SUCCESS_UNCHANGED',
        'POLL_SUCCESS_CHANGED',
        'POLL_FAILURE',
        'STOP_WATCH',
        'CLEAR_ERROR',
      ].includes(eventType);

    case 'notified':
      return [
        'ACKNOWLEDGE_NOTIFICATION',
        'TRIGGER_POLL',
        'STOP_WATCH',
        'CLEAR_ERROR',
      ].includes(eventType);

    case 'error':
      return [
        'RETRY',
        'TRIGGER_POLL',
        'START_WATCH',
        'STOP_WATCH',
        'CLEAR_ERROR',
      ].includes(eventType);

    default:
      return false;
  }
}

export function resultsMachineReducer(
  state: ResultsMachineState,
  event: ResultsMachineEvent,
): ResultsMachineState {
  const { value, context } = state;

  if (!canTransitionResults(state, event.type)) {
    return {
      value,
      context: {
        ...context,
        errorMessage: `Invalid results transition: cannot process '${event.type}' from state '${value}'`,
      },
    };
  }

  switch (value) {
    case 'idle': {
      if (event.type === 'START_WATCH') {
        return {
          value: 'watching',
          context: {
            ...context,
            school: event.payload.school,
            sheetCode: event.payload.sheetCode ?? null,
            pollIntervalMs: event.payload.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
            lastModifiedHeader: event.payload.baseline?.lastModified ?? null,
            contentLengthBytes: event.payload.baseline?.bytes ?? null,
            consecutiveFailures: 0,
            errorMessage: null,
          },
        };
      }
      if (event.type === 'CLEAR_ERROR') {
        return { value: 'idle', context: { ...context, errorMessage: null } };
      }
      break;
    }

    case 'watching': {
      switch (event.type) {
        case 'TRIGGER_POLL':
          return {
            value: 'polling',
            context: {
              ...context,
              errorMessage: null,
            },
          };

        case 'START_WATCH':
          return {
            value: 'watching',
            context: {
              ...context,
              school: event.payload.school,
              sheetCode: event.payload.sheetCode ?? context.sheetCode,
              pollIntervalMs: event.payload.pollIntervalMs ?? context.pollIntervalMs,
              lastModifiedHeader:
                event.payload.baseline?.lastModified ?? context.lastModifiedHeader,
              contentLengthBytes:
                event.payload.baseline?.bytes ?? context.contentLengthBytes,
              consecutiveFailures: 0,
              errorMessage: null,
            },
          };

        case 'STOP_WATCH':
          return createInitialResultsState('idle');

        case 'CLEAR_ERROR':
          return { value: 'watching', context: { ...context, errorMessage: null } };
      }
      break;
    }

    case 'polling': {
      switch (event.type) {
        case 'POLL_SUCCESS_UNCHANGED':
          return {
            value: 'watching',
            context: {
              ...context,
              lastCheckedAt: event.payload?.checkedAt ?? Date.now(),
              consecutiveFailures: 0,
              errorMessage: null,
            },
          };

        case 'POLL_SUCCESS_CHANGED': {
          const now = event.payload.detectedAt ?? Date.now();
          return {
            value: 'notified',
            context: {
              ...context,
              lastCheckedAt: now,
              lastNotifiedAt: now,
              lastModifiedHeader: event.payload.lastModified ?? context.lastModifiedHeader,
              contentLengthBytes: event.payload.bytes ?? context.contentLengthBytes,
              detectedChangesCount: context.detectedChangesCount + 1,
              consecutiveFailures: 0,
              errorMessage: null,
            },
          };
        }

        case 'POLL_FAILURE':
          return {
            value: 'error',
            context: {
              ...context,
              lastCheckedAt: Date.now(),
              consecutiveFailures: context.consecutiveFailures + 1,
              errorMessage: event.payload.error,
            },
          };

        case 'STOP_WATCH':
          return createInitialResultsState('idle');

        case 'CLEAR_ERROR':
          return { value: 'polling', context: { ...context, errorMessage: null } };
      }
      break;
    }

    case 'notified': {
      switch (event.type) {
        case 'ACKNOWLEDGE_NOTIFICATION':
          return {
            value: 'watching',
            context: {
              ...context,
              errorMessage: null,
            },
          };

        case 'TRIGGER_POLL':
          return {
            value: 'polling',
            context: {
              ...context,
              errorMessage: null,
            },
          };

        case 'STOP_WATCH':
          return createInitialResultsState('idle');

        case 'CLEAR_ERROR':
          return { value: 'notified', context: { ...context, errorMessage: null } };
      }
      break;
    }

    case 'error': {
      switch (event.type) {
        case 'RETRY':
        case 'TRIGGER_POLL':
          return {
            value: 'polling',
            context: {
              ...context,
              errorMessage: null,
            },
          };

        case 'START_WATCH':
          return {
            value: 'watching',
            context: {
              ...context,
              school: event.payload.school,
              sheetCode: event.payload.sheetCode ?? context.sheetCode,
              pollIntervalMs: event.payload.pollIntervalMs ?? context.pollIntervalMs,
              consecutiveFailures: 0,
              errorMessage: null,
            },
          };

        case 'STOP_WATCH':
          return createInitialResultsState('idle');

        case 'CLEAR_ERROR':
          return { value: 'error', context: { ...context, errorMessage: null } };
      }
      break;
    }
  }

  return state;
}

export function transitionResults(
  state: ResultsMachineState,
  event: ResultsMachineEvent,
): TransitionResult<ResultsMachineState> {
  if (!canTransitionResults(state, event.type)) {
    const errorMsg = `Invalid results transition: cannot process '${event.type}' from state '${state.value}'`;
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

  const nextState = resultsMachineReducer(state, event);
  return {
    ok: true,
    state: nextState,
  };
}

export function validateResultsInvariants(state: ResultsMachineState): InvariantValidationResult {
  const violations: string[] = [];
  const { value, context } = state;

  if (value === 'watching' || value === 'polling' || value === 'notified') {
    if (!context.school) {
      violations.push(`State is '${value}' but school identifier is missing`);
    }
  }

  if (value === 'notified') {
    if (!context.lastNotifiedAt) {
      violations.push("State is 'notified' but lastNotifiedAt timestamp is missing");
    }
    if (context.detectedChangesCount <= 0) {
      violations.push("State is 'notified' but detectedChangesCount is not positive");
    }
  }

  if (value === 'error') {
    if (!context.errorMessage) {
      violations.push("State is 'error' but errorMessage is missing");
    }
    if (context.consecutiveFailures <= 0) {
      violations.push("State is 'error' but consecutiveFailures is not positive");
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}
