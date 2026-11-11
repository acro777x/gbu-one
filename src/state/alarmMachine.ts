/**
 * GBU One — S8 Class Alarm State Machine
 *
 * Implements the deterministic S8 Class Alarm lifecycle:
 *   'idle' -> 'scheduled' -> 'firing' -> 'snoozed' | 'dismissed' | 'missed'
 *
 * Connects with `src/features/notifications/useClassAlarmLifecycle.ts`:
 * - Schedules alarms before class start based on lead minutes (e.g., 10 min).
 * - Manages audible ringing / firing state.
 * - Handles snooze limits (e.g., maximum 3 snoozes before mandatory action).
 * - Tracks missed alarms if the window expires unanswered.
 */

import type { InvariantValidationResult, TransitionResult } from './types';

export type AlarmMachineStateValue =
  | 'idle'
  | 'scheduled'
  | 'firing'
  | 'snoozed'
  | 'dismissed'
  | 'missed';

export interface AlarmMachineContext {
  slotId: string | null;
  subjectCode: string | null;
  subjectName: string | null;
  roomName: string | null;
  notificationId: string | null;
  scheduledTime: number | null; // target fire timestamp (epoch ms)
  leadMinutes: number; // minutes before class start
  firingStartedAt: number | null;
  snoozeCount: number;
  maxSnoozes: number;
  snoozeDurationMinutes: number;
  snoozedUntil: number | null;
  dismissedAt: number | null;
  missedAt: number | null;
  errorMessage: string | null;
}

export interface AlarmMachineState {
  value: AlarmMachineStateValue;
  context: AlarmMachineContext;
}

export type AlarmMachineEvent =
  | {
      type: 'SCHEDULE';
      payload: {
        slotId: string;
        subjectCode: string;
        subjectName?: string;
        roomName?: string;
        scheduledTime: number;
        leadMinutes?: number;
        notificationId?: string;
      };
    }
  | {
      type: 'RESCHEDULE';
      payload: {
        scheduledTime: number;
        leadMinutes?: number;
        notificationId?: string;
      };
    }
  | { type: 'CANCEL' }
  | { type: 'TRIGGER_FIRE'; payload?: { firedAt?: number } }
  | { type: 'SNOOZE'; payload?: { durationMinutes?: number; now?: number } }
  | { type: 'DISMISS'; payload?: { dismissedAt?: number } }
  | { type: 'TIME_OUT_MISSED'; payload?: { missedAt?: number; reason?: string } }
  | { type: 'ACKNOWLEDGE_MISSED' }
  | { type: 'RESET' }
  | { type: 'CLEAR_ERROR' };

export type AlarmMachineEventType = AlarmMachineEvent['type'];

const DEFAULT_LEAD_MINUTES = 10;
const DEFAULT_SNOOZE_MINUTES = 5;
const DEFAULT_MAX_SNOOZES = 3;

export function createInitialAlarmContext(
  overrides?: Partial<AlarmMachineContext>,
): AlarmMachineContext {
  return {
    slotId: null,
    subjectCode: null,
    subjectName: null,
    roomName: null,
    notificationId: null,
    scheduledTime: null,
    leadMinutes: DEFAULT_LEAD_MINUTES,
    firingStartedAt: null,
    snoozeCount: 0,
    maxSnoozes: DEFAULT_MAX_SNOOZES,
    snoozeDurationMinutes: DEFAULT_SNOOZE_MINUTES,
    snoozedUntil: null,
    dismissedAt: null,
    missedAt: null,
    errorMessage: null,
    ...overrides,
  };
}

export function createInitialAlarmState(
  initialValue: AlarmMachineStateValue = 'idle',
  contextOverrides?: Partial<AlarmMachineContext>,
): AlarmMachineState {
  return {
    value: initialValue,
    context: createInitialAlarmContext(contextOverrides),
  };
}

export function canTransitionAlarm(
  from: AlarmMachineState | AlarmMachineStateValue,
  eventType: AlarmMachineEventType,
): boolean {
  const stateVal = typeof from === 'string' ? from : from.value;

  switch (stateVal) {
    case 'idle':
      return ['SCHEDULE', 'CLEAR_ERROR'].includes(eventType);

    case 'scheduled':
      return [
        'TRIGGER_FIRE',
        'CANCEL',
        'RESCHEDULE',
        'TIME_OUT_MISSED',
        'DISMISS',
        'CLEAR_ERROR',
      ].includes(eventType);

    case 'firing':
      return ['SNOOZE', 'DISMISS', 'TIME_OUT_MISSED', 'CLEAR_ERROR'].includes(eventType);

    case 'snoozed':
      return [
        'TRIGGER_FIRE',
        'DISMISS',
        'CANCEL',
        'TIME_OUT_MISSED',
        'CLEAR_ERROR',
      ].includes(eventType);

    case 'dismissed':
      return ['SCHEDULE', 'RESET', 'CLEAR_ERROR'].includes(eventType);

    case 'missed':
      return ['ACKNOWLEDGE_MISSED', 'SCHEDULE', 'RESET', 'CLEAR_ERROR'].includes(eventType);

    default:
      return false;
  }
}

