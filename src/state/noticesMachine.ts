/**
 * GBU One — S11 Notices Source State Machine
 *
 * Implements the deterministic S11 Notices Source lifecycle:
 *   'idle' -> 'loading' -> 'live' | 'cached' | 'sample' | 'error'
 *
 * Models the multi-tier data resolution flow:
 * 1. Live notices directly from public GBU portals (gbu.ac.in, exams.gbu.ac.in)
 * 2. SQLite / MMKV local offline cache when offline or network fails
 * 3. Bundled sample / mock fallback (honestly labelled as sample data)
 * 4. Error state with explicit retry capability
 */

import type { InvariantValidationResult, TransitionResult } from './types';

export type NoticesMachineStateValue =
  | 'idle'
  | 'loading'
  | 'live'
  | 'cached'
  | 'sample'
  | 'error';

export interface NoticesMachineContext {
  itemCount: number;
  sources: string[];
  lastSyncedAt: number | null;
  cacheTimestamp: number | null;
  sampleNoticeCount: number;
  errorMessage: string | null;
  retryCount: number;
  schoolFilter: string | null;
  categoryFilter: string | null;
}

export interface NoticesMachineState {
  value: NoticesMachineStateValue;
  context: NoticesMachineContext;
}

export type NoticesMachineEvent =
  | {
      type: 'FETCH_START';
      payload?: { sources?: string[]; schoolFilter?: string; categoryFilter?: string };
    }
  | {
      type: 'RECEIVE_LIVE';
      payload: { itemCount: number; sources?: string[]; timestamp?: number };
    }
  | {
      type: 'RECEIVE_CACHE';
      payload: { itemCount: number; cacheTimestamp?: number; reason?: string };
    }
  | {
      type: 'RECEIVE_SAMPLE';
      payload: { sampleNoticeCount: number; reason?: string };
    }
  | {
      type: 'FETCH_FAIL';
      payload: { error: string };
    }
  | {
      type: 'FALLBACK_CACHE';
      payload?: { itemCount?: number; cacheTimestamp?: number };
    }
  | {
      type: 'EXPIRE_SAMPLE';
      payload?: { sampleNoticeCount?: number };
    }
  | {
      type: 'SYNC_LIVE';
      payload: { itemCount: number; sources?: string[]; timestamp?: number };
    }
  | { type: 'RETRY' }
  | { type: 'CLEAR' }
  | { type: 'CLEAR_ERROR' };

export type NoticesMachineEventType = NoticesMachineEvent['type'];

export function createInitialNoticesContext(
  overrides?: Partial<NoticesMachineContext>,
): NoticesMachineContext {
  return {
    itemCount: 0,
    sources: [],
    lastSyncedAt: null,
    cacheTimestamp: null,
    sampleNoticeCount: 0,
    errorMessage: null,
    retryCount: 0,
    schoolFilter: null,
    categoryFilter: null,
    ...overrides,
  };
}

export function createInitialNoticesState(
  initialValue: NoticesMachineStateValue = 'idle',
  contextOverrides?: Partial<NoticesMachineContext>,
): NoticesMachineState {
  return {
    value: initialValue,
    context: createInitialNoticesContext(contextOverrides),
  };
}

export function canTransitionNotices(
  from: NoticesMachineState | NoticesMachineStateValue,
  eventType: NoticesMachineEventType,
): boolean {
  const stateVal = typeof from === 'string' ? from : from.value;

  switch (stateVal) {
    case 'idle':
      return [
        'FETCH_START',
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
        'FETCH_FAIL',
        'CLEAR',
        'CLEAR_ERROR',
      ].includes(eventType);

    case 'live':
      return [
        'FETCH_START',
        'FALLBACK_CACHE',
        'RECEIVE_SAMPLE',
        'CLEAR',
        'CLEAR_ERROR',
      ].includes(eventType);

    case 'cached':
      return [
        'FETCH_START',
        'SYNC_LIVE',
        'EXPIRE_SAMPLE',
        'RECEIVE_SAMPLE',
        'CLEAR',
        'CLEAR_ERROR',
      ].includes(eventType);

    case 'sample':
      return [
        'FETCH_START',
        'SYNC_LIVE',
        'RECEIVE_CACHE',
        'CLEAR',
        'CLEAR_ERROR',
      ].includes(eventType);

    case 'error':
      return [
        'RETRY',
        'FETCH_START',
        'RECEIVE_CACHE',
        'RECEIVE_SAMPLE',
        'CLEAR',
        'CLEAR_ERROR',
      ].includes(eventType);

    default:
      return false;
  }
}

