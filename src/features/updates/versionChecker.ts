/**
 * GBU One — Remote App Version Checker & Compulsory Update Engine
 *
 * Checks the central version manifest (Supabase `app_versions` or the public CDN copy)
 * to determine whether an update is available and whether it is mandatory.
 *
 * If `isMandatory` is true, the student app shows a non-dismissible blocking modal
 * requiring the student to download the latest APK before proceeding.
 *
 * Security / reliability notes:
 * - The compulsory-update gate FAILS CLOSED. When the manifest cannot be read, the last
 *   known good manifest (cached on the device) is evaluated — never the permissive
 *   fallback manifest, and "could not fetch" is never reported as "up to date".
 * - Versions are compared with a strict numeric semver comparison (`1.10 > 1.9`,
 *   `1.0.0-beta < 1.0.0`) and invalid versions are rejected before they are published.
 * - The realtime channel is PRIVATE (moderator only). Broadcast payloads are re-validated
 *   against the published manifest before they are shown to a student.
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

/**
 * `ok`      — the manifest was read from the server.
 * `offline` — the server could not be reached, the cached manifest was used.
 * `error`   — no manifest could be read at all.
 */
export type UpdateCheckStatus = 'ok' | 'offline' | 'error';

export interface UpdateCheckResult {
  updateAvailable: boolean;
  isMandatory: boolean;
  currentVersion: string;
  manifest: AppVersionManifest | null;
  status: UpdateCheckStatus;
  /** Human readable reason, set whenever `status !== 'ok'`. */
  error?: string | null;
  /** True when the result was evaluated against the on-device cached manifest. */
  usedCachedManifest?: boolean;
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
/** Last known good manifest, used when the update service cannot be reached. */
export const VERSION_MANIFEST_CACHE_KEY = '@gbu_one_update_manifest_cache';
export const UPDATE_DISMISSED_KEY = '@gbu_one_update_dismissed_until';
export const UPDATE_REALTIME_CHANNEL = 'gbu_version_updates';
export const CLOUD_VERSION_URL =
  'https://pjnxllnncsoroevgfbmt.supabase.co/storage/v1/object/public/campus-events/version.json';

/** Network budget for a single manifest request. */
const MANIFEST_REQUEST_TIMEOUT_MS = 10000;

export interface UpdateDismissalRecord {
  version: string;
  dismissedUntil: number;
}

// ============================================================================
// STRICT SEMVER
// ============================================================================

export interface SemverParts {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
}

/**
 * Accepts `MAJOR[.MINOR[.PATCH]]` with an optional `v` prefix, an optional
 * `-prerelease` and an optional `+build` suffix. `1.x.0` is NOT a version.
 */
const SEMVER_PATTERN = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

/** A publishable release version has to be a full `MAJOR.MINOR.PATCH` triple. */
const RELEASE_VERSION_PATTERN = /^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

export function parseSemver(version: string): SemverParts | null {
  if (typeof version !== 'string') return null;
  const match = SEMVER_PATTERN.exec(version.trim());
  if (!match) return null;
  const [, major, minor, patch, prerelease] = match;
  return {
    major: Number(major),
    minor: minor === undefined ? 0 : Number(minor),
    patch: patch === undefined ? 0 : Number(patch),
    prerelease: prerelease ? prerelease.split('.') : [],
  };
}

/** True when the string is a syntactically valid version (used by the comparison). */
export function isValidSemver(version: string): boolean {
  return parseSemver(version) !== null;
}

/** True when the string is a publishable release version (`MAJOR.MINOR.PATCH`). */
export function isValidReleaseVersion(version: string): boolean {
  if (typeof version !== 'string') return false;
  return RELEASE_VERSION_PATTERN.test(version.trim());
}

/**
 * Compares two semver strings (e.g. "1.1.0" vs "1.0.0").
 * Returns:
 *   1 if v1 > v2
 *  -1 if v1 < v2
 *   0 if v1 === v2
 *
 * The comparison is strictly numeric (so `1.10 > 1.9`) and understands prerelease
 * precedence (so `1.0.0-beta < 1.0.0`). A version that cannot be parsed is never
 * considered newer than a valid one: it sorts below, which keeps the update gate
 * closed instead of silently treating a broken version as "up to date".
 */
export function compareSemver(v1: string, v2: string): number {
  const a = parseSemver(v1);
  const b = parseSemver(v2);

  if (!a && !b) {
    // Neither side is a version: keep the result deterministic.
    const s1 = typeof v1 === 'string' ? v1.trim() : '';
    const s2 = typeof v2 === 'string' ? v2.trim() : '';
    if (s1 === s2) return 0;
    return s1 < s2 ? -1 : 1;
  }
  if (!a) return -1;
  if (!b) return 1;

  if (a.major !== b.major) return a.major > b.major ? 1 : -1;
  if (a.minor !== b.minor) return a.minor > b.minor ? 1 : -1;
  if (a.patch !== b.patch) return a.patch > b.patch ? 1 : -1;

  // Prerelease precedence: 1.0.0-beta < 1.0.0
  if (a.prerelease.length === 0 && b.prerelease.length === 0) return 0;
  if (a.prerelease.length === 0) return 1;
  if (b.prerelease.length === 0) return -1;

  const length = Math.max(a.prerelease.length, b.prerelease.length);
  for (let i = 0; i < length; i++) {
    const idA = a.prerelease[i];
    const idB = b.prerelease[i];
    if (idA === undefined) return -1;
    if (idB === undefined) return 1;

    const isNumericA = /^\d+$/.test(idA);
    const isNumericB = /^\d+$/.test(idB);

    if (isNumericA && isNumericB) {
      const numA = Number(idA);
      const numB = Number(idB);
      if (numA !== numB) return numA > numB ? 1 : -1;
    } else if (isNumericA !== isNumericB) {
      // Numeric identifiers always have lower precedence than alphanumeric ones.
      return isNumericA ? -1 : 1;
    } else if (idA !== idB) {
      return idA > idB ? 1 : -1;
    }
  }

  return 0;
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

// ============================================================================
// MANIFEST CACHE (fail-closed behaviour when the update service is unreachable)
// ============================================================================

async function cacheManifest(manifest: AppVersionManifest): Promise<void> {
  try {
    await AsyncStorage.setItem(VERSION_MANIFEST_CACHE_KEY, JSON.stringify(manifest));
  } catch {
    // ignore
  }
}

async function readCachedManifest(): Promise<AppVersionManifest | null> {
  try {
    const raw = await AsyncStorage.getItem(VERSION_MANIFEST_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppVersionManifest;
    if (!parsed || typeof parsed.latestVersion !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * `fetch` with a hard timeout. A hanging request must never keep the update gate in an
 * undefined state (and must never pile up 5 760 requests a day per device).
 */
async function fetchWithTimeout(
  url: string,
  timeoutMs: number = MANIFEST_REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { 'Cache-Control': 'no-cache' },
    });
  } finally {
    clearTimeout(timer);
  }
}

function normalizeManifest(data: unknown): AppVersionManifest | null {
  if (!data || typeof data !== 'object') return null;
  const payload = data as Record<string, unknown>;
  if (typeof payload.latestVersion !== 'string') return null;

  return {
    platform: 'android',
    latestVersion: String(payload.latestVersion),
    minSupportedVersion: String(payload.minSupportedVersion || payload.latestVersion),
    isMandatory: Boolean(payload.isMandatory),
    title: String(payload.title || 'GBU One Update Available'),
    message: String(payload.message || 'A new update is available.'),
    releaseNotes: Array.isArray(payload.releaseNotes) ? (payload.releaseNotes as string[]) : [],
    apkUrl: String(payload.apkUrl || 'https://github.com/acro777x/gbu-one'),
    releasedAt: String(payload.releasedAt || new Date().toISOString()),
  };
}

/**
 * Checks for updates against the CDN manifest, the Supabase `app_versions` table, the
 * local admin override, or the last known good cached manifest.
 *
 * The gate fails closed: an unreadable manifest never turns into "you are up to date".
 */
export async function checkForAppUpdate(): Promise<UpdateCheckResult> {
  const currentVersion = Constants.expoConfig?.version ?? '1.0.0';

  // 1. Local admin override first (dev testing & the admin app's own cache).
  try {
    const overrideRaw = await AsyncStorage.getItem(VERSION_OVERRIDE_KEY);
    if (overrideRaw) {
      const manifest: AppVersionManifest = JSON.parse(overrideRaw);
      return evaluateManifest(currentVersion, manifest);
    }
  } catch {
    // ignore
  }

  let lastError = 'The update service could not be reached.';

  // 2. Fetch from the Supabase Storage CDN (fast, unauthenticated, never blocked).
  try {
    const res = await fetchWithTimeout(CLOUD_VERSION_URL);
    if (res.ok) {
      const manifest = normalizeManifest(await res.json());
      if (manifest) {
        await cacheManifest(manifest);
        return evaluateManifest(currentVersion, manifest);
      }
      lastError = 'The published update manifest is malformed.';
    } else {
      lastError = `The update service answered with HTTP ${res.status}.`;
    }
  } catch (err) {
    lastError = err instanceof Error ? err.message : lastError;
  }

  // 3. Query the Supabase `app_versions` table if configured.
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
          message:
            'A critical update is required to continue accessing Gautam Buddha University services.',
          releaseNotes: Array.isArray(data.release_notes)
            ? (data.release_notes as string[])
            : ['New version with critical security and timetable updates'],
          apkUrl: String(data.apk_url ?? 'https://github.com/acro777x/gbu-one'),
          releasedAt: String(data.released_at ?? new Date().toISOString()),
        };
        await cacheManifest(manifest);
        return evaluateManifest(currentVersion, manifest);
      }
      if (error) {
        lastError = error.message || lastError;
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : lastError;
    }
  }

