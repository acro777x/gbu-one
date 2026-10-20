/**
 * App-side push registration for GBU One.
 *
 * The app registers one Expo push token per device together with the
 * student's class key, so the worker can target timetable-change pushes at
 * the right class (docs/NOTIFICATIONS.md).
 *
 * Everything here degrades gracefully: if Supabase, the EAS project id or
 * the notification permission is missing we return a reason instead of
 * throwing, so the app still starts and works offline.
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { supabase, isSupabaseConfigured } from './supabase';
import {
  TIMETABLE_CHANNEL_ID,
  TIMETABLE_PUSH_PREF_KEY,
  buildDeviceTokenRow,
  canAttemptRegistration,
  resolveClassKeyForRow,
  resolveEasProjectId,
  type PushRegistrationResult,
} from './pushPolicy';

export { TIMETABLE_CHANNEL_ID, TIMETABLE_PUSH_PREF_KEY };
export type { PushRegistrationResult } from './pushPolicy';

/** Where the device's own Expo token is cached, so preferences can be applied later. */
export const PUSH_TOKEN_STORAGE_KEY = '@gbu_one_push_token';

/**
 * Shows timetable-change pushes while the app is in the foreground.
 * Safe to call more than once.
 */
export function configureNotificationHandler(): void {
  if (Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** Reads the EAS project id from the app config / build config. */
export function getExpoProjectId(): string | null {
  const extra = Constants.expoConfig?.extra as
    | { eas?: { projectId?: string } }
    | undefined;
  const easConfig = Constants.easConfig as { projectId?: string } | null;
  return resolveEasProjectId({
    extraProjectId: extra?.eas?.projectId,
    easConfigProjectId: easConfig?.projectId,
  });
}

/** True when the student keeps timetable pushes switched on in Profile. */
export async function isTimetablePushEnabled(): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(TIMETABLE_PUSH_PREF_KEY);
    return stored !== 'false';
  } catch {
    return true;
  }
}

/** The Expo token this device registered, if any. */
export async function getRegisteredPushToken(): Promise<string | null> {
  try {
    return (await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY)) || null;
  } catch {
    return null;
  }
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(TIMETABLE_CHANNEL_ID, {
      name: 'Timetable changes',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4F46E5',
    });
  } catch {
    // Channel creation is best-effort; the OS keeps its default channel.
  }
}

async function requestNotificationPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    const asked = await Notifications.requestPermissionsAsync();
    return asked.granted;
  } catch {
    return false;
  }
}

/**
 * Registers this device for class-targeted timetable pushes.
 * Never throws; the outcome carries a machine-readable reason on failure.
 */
export async function registerDeviceForPush(
  classKey?: string | null,
): Promise<PushRegistrationResult> {
  const gate = canAttemptRegistration({
    supabaseConfigured: isSupabaseConfigured,
    platform: Platform.OS,
    isDevice: Device.isDevice,
  });
  if (!gate.ok) return { registered: false, reason: gate.reason };

  const projectId = getExpoProjectId();
  if (!projectId) return { registered: false, reason: 'missing-eas-project-id' };

  const granted = await requestNotificationPermission();
  if (!granted) return { registered: false, reason: 'permission-denied' };

  await ensureAndroidChannel();

  let token: string;
  try {
    const expoToken = await Notifications.getExpoPushTokenAsync({ projectId });
    token = expoToken.data;
  } catch {
    return { registered: false, reason: 'token-failed' };
  }

  if (!token) return { registered: false, reason: 'token-failed' };

  let userId: string | null = null;
  try {
    const { data } = await supabase.auth.getSession();
    userId = data?.session?.user?.id ?? null;
  } catch {
    userId = null;
  }

  const row = buildDeviceTokenRow({
    token,
    platform: Platform.OS,
    classKey: resolveClassKeyForRow(classKey, await isTimetablePushEnabled()),
    userId,
  });

  try {
    const { error } = await supabase
      .from('device_tokens')
      .upsert(row, { onConflict: 'token' });
    if (error) return { registered: false, reason: 'save-failed' };
  } catch {
    return { registered: false, reason: 'save-failed' };
  }

  try {
    await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
  } catch {
    // Caching the token is a convenience, not a requirement.
  }

  return { registered: true, token };
}

/**
 * Applies the Profile timetable-push toggle to the registered device.
 * Turning it off keeps the token (notice pushes still arrive) but drops the
 * class key, so the worker no longer targets this device for timetable
 * changes. Turning it on restores class targeting.
 */
export async function setTimetablePushEnabled(
  enabled: boolean,
  classKey?: string | null,
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const token = await getRegisteredPushToken();
  if (!token) return false;
  const classKeyForRow = resolveClassKeyForRow(classKey, enabled);
  try {
    const { error } = await supabase
      .from('device_tokens')
      .update({ class_key: classKeyForRow })
      .eq('token', token);
    return !error;
  } catch {
    return false;
  }
}

/** Removes a device token (e.g. when the student switches pushes off). */
export async function unregisterDeviceToken(token: string): Promise<boolean> {
  if (!isSupabaseConfigured || !token) return false;
  try {
    const { error } = await supabase.from('device_tokens').delete().eq('token', token);
    return !error;
  } catch {
    return false;
  }
}