export function noticesMachineReducer(
  state: NoticesMachineState,
  event: NoticesMachineEvent,
): NoticesMachineState {
  const { value, context } = state;

  if (!canTransitionNotices(state, event.type)) {
    return {
      value,
      context: {
        ...context,
        errorMessage: `Invalid notices transition: cannot process '${event.type}' from state '${value}'`,
      },
    };
  }

  switch (value) {
    case 'idle': {
      switch (event.type) {
        case 'FETCH_START':
          return {
            value: 'loading',
            context: {
              ...context,
              sources: event.payload?.sources ?? ['gbu.ac.in', 'exams.gbu.ac.in'],
              schoolFilter: event.payload?.schoolFilter ?? context.schoolFilter,
              categoryFilter: event.payload?.categoryFilter ?? context.categoryFilter,
              errorMessage: null,
            },
          };

        case 'RECEIVE_CACHE':
          return {
            value: 'cached',
            context: {
              ...context,
              itemCount: event.payload.itemCount,
              cacheTimestamp: event.payload.cacheTimestamp ?? Date.now(),
              errorMessage: null,
            },
          };

        case 'RECEIVE_SAMPLE':
          return {
            value: 'sample',
            context: {
              ...context,
              sampleNoticeCount: event.payload.sampleNoticeCount,
              errorMessage: null,
            },
          };

        case 'CLEAR':
          return createInitialNoticesState('idle');

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
              itemCount: event.payload.itemCount,
              sources: event.payload.sources ?? context.sources,
              lastSyncedAt: event.payload.timestamp ?? Date.now(),
              retryCount: 0,
              errorMessage: null,
            },
          };

        case 'RECEIVE_CACHE':
          return {
            value: 'cached',
            context: {
              ...context,
              itemCount: event.payload.itemCount,
              cacheTimestamp: event.payload.cacheTimestamp ?? Date.now(),
              errorMessage: event.payload.reason ?? null,
            },
          };

        case 'RECEIVE_SAMPLE':
          return {
            value: 'sample',
            context: {
              ...context,
              sampleNoticeCount: event.payload.sampleNoticeCount,
              errorMessage: event.payload.reason ?? null,
            },
          };

        case 'FETCH_FAIL':
          return {
            value: 'error',
            context: {
              ...context,
              errorMessage: event.payload.error,
              retryCount: context.retryCount + 1,
            },
          };

        case 'CLEAR':
          return createInitialNoticesState('idle');

        case 'CLEAR_ERROR':
          return { value: 'loading', context: { ...context, errorMessage: null } };
      }
      break;
    }

    case 'live': {
      switch (event.type) {
        case 'FETCH_START':
          return {
            value: 'loading',
            context: {
              ...context,
              errorMessage: null,
            },
          };

        case 'FALLBACK_CACHE':
          return {
            value: 'cached',
            context: {
              ...context,
              itemCount: event.payload?.itemCount ?? context.itemCount,
              cacheTimestamp: event.payload?.cacheTimestamp ?? context.cacheTimestamp ?? Date.now(),
            },
          };

        case 'RECEIVE_SAMPLE':
          return {
            value: 'sample',
            context: {
              ...context,
              sampleNoticeCount: event.payload.sampleNoticeCount,
            },
          };

        case 'CLEAR':
          return createInitialNoticesState('idle');

        case 'CLEAR_ERROR':
          return { value: 'live', context: { ...context, errorMessage: null } };
      }
      break;
    }

    case 'cached': {
      switch (event.type) {
        case 'FETCH_START':
          return {
            value: 'loading',
            context: {
              ...context,
              errorMessage: null,
            },
          };

        case 'SYNC_LIVE':
          return {
            value: 'live',
            context: {
              ...context,
              itemCount: event.payload.itemCount,
              sources: event.payload.sources ?? context.sources,
              lastSyncedAt: event.payload.timestamp ?? Date.now(),
              retryCount: 0,
              errorMessage: null,
            },
          };

        case 'EXPIRE_SAMPLE':
        case 'RECEIVE_SAMPLE':
          return {
            value: 'sample',
            context: {
              ...context,
              sampleNoticeCount:
                event.type === 'RECEIVE_SAMPLE'
                  ? event.payload.sampleNoticeCount
                  : (event.payload?.sampleNoticeCount ?? (context.sampleNoticeCount || 10)),
            },
          };

        case 'CLEAR':
          return createInitialNoticesState('idle');

        case 'CLEAR_ERROR':
          return { value: 'cached', context: { ...context, errorMessage: null } };
      }
      break;
    }

    case 'sample': {
      switch (event.type) {
        case 'FETCH_START':
          return {
            value: 'loading',
            context: {
              ...context,
              errorMessage: null,
            },
          };

        case 'SYNC_LIVE':
          return {
            value: 'live',
            context: {
              ...context,
              itemCount: event.payload.itemCount,
              sources: event.payload.sources ?? context.sources,
              lastSyncedAt: event.payload.timestamp ?? Date.now(),
              retryCount: 0,
              errorMessage: null,
            },
          };

        case 'RECEIVE_CACHE':
          return {
            value: 'cached',
            context: {
              ...context,
              itemCount: event.payload.itemCount,
              cacheTimestamp: event.payload.cacheTimestamp ?? Date.now(),
            },
          };

        case 'CLEAR':
          return createInitialNoticesState('idle');

        case 'CLEAR_ERROR':
          return { value: 'sample', context: { ...context, errorMessage: null } };
      }
      break;
    }

    case 'error': {
      switch (event.type) {
        case 'RETRY':
        case 'FETCH_START':
          return {
            value: 'loading',
            context: {
              ...context,
              errorMessage: null,
            },
          };

        case 'RECEIVE_CACHE':
          return {
            value: 'cached',
            context: {
              ...context,
              itemCount: event.payload.itemCount,
              cacheTimestamp: event.payload.cacheTimestamp ?? Date.now(),
              errorMessage: null,
            },
          };

        case 'RECEIVE_SAMPLE':
          return {
            value: 'sample',
            context: {
              ...context,
              sampleNoticeCount: event.payload.sampleNoticeCount,
              errorMessage: null,
            },
          };

        case 'CLEAR':
          return createInitialNoticesState('idle');

        case 'CLEAR_ERROR':
          return { value: 'error', context: { ...context, errorMessage: null } };
      }
      break;
    }
  }

  return state;
}

export function transitionNotices(
  state: NoticesMachineState,
  event: NoticesMachineEvent,
): TransitionResult<NoticesMachineState> {
  if (!canTransitionNotices(state, event.type)) {
    const errorMsg = `Invalid notices transition: cannot process '${event.type}' from state '${state.value}'`;
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

  const nextState = noticesMachineReducer(state, event);
  return {
    ok: true,
    state: nextState,
  };
}

export function validateNoticesInvariants(state: NoticesMachineState): InvariantValidationResult {
  const violations: string[] = [];
  const { value, context } = state;

  if (value === 'live') {
    if (context.itemCount < 0) {
      violations.push("State is 'live' but itemCount is negative");
    }
    if (!context.lastSyncedAt) {
      violations.push("State is 'live' but lastSyncedAt timestamp is missing");
    }
  }

  if (value === 'cached') {
    if (context.itemCount < 0) {
      violations.push("State is 'cached' but itemCount is negative");
    }
    if (!context.cacheTimestamp) {
      violations.push("State is 'cached' but cacheTimestamp is missing");
    }
  }

  if (value === 'sample') {
    if (context.sampleNoticeCount <= 0) {
      violations.push("State is 'sample' but sampleNoticeCount is not positive");
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
