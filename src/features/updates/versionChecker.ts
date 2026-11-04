/**
 * GBU One — Remote App Version Checker & Compulsory Update Engine
 *
 * Checks the central version manifest (Supabase `app_versions` or remote config)
 * to determine whether an update is available and whether it is mandatory.
 *
 * If `isMandatory` is true, the student app shows a non-dismissible blocking modal
 * requiring the student to download the latest APK before proceeding.
 */

import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

export interface AppVersionManifest {
  platform: 'android' | 'ios';
  latestVersion: string;
  minSupportedVersion: string;
  isMandatory: boolean;
  title: string;
  message: string;
  releaseNotes: string[];
  apkUrl: string;
  releasedAt: string;
}

export interface UpdateCheckResult {
  updateAvailable: boolean;
  isMandatory: boolean;
  currentVersion: string;
  manifest: AppVersionManifest | null;
}

export const FALLBACK_VERSION_MANIFEST: AppVersionManifest = {
  platform: 'android',
  latestVersion: '1.0.0',
  minSupportedVersion: '1.0.0',
  isMandatory: false,
  title: 'GBU One is Up to Date',
  message: 'You are running the verified version of GBU One.',
  releaseNotes: [
    'Autumn 2026 Academic Calendar & End Sem Exam Schedule (14-24 Dec)',
    'Verified GBU Gazetted Holiday List 2026',
    'Interactive Class Alarms with Snooze (+10m) & Dismiss controls',
    'Full Campus Events hub with photos & all-branch PYQ downloads',
  ],
  apkUrl: 'https://github.com/acro777x/gbu-one',
  releasedAt: '2026-10-25T00:00:00.000Z',
};

export const VERSION_OVERRIDE_KEY = '@gbu_one_update_manifest_override';
export const UPDATE_DISMISSED_KEY = '@gbu_one_update_dismissed_until';
export const UPDATE_REALTIME_CHANNEL = 'gbu_version_updates';
export const CLOUD_VERSION_URL =
  'https://pjnxllnncsoroevgfbmt.supabase.co/storage/v1/object/public/campus-events/version.json';

export interface UpdateDismissalRecord {
  version: string;
  dismissedUntil: number;
}

/**
 * Checks if an update notification has been snoozed by the student.
 * CRITICAL: Compulsory / mandatory updates CANNOT be dismissed.
 */
export async function isUpdateDismissed(
  targetVersion: string,
  isMandatory: boolean,
): Promise<boolean> {
  if (isMandatory) return false;

  try {
    const raw = await AsyncStorage.getItem(UPDATE_DISMISSED_KEY);
    if (!raw) return false;

    if (!raw.startsWith('{')) {
      const timestamp = Number(raw);
      return !isNaN(timestamp) && Date.now() < timestamp;
    }

    const record: UpdateDismissalRecord = JSON.parse(raw);
    if (record.version && record.version !== targetVersion) {
      return false;
    }

    return typeof record.dismissedUntil === 'number' && Date.now() < record.dismissedUntil;
  } catch {
    return false;
  }
}

/**
 * Records a 12-hour dismissal for an optional update.
 */
export async function dismissUpdateForVersion(version: string): Promise<void> {
  try {
    const record: UpdateDismissalRecord = {
      version,
      dismissedUntil: Date.now() + 12 * 60 * 60 * 1000,
    };
    await AsyncStorage.setItem(UPDATE_DISMISSED_KEY, JSON.stringify(record));
  } catch {
    // ignore
  }
}

/**
 * Clears update dismissal record (e.g. when mandatory update arrives or testing).
 */
export async function clearUpdateDismissal(): Promise<void> {
  try {
    await AsyncStorage.removeItem(UPDATE_DISMISSED_KEY);
  } catch {
    // ignore
  }
}

/**
 * Compares two semver strings (e.g. "1.1.0" vs "1.0.0").
 * Returns:
 *   1 if v1 > v2
 *  -1 if v1 < v2
 *   0 if v1 === v2
 */
export function compareSemver(v1: string, v2: string): number {
  const p1 = v1.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  const p2 = v2.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);

  const len = Math.max(p1.length, p2.length);
  for (let i = 0; i < len; i++) {
    const num1 = p1[i] ?? 0;
    const num2 = p2[i] ?? 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

/**
 * Checks for updates against Supabase `app_versions`, remote fallback, or admin overrides.
 */
export async function checkForAppUpdate(): Promise<UpdateCheckResult> {
  const currentVersion = Constants.expoConfig?.version ?? '1.0.0';

  // 1. Check local admin override first (useful for dev testing & admin APK testing)
  try {
    const overrideRaw = await AsyncStorage.getItem(VERSION_OVERRIDE_KEY);
    if (overrideRaw) {
      const manifest: AppVersionManifest = JSON.parse(overrideRaw);
      return evaluateManifest(currentVersion, manifest);
    }
  } catch {
    // ignore
  }

  // 2. Fetch from Supabase Storage CDN (fast, unauthenticated, never blocked)
  try {
    const res = await fetch(`${CLOUD_VERSION_URL}?t=${Date.now()}`, {
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object' && typeof data.latestVersion === 'string') {
        const manifest: AppVersionManifest = {
          platform: 'android',
          latestVersion: String(data.latestVersion || '1.0.0'),
          minSupportedVersion: String(data.minSupportedVersion || '1.0.0'),
          isMandatory: Boolean(data.isMandatory),
          title: String(data.title || 'GBU One Update Available'),
          message: String(data.message || 'A new update is available.'),
          releaseNotes: Array.isArray(data.releaseNotes) ? data.releaseNotes : [],
          apkUrl: String(data.apkUrl || 'https://github.com/acro777x/gbu-one'),
          releasedAt: String(data.releasedAt || new Date().toISOString()),
        };
        return evaluateManifest(currentVersion, manifest);
      }
    }
  } catch {
    // Fallback
  }

  // 3. Query Supabase app_versions if configured
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('app_versions')
        .select('*')
        .eq('platform', 'android')
        .single();

      if (!error && data) {
        const manifest: AppVersionManifest = {
          platform: 'android',
          latestVersion: String(data.latest_version ?? '1.0.0'),
          minSupportedVersion: String(data.min_supported_version ?? '1.0.0'),
          isMandatory: Boolean(data.is_mandatory),
          title: 'Mandatory Update Required',
          message: 'A critical update is required to continue accessing Gautam Buddha University services.',
          releaseNotes: Array.isArray(data.release_notes)
            ? (data.release_notes as string[])
            : ['New version with critical security and timetable updates'],
          apkUrl: String(data.apk_url ?? 'https://github.com/acro777x/gbu-one'),
          releasedAt: String(data.released_at ?? new Date().toISOString()),
        };
        return evaluateManifest(currentVersion, manifest);
      }
    } catch {
      // Fallback
    }
  }

  // 4. Fallback manifest evaluation
  return evaluateManifest(currentVersion, FALLBACK_VERSION_MANIFEST);
}