export function alarmMachineReducer(
  state: AlarmMachineState,
  event: AlarmMachineEvent,
): AlarmMachineState {
  const { value, context } = state;

  if (!canTransitionAlarm(state, event.type)) {
    return {
      value,
      context: {
        ...context,
        errorMessage: `Invalid alarm transition: cannot process '${event.type}' from state '${value}'`,
      },
    };
  }

  switch (value) {
    case 'idle': {
      if (event.type === 'SCHEDULE') {
        return {
          value: 'scheduled',
          context: {
            ...context,
            slotId: event.payload.slotId,
            subjectCode: event.payload.subjectCode,
            subjectName: event.payload.subjectName ?? null,
            roomName: event.payload.roomName ?? null,
            scheduledTime: event.payload.scheduledTime,
            leadMinutes: event.payload.leadMinutes ?? DEFAULT_LEAD_MINUTES,
            notificationId: event.payload.notificationId ?? null,
            snoozeCount: 0,
            snoozedUntil: null,
            firingStartedAt: null,
            dismissedAt: null,
            missedAt: null,
            errorMessage: null,
          },
        };
      }
      if (event.type === 'CLEAR_ERROR') {
        return { value: 'idle', context: { ...context, errorMessage: null } };
      }
      break;
    }

    case 'scheduled': {
      switch (event.type) {
        case 'TRIGGER_FIRE': {
          const firedAt = event.payload?.firedAt ?? Date.now();
          return {
            value: 'firing',
            context: {
              ...context,
              firingStartedAt: firedAt,
              errorMessage: null,
            },
          };
        }

        case 'CANCEL':
          return {
            value: 'idle',
            context: createInitialAlarmContext(),
          };

        case 'RESCHEDULE':
          return {
            value: 'scheduled',
            context: {
              ...context,
              scheduledTime: event.payload.scheduledTime,
              leadMinutes: event.payload.leadMinutes ?? context.leadMinutes,
              notificationId: event.payload.notificationId ?? context.notificationId,
              errorMessage: null,
            },
          };

        case 'DISMISS':
          return {
            value: 'dismissed',
            context: {
              ...context,
              dismissedAt: event.payload?.dismissedAt ?? Date.now(),
              errorMessage: null,
            },
          };

        case 'TIME_OUT_MISSED':
          return {
            value: 'missed',
            context: {
              ...context,
              missedAt: event.payload?.missedAt ?? Date.now(),
              errorMessage: event.payload?.reason ?? 'Class time has passed',
            },
          };

        case 'CLEAR_ERROR':
          return { value: 'scheduled', context: { ...context, errorMessage: null } };
      }
      break;
    }

    case 'firing': {
      switch (event.type) {
        case 'SNOOZE': {
          if (context.snoozeCount >= context.maxSnoozes) {
            return {
              value: 'firing',
              context: {
                ...context,
                errorMessage: `Maximum snooze limit (${context.maxSnoozes}) reached`,
              },
            };
          }

          const now = event.payload?.now ?? Date.now();
          const duration = event.payload?.durationMinutes ?? context.snoozeDurationMinutes;
          const snoozedUntil = now + duration * 60 * 1000;

          return {
            value: 'snoozed',
            context: {
              ...context,
              snoozeCount: context.snoozeCount + 1,
              snoozeDurationMinutes: duration,
              snoozedUntil,
              firingStartedAt: null,
              errorMessage: null,
            },
          };
        }

        case 'DISMISS':
          return {
            value: 'dismissed',
            context: {
              ...context,
              dismissedAt: event.payload?.dismissedAt ?? Date.now(),
              firingStartedAt: null,
              errorMessage: null,
            },
          };

        case 'TIME_OUT_MISSED':
          return {
            value: 'missed',
            context: {
              ...context,
              missedAt: event.payload?.missedAt ?? Date.now(),
              firingStartedAt: null,
              errorMessage: event.payload?.reason ?? 'Alarm unanswered',
            },
          };

        case 'CLEAR_ERROR':
          return { value: 'firing', context: { ...context, errorMessage: null } };
      }
      break;
    }

    case 'snoozed': {
      switch (event.type) {
        case 'TRIGGER_FIRE': {
          const firedAt = event.payload?.firedAt ?? Date.now();
          return {
            value: 'firing',
            context: {
              ...context,
              firingStartedAt: firedAt,
              snoozedUntil: null,
              errorMessage: null,
            },
          };
        }

        case 'DISMISS':
          return {
            value: 'dismissed',
            context: {
              ...context,
              dismissedAt: event.payload?.dismissedAt ?? Date.now(),
              snoozedUntil: null,
              errorMessage: null,
            },
          };

        case 'CANCEL':
          return {
            value: 'idle',
            context: createInitialAlarmContext(),
          };

        case 'TIME_OUT_MISSED':
          return {
            value: 'missed',
            context: {
              ...context,
              missedAt: event.payload?.missedAt ?? Date.now(),
              snoozedUntil: null,
              errorMessage: event.payload?.reason ?? 'Alarm expired during snooze',
            },
          };

        case 'CLEAR_ERROR':
          return { value: 'snoozed', context: { ...context, errorMessage: null } };
      }
      break;
    }

    case 'dismissed': {
      switch (event.type) {
        case 'SCHEDULE':
          return {
            value: 'scheduled',
            context: {
              ...createInitialAlarmContext(),
              slotId: event.payload.slotId,
              subjectCode: event.payload.subjectCode,
              subjectName: event.payload.subjectName ?? null,
              roomName: event.payload.roomName ?? null,
              scheduledTime: event.payload.scheduledTime,
              leadMinutes: event.payload.leadMinutes ?? DEFAULT_LEAD_MINUTES,
              notificationId: event.payload.notificationId ?? null,
            },
          };

        case 'RESET':
          return {
            value: 'idle',
            context: createInitialAlarmContext(),
          };

        case 'CLEAR_ERROR':
          return { value: 'dismissed', context: { ...context, errorMessage: null } };
      }
      break;
    }

    case 'missed': {
      switch (event.type) {
        case 'ACKNOWLEDGE_MISSED':
        case 'RESET':
          return {
            value: 'idle',
            context: createInitialAlarmContext(),
          };

        case 'SCHEDULE':
          return {
            value: 'scheduled',
            context: {
              ...createInitialAlarmContext(),
              slotId: event.payload.slotId,
              subjectCode: event.payload.subjectCode,
              subjectName: event.payload.subjectName ?? null,
              roomName: event.payload.roomName ?? null,
              scheduledTime: event.payload.scheduledTime,
              leadMinutes: event.payload.leadMinutes ?? DEFAULT_LEAD_MINUTES,
              notificationId: event.payload.notificationId ?? null,
            },
          };

        case 'CLEAR_ERROR':
          return { value: 'missed', context: { ...context, errorMessage: null } };
      }
      break;
    }
  }

  return state;
}