  // 4. Nothing could be read: evaluate against the LAST KNOWN GOOD manifest. The old
  //    behaviour fell back to `FALLBACK_VERSION_MANIFEST` (minSupportedVersion 1.0.0),
  //    which silently removed the compulsory-update gate whenever the CDN was down.
  const cached = await readCachedManifest();
  if (cached) {
    const result = evaluateManifest(currentVersion, cached);
    return {
      ...result,
      status: 'offline',
      usedCachedManifest: true,
      error: `${lastError} Using the last known update information.`,
    };
  }

  // 5. Not even a cached manifest exists. We do not fabricate a compulsory update out of
  //    thin air (that would lock every offline student out of the app), but we also never
  //    claim to be up to date: the state is reported as an explicit error.
  return {
    updateAvailable: false,
    isMandatory: false,
    currentVersion,
    manifest: null,
    status: 'error',
    error: `${lastError} No update information is available on this device.`,
  };
}

export function evaluateManifest(
  currentVersion: string,
  manifest: AppVersionManifest,
): UpdateCheckResult {
  const manifestIsValid =
    isValidReleaseVersion(manifest.latestVersion) &&
    isValidReleaseVersion(manifest.minSupportedVersion);

  if (!manifestIsValid) {
    // A broken manifest must never be read as "you are up to date".
    return {
      updateAvailable: true,
      isMandatory: true,
      currentVersion,
      manifest,
      status: 'error',
      error: 'The published update manifest is malformed. Please update the app.',
    };
  }

  const isOlderThanMin = compareSemver(currentVersion, manifest.minSupportedVersion) < 0;
  const isOlderThanLatest = compareSemver(currentVersion, manifest.latestVersion) < 0;

  if (isOlderThanMin) {
    return {
      updateAvailable: true,
      isMandatory: true,
      currentVersion,
      manifest,
      status: 'ok',
    };
  }

  if (isOlderThanLatest) {
    return {
      updateAvailable: true,
      isMandatory: manifest.isMandatory,
      currentVersion,
      manifest,
      status: 'ok',
    };
  }

  return {
    updateAvailable: false,
    isMandatory: false,
    currentVersion,
    manifest,
    status: 'ok',
  };
}