export function evaluateManifest(currentVersion: string, manifest: AppVersionManifest): UpdateCheckResult {
  const isOlderThanMin = compareSemver(currentVersion, manifest.minSupportedVersion) < 0;
  const isOlderThanLatest = compareSemver(currentVersion, manifest.latestVersion) < 0;

  if (isOlderThanMin) {
    return {
      updateAvailable: true,
      isMandatory: true,
      currentVersion,
      manifest,
    };
  }

  if (isOlderThanLatest) {
    return {
      updateAvailable: true,
      isMandatory: manifest.isMandatory,
      currentVersion,
      manifest,
    };
  }

  return {
    updateAvailable: false,
    isMandatory: false,
    currentVersion,
    manifest,
  };
}

/**
 * Subscribes to realtime version updates broadcast by administrators.
 * Fires the callback instantly whenever an update is broadcast.
 */
export function subscribeToVersionUpdates(
  onUpdate: (manifest: AppVersionManifest) => void,
): () => void {
  if (!isSupabaseConfigured) {
    return () => {};
  }
  try {
    const channel = supabase.channel(UPDATE_REALTIME_CHANNEL);
    channel
      .on('broadcast', { event: 'version_update' }, (msg) => {
        if (msg?.payload && typeof msg.payload === 'object' && msg.payload.latestVersion) {
          onUpdate(msg.payload as AppVersionManifest);
        }
      })
      .subscribe();

    return () => {
      try {
        void supabase.removeChannel(channel);
      } catch {
        // ignore
      }
    };
  } catch {
    return () => {};
  }
}

/**
 * Admin action to publish or update the version manifest in Supabase, local cache,
 * and broadcast instantly over Supabase Realtime to all connected devices.
 */
export async function publishAppVersion(
  manifest: AppVersionManifest,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await AsyncStorage.setItem(VERSION_OVERRIDE_KEY, JSON.stringify(manifest));

    if (isSupabaseConfigured) {
      // 1. Upload to Storage CDN (authoritative public cache)
      try {
        const payload = JSON.stringify(manifest, null, 2);
        await supabase.storage
          .from('campus-events')
          .upload('version.json', payload, {
            contentType: 'application/json',
            upsert: true,
          });
      } catch (uploadErr) {
        console.warn('Storage version.json upload error:', uploadErr);
      }

      // 2. Realtime broadcast for instantaneous sub-second delivery
      try {
        const channel = supabase.channel(UPDATE_REALTIME_CHANNEL);
        channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            void channel
              .send({
                type: 'broadcast',
                event: 'version_update',
                payload: manifest,
              })
              .then(() => {
                setTimeout(() => {
                  void supabase.removeChannel(channel);
                }, 1000);
              });
          }
        });
      } catch (broadcastErr) {
        console.warn('Realtime version broadcast warning:', broadcastErr);
      }

      // 3. Postgres sync (if table exists)
      try {
        await supabase
          .from('app_versions')
          .upsert(
            {
              platform: manifest.platform,
              latest_version: manifest.latestVersion,
              min_supported_version: manifest.minSupportedVersion,
              is_mandatory: manifest.isMandatory,
              apk_url: manifest.apkUrl,
              release_notes: manifest.releaseNotes,
              released_at: new Date().toISOString(),
            },
            { onConflict: 'platform' },
          );
      } catch {
        // Table might not exist yet, storage CDN is authoritative
      }
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export async function clearAppVersionOverride(): Promise<void> {
  await AsyncStorage.removeItem(VERSION_OVERRIDE_KEY);
  if (isSupabaseConfigured) {
    try {
      const resetManifest: AppVersionManifest = {
        ...FALLBACK_VERSION_MANIFEST,
        releasedAt: new Date().toISOString(),
      };
      const payload = JSON.stringify(resetManifest, null, 2);
      await supabase.storage
        .from('campus-events')
        .upload('version.json', payload, {
          contentType: 'application/json',
          upsert: true,
        });

      try {
        const channel = supabase.channel(UPDATE_REALTIME_CHANNEL);
        channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            void channel
              .send({
                type: 'broadcast',
                event: 'version_update',
                payload: resetManifest,
              })
              .then(() => {
                setTimeout(() => {
                  void supabase.removeChannel(channel);
                }, 1000);
              });
          }
        });
      } catch {
        // ignore
      }
    } catch {
      // ignore
    }
  }
}