export function transitionAlarm(
  state: AlarmMachineState,
  event: AlarmMachineEvent,
): TransitionResult<AlarmMachineState> {
  if (!canTransitionAlarm(state, event.type)) {
    const errorMsg = `Invalid alarm transition: cannot process '${event.type}' from state '${state.value}'`;
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

  // Guard for max snoozes
  if (state.value === 'firing' && event.type === 'SNOOZE') {
    if (state.context.snoozeCount >= state.context.maxSnoozes) {
      const errorMsg = `Cannot snooze: max snoozes (${state.context.maxSnoozes}) reached`;
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
  }

  const nextState = alarmMachineReducer(state, event);
  return {
    ok: true,
    state: nextState,
  };
}

export function validateAlarmInvariants(state: AlarmMachineState): InvariantValidationResult {
  const violations: string[] = [];
  const { value, context } = state;

  if (value === 'scheduled') {
    if (!context.slotId) violations.push("State is 'scheduled' but slotId is missing");
    if (!context.scheduledTime || !Number.isFinite(context.scheduledTime)) {
      violations.push("State is 'scheduled' but scheduledTime is invalid");
    }
  }

  if (value === 'firing') {
    if (!context.firingStartedAt) {
      violations.push("State is 'firing' but firingStartedAt timestamp is missing");
    }
  }

  if (value === 'snoozed') {
    if (context.snoozeCount <= 0) {
      violations.push("State is 'snoozed' but snoozeCount is not positive");
    }
    if (!context.snoozedUntil) {
      violations.push("State is 'snoozed' but snoozedUntil is missing");
    }
  }

  if (value === 'dismissed') {
    if (!context.dismissedAt) {
      violations.push("State is 'dismissed' but dismissedAt is missing");
    }
  }

  if (value === 'missed') {
    if (!context.missedAt) {
      violations.push("State is 'missed' but missedAt is missing");
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}
