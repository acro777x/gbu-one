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

/**
 * How a device token row is written to the database.
 *
 * - `insert` - a guest row (no user id). The `device tokens guest insert`
 *   policy allows an INSERT by `anon` with a null owner, and nothing else:
 *   there is no update policy for `anon`. An upsert is an insert that may
 *   turn into an update, so for a guest it is refused by row level security
 *   the moment the token is already in the table.
 * - `upsert` - a signed-in row. The `device tokens own` policy covers the
 *   whole lifecycle for `authenticated`.
 */
export type DeviceTokenWriteMode = 'insert' | 'upsert';

/** Picks the write mode that the row level security policies allow. */
export function resolveDeviceTokenWriteMode(
  userId: string | null | undefined,
): DeviceTokenWriteMode {
  return isValidSupabaseUserId(userId) ? 'upsert' : 'insert';
}

/**
 * True when a failed write was only the token already being there.
 *
 * The token is unique, so a second registration of the same device is a
 * duplicate rather than a failure: the device IS registered.
 */
export function isDuplicateTokenError(error: {
  code?: string | null;
} | null | undefined): boolean {
  return error?.code === '23505';
}

