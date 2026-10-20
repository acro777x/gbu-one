/**
 * Pure push-registration policy for GBU One.
 *
 * Kept free of native imports (expo-notifications / expo-device) so the
 * decision logic can be unit tested in Node.
 */
import { normaliseClassKey } from './classKey';

/** Android channel used for timetable-change pushes (docs/NOTIFICATIONS.md). */
export const TIMETABLE_CHANNEL_ID = 'timetable_changes';

/** Profile preference that gates timetable pushes (see app/(tabs)/profile.tsx). */
export const TIMETABLE_PUSH_PREF_KEY = '@gbu_one_notify_timetable';

export type PushSkipReason =
  | 'supabase-not-configured'
  | 'web-not-supported'
  | 'not-a-physical-device'
  | 'permission-denied'
  | 'missing-eas-project-id'
  | 'token-failed'
  | 'save-failed';

export type PushRegistrationResult =
  | { registered: true; token: string }
  | { registered: false; reason: PushSkipReason };

export interface DeviceTokenRow {
  token: string;
  platform: string;
  class_key: string | null;
  user_id: string | null;
}

/**
 * Resolves the EAS project id from app config.
 * `extra.eas.projectId` wins over the build-time `easConfig.projectId`.
 */
export function resolveEasProjectId(sources: {
  extraProjectId?: string | null;
  easConfigProjectId?: string | null;
}): string | null {
  const fromExtra = (sources.extraProjectId || '').trim();
  if (fromExtra) return fromExtra;
  const fromEas = (sources.easConfigProjectId || '').trim();
  if (fromEas) return fromEas;
  return null;
}

/** Supabase user ids are UUIDs; local mock ids (e.g. `usr_1234`) are not. */
export function isValidSupabaseUserId(id?: string | null): boolean {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

/**
 * Preconditions that must hold before we ask the OS for a push token.
 * Returns a skip reason instead of throwing so the app can start anyway.
 */
export function canAttemptRegistration(input: {
  supabaseConfigured: boolean;
  platform: string;
  isDevice: boolean;
}): { ok: true } | { ok: false; reason: PushSkipReason } {
  if (!input.supabaseConfigured) return { ok: false, reason: 'supabase-not-configured' };
  if (input.platform === 'web') return { ok: false, reason: 'web-not-supported' };
  if ((input.platform === 'android' || input.platform === 'ios') && !input.isDevice) {
    return { ok: false, reason: 'not-a-physical-device' };
  }
  return { ok: true };
}

/** Builds the `device_tokens` upsert payload for this device. */
export function buildDeviceTokenRow(input: {
  token: string;
  platform: string;
  classKey?: string | null;
  userId?: string | null;
}): DeviceTokenRow {
  const classKey = normaliseClassKey(input.classKey);
  return {
    token: input.token,
    platform: input.platform,
    class_key: classKey.length > 0 ? classKey : null,
    user_id: isValidSupabaseUserId(input.userId) ? (input.userId as string) : null,
  };
}

/**
 * Class targeting is what opts a device into timetable-change pushes.
 * With the Profile toggle off the token stays registered (so notice pushes
 * still reach it) but it carries no class key, so it is never targeted.
 */
export function resolveClassKeyForRow(
  classKey: string | null | undefined,
  timetablePushEnabled: boolean,
): string | null {
  if (!timetablePushEnabled) return null;
  const normalised = normaliseClassKey(classKey);
  return normalised.length > 0 ? normalised : null;
}