/**
 * Subscribes to realtime version updates broadcast by administrators.
 *
 * The channel is PRIVATE: only moderators (the new `realtime.messages` policies) can
 * read or publish on it. The payload is NOT trusted — the caller re-validates it against
 * the published manifest.
 */
export function subscribeToVersionUpdates(
  onUpdate: (manifest: AppVersionManifest) => void,
): () => void {
  if (!isSupabaseConfigured) {
    return () => {};
  }
  try {
    const channel = supabase.channel(UPDATE_REALTIME_CHANNEL, {
      config: { private: true },
    });
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
 * Broadcasts the manifest on the private realtime channel.
 * Returns false when the broadcast did not reach the server.
 */
async function broadcastVersionManifest(manifest: AppVersionManifest): Promise<boolean> {
  try {
    const channel = supabase.channel(UPDATE_REALTIME_CHANNEL, {
      config: { private: true },
    });

    const sent = await new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (value: boolean) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          void channel
            .send({
              type: 'broadcast',
              event: 'version_update',
              payload: manifest,
            })
            .then((result) => finish(result === 'ok'))
            .catch(() => finish(false));
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          finish(false);
        }
      });

      // Never wait forever: a silent channel must not block the publish.
      setTimeout(() => finish(false), 10000);
    });

    setTimeout(() => {
      try {
        void supabase.removeChannel(channel);
      } catch {
        // ignore
      }
    }, 1000);

    return sent;
  } catch {
    return false;
  }
}

export interface PublishAppVersionResult {
  ok: boolean;
  error?: string;
  /**
   * True when Supabase is not configured: only the on-device cache was written, so no
   * student was notified.
   */
  localOnly?: boolean;
}

/**
 * Admin action to publish or update the version manifest in Supabase, local cache,
 * and broadcast instantly over Supabase Realtime to all connected devices.
 *
 * Every remote step is verified: a failure is reported with its real reason instead of
 * a cheerful "broadcast successfully" that no student ever received.
 */
export async function publishAppVersion(
  manifest: AppVersionManifest,
): Promise<PublishAppVersionResult> {
  // 1. Validate the version pair BEFORE anything is written or broadcast.
  if (!isValidReleaseVersion(manifest.latestVersion)) {
    return {
      ok: false,
      error: `Invalid version "${manifest.latestVersion}". Use MAJOR.MINOR.PATCH (e.g. 1.2.0).`,
    };
  }
  if (!isValidReleaseVersion(manifest.minSupportedVersion)) {
    return {
      ok: false,
      error: `Invalid minimum supported version "${manifest.minSupportedVersion}". Use MAJOR.MINOR.PATCH (e.g. 1.2.0).`,
    };
  }
  if (compareSemver(manifest.minSupportedVersion, manifest.latestVersion) > 0) {
    return {
      ok: false,
      error: `Minimum supported version (${manifest.minSupportedVersion}) cannot be newer than the latest version (${manifest.latestVersion}).`,
    };
  }

  if (!isSupabaseConfigured) {
    // Local / development mode: only the on-device cache can be written.
    try {
      await AsyncStorage.setItem(VERSION_OVERRIDE_KEY, JSON.stringify(manifest));
      await cacheManifest(manifest);
    } catch (err) {
      return { ok: false, error: `Could not cache the manifest locally: ${String(err)}` };
    }
    return { ok: true, localOnly: true };
  }

  // 2. Upload to the Storage CDN (authoritative public copy every student reads).
  const payload = JSON.stringify(manifest, null, 2);
  try {
    const { error: uploadError } = await supabase.storage
      .from('campus-events')
      .upload('version.json', payload, {
        contentType: 'application/json',
        upsert: true,
      });

    if (uploadError) {
      return { ok: false, error: `Cloud upload failed: ${uploadError.message}` };
    }
  } catch (err) {
    return {
      ok: false,
      error: `Cloud upload failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // 3. Realtime broadcast for instantaneous delivery (private channel).
  const broadcasted = await broadcastVersionManifest(manifest);
  if (!broadcasted) {
    return {
      ok: false,
      error:
        'The manifest was uploaded but the realtime broadcast failed, so students were not notified in real time.',
    };
  }

  // 4. Postgres mirror of the manifest.
  try {
    const { error: upsertError } = await supabase
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

    if (upsertError) {
      return {
        ok: false,
        error: `The manifest was uploaded and broadcast, but the database row could not be updated: ${upsertError.message}`,
      };
    }
  } catch (err) {
    return {
      ok: false,
      error: `The manifest was uploaded and broadcast, but the database row could not be updated: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }

  // 5. Verify: re-read the published object. Reporting success without proving it is
  //    exactly what made the old implementation lie to the admin.
  const verification = await verifyPublishedManifest(manifest);
  if (!verification.ok) {
    return { ok: false, error: verification.error };
  }

  try {
    await AsyncStorage.setItem(VERSION_OVERRIDE_KEY, JSON.stringify(manifest));
    await cacheManifest(manifest);
  } catch {
    // The manifest IS published; a local cache failure must not report a false failure.
  }

  return { ok: true };
}

/**
 * Re-reads the published manifest and compares it with what we wanted to publish.
 */
async function verifyPublishedManifest(
  manifest: AppVersionManifest,
): Promise<{ ok: boolean; error?: string }> {
  try {
    // A cache buster is used here on purpose: we want the object we just wrote.
    const res = await fetchWithTimeout(`${CLOUD_VERSION_URL}?verify=${Date.now()}`);
    if (!res.ok) {
      return {
        ok: false,
        error: `The published manifest could not be verified (HTTP ${res.status}).`,
      };
    }

    const published = normalizeManifest(await res.json());
    if (!published) {
      return { ok: false, error: 'The published manifest could not be read back.' };
    }

    if (
      published.latestVersion !== manifest.latestVersion ||
      published.minSupportedVersion !== manifest.minSupportedVersion ||
      published.isMandatory !== manifest.isMandatory
    ) {
      return {
        ok: false,
        error: `The published manifest does not match the requested one (published ${published.latestVersion} / min ${published.minSupportedVersion}).`,
      };
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: `The published manifest could not be verified: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
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
      const { error: uploadError } = await supabase.storage
        .from('campus-events')
        .upload('version.json', payload, {
          contentType: 'application/json',
          upsert: true,
        });
      if (uploadError) {
        console.warn('Storage version.json reset error:', uploadError.message);
      }

      await broadcastVersionManifest(resetManifest);

      try {
        const { error: upsertError } = await supabase
          .from('app_versions')
          .upsert(
            {
              platform: 'android',
              latest_version: resetManifest.latestVersion,
              min_supported_version: resetManifest.minSupportedVersion,
              is_mandatory: resetManifest.isMandatory,
              apk_url: resetManifest.apkUrl,
              release_notes: resetManifest.releaseNotes,
              released_at: new Date().toISOString(),
            },
            { onConflict: 'platform' },
          );
        if (upsertError) {
          console.warn('app_versions reset error:', upsertError.message);
        }
      } catch {
        // Table might not exist or storage CDN is authoritative
      }
    } catch {
      // ignore
    }
  }
}
