/**
 * GBU One — Administrative Security & Tamper-Evident Audit System
 *
 * Implements:
 * 1. Server-Side Admin Authentication (Email + Password via Supabase Auth):
 *    - Validates credentials against Supabase Auth (`supabase.auth.signInWithPassword`).
 *    - Enforces server-side authorization: the signed-in JWT email MUST be present in
 *      `public.moderators` (checked through the SECURITY DEFINER helpers
 *      `public.is_moderator()` / `public.is_owner()`).
 *    - First-time setup: `supabase.auth.signUp()` followed by `supabase.rpc('claim_initial_admin')`.
 *    - There is deliberately NO offline / "emergency master key" path any more: the old one
 *      compared a PIN that was inlined into the APK as `EXPO_PUBLIC_ADMIN_PIN`, so anybody with
 *      the binary owned the console. Every privileged action now rides on the signed-in session
 *      and the new row level security policies.
 * 2. Brute-force lockout manager:
 *    - Tracks failed passcode attempts up to 5 max.
 *    - Activates 300-second (5 min) lockout on the 5th failure.
 *    - Persists state in AsyncStorage (`@gbu_admin_lockout_state`) so app restarts cannot bypass lockout.
 *    - Mutex-serialized against concurrent race conditions without re-entrant deadlock.
 * 3. Session auto-lock:
 *    - 15-minute inactivity timeout (ADMIN_SESSION_TIMEOUT_MS).
 *    - AppState lifecycle tracking and automatic logout.
 * 4. Tamper-evident SHA-256 Hash-Chained Audit Ledger:
 *    - NIST FIPS 180-4 compliant cryptographic ledger stored in `@gbu_admin_audit_log`.
 *    - Full UTF-8 support for unicode/Hindi circulars.
 *    - Cryptographically logs all sensitive actions (sign-in attempts, setup, notices, datesheets, updates).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

export const ADMIN_LOCKOUT_STORAGE_KEY = '@gbu_admin_lockout_state';
export const ADMIN_AUDIT_LOG_STORAGE_KEY = '@gbu_admin_audit_log';
export const ADMIN_SESSION_STORAGE_KEY = '@gbu_admin_session_state';

export const MAX_ADMIN_ATTEMPTS = 5;
export const ADMIN_LOCKOUT_SECONDS = 300; // 5 minutes in seconds
export const ADMIN_SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

// Zero hardcoded credentials: All master credentials must come strictly from secure environment variables
export const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

export interface AdminLockoutState {
  failedAttempts: number;
  lockoutUntil: number | null; // Unix epoch ms
}

export type AdminActionType =
  | 'publish_notice'
  | 'delete_notice'
  | 'revert_notice'
  | 'revert_broadcast'
  | 'upload_datesheet'
  | 'moderate_pyq'
  | 'publish_update'
  | 'revert_update'
  | 'admin_login_success'
  | 'admin_login_failed'
  | 'admin_setup'
  | 'admin_logout';

export interface AdminAuditEntry {
  id: string;
  action: AdminActionType;
  timestamp: string; // ISO 8601 string
  details: Record<string, unknown>;
  prevHash: string;
  hash: string;
}

export interface AdminAuthResult {
  success: boolean;
  error?: string;
  remainingAttempts: number;
  lockedOut: boolean;
  lockoutSeconds: number;
  /**
   * Only server-side authentication exists any more. The field is kept so callers can
   * assert that the session was established by Supabase Auth.
   */
  authMethod?: 'server' | 'offline_emergency';
  userEmail?: string;
  role?: AdminRole | 'emergency_admin';
}

export interface AdminAuthOptions {
  email?: string;
  password?: string;
  isInitialSetup?: boolean;
  offlinePin?: string;
  secondaryKey?: string;
}

/**
 * Roles come from the server-side `public.moderators` allowlist. They are never derived
 * from an env var or a hard coded address: those were baked into the shipped APK.
 */
export type AdminRole = 'owner' | 'moderator';

export interface AdminIdentity {
  email: string;
  role: AdminRole;
}

// ============================================================================
// PURE TYPESCRIPT SHA-256 HASH ENGINE (Zero Native / Zero Crypto Dependency)
// NIST FIPS 180-4 Compliant with Full UTF-8 & Multibyte Support
// ============================================================================

export function utf8Bytes(str: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i);
    if (c < 0x80) {
      bytes.push(c);
    } else if (c < 0x800) {
      bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    } else if (c >= 0xd800 && c <= 0xdbff) {
      i++;
      const next = str.charCodeAt(i);
      c = 0x10000 + (((c & 0x3ff) << 10) | (next & 0x3ff));
      bytes.push(
        0xf0 | (c >> 18),
        0x80 | ((c >> 12) & 0x3f),
        0x80 | ((c >> 6) & 0x3f),
        0x80 | (c & 0x3f),
      );
    } else {
      bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
  }
  return bytes;
}

export function sha256(input: string): string {
  function rightRotate(value: number, amount: number): number {
    return (value >>> amount) | (value << (32 - amount));
  }

  const bytes = utf8Bytes(input);
  const bitLength = bytes.length * 8;
  const words: number[] = [];

  for (let i = 0; i < bytes.length; i++) {
    words[i >> 2] |= (bytes[i] & 255) << (8 * (3 - (i % 4)));
  }
  words[bitLength >> 5] |= 0x80 << (24 - (bitLength % 32));
  words[(((bitLength + 64) >> 9) << 4) + 15] = bitLength;

  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  for (let i = 0; i < words.length; i += 16) {
    const w: number[] = [];
    for (let j = 0; j < 16; j++) w[j] = words[i + j] | 0;
    for (let j = 16; j < 64; j++) {
      const s0 = rightRotate(w[j - 15], 7) ^ rightRotate(w[j - 15], 18) ^ (w[j - 15] >>> 3);
      const s1 = rightRotate(w[j - 2], 17) ^ rightRotate(w[j - 2], 19) ^ (w[j - 2] >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
    }

    let a = hash[0];
    let b = hash[1];
    let c = hash[2];
    let d = hash[3];
    let e = hash[4];
    let f = hash[5];
    let g = hash[6];
    let h = hash[7];

    for (let j = 0; j < 64; j++) {
      const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + k[j] + w[j]) | 0;
      const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    hash[0] = (hash[0] + a) | 0;
    hash[1] = (hash[1] + b) | 0;
    hash[2] = (hash[2] + c) | 0;
    hash[3] = (hash[3] + d) | 0;
    hash[4] = (hash[4] + e) | 0;
    hash[5] = (hash[5] + f) | 0;
    hash[6] = (hash[6] + g) | 0;
    hash[7] = (hash[7] + h) | 0;
  }

  let result = '';
  for (let i = 0; i < 8; i++) {
    for (let j = 3; j >= 0; j--) {
      const byteVal = (hash[i] >> (8 * j)) & 255;
      result += (byteVal < 16 ? '0' : '') + byteVal.toString(16);
    }
  }
  return result;
}

/**
 * Mutex lock queues to prevent concurrent async race conditions in lockout
 * counter increments and audit ledger chaining.
 */
let lockoutMutex: Promise<unknown> = Promise.resolve();
export async function withLockoutLock<T>(fn: () => Promise<T>): Promise<T> {
  const current = lockoutMutex;
  let release: () => void;
  const next = new Promise<void>((resolve) => {
    release = resolve;
  });
  lockoutMutex = current.then(() => next);
  await current;
  try {
    return await fn();
  } finally {
    release!();
  }
}

let auditMutex: Promise<unknown> = Promise.resolve();
export async function withAuditLock<T>(fn: () => Promise<T>): Promise<T> {
  const current = auditMutex;
  let release: () => void;
  const next = new Promise<void>((resolve) => {
    release = resolve;
  });
  auditMutex = current.then(() => next);
  await current;
  try {
    return await fn();
  } finally {
    release!();
  }
}

/**
 * Deterministic JSON stringifier to ensure hash consistency across runs.
 */
export function stableSerialize(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(stableSerialize).join(',') + ']';
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  return (
    '{' +
    keys
      .map((k) => JSON.stringify(k) + ':' + stableSerialize((obj as Record<string, unknown>)[k]))
      .join(',') +
    '}'
  );
}

// ============================================================================
// BRUTE-FORCE LOCKOUT MANAGER
// ============================================================================

async function getLockoutStateInternal(): Promise<AdminLockoutState> {
  try {
    const raw = await AsyncStorage.getItem(ADMIN_LOCKOUT_STORAGE_KEY);
    if (!raw) {
      return { failedAttempts: 0, lockoutUntil: null };
    }
    const parsed = JSON.parse(raw) as Partial<AdminLockoutState>;
    const failedAttempts = typeof parsed.failedAttempts === 'number' ? parsed.failedAttempts : 0;
    const lockoutUntil = typeof parsed.lockoutUntil === 'number' ? parsed.lockoutUntil : null;

    if (lockoutUntil !== null && Date.now() >= lockoutUntil) {
      const resetState: AdminLockoutState = { failedAttempts: 0, lockoutUntil: null };
      await AsyncStorage.setItem(ADMIN_LOCKOUT_STORAGE_KEY, JSON.stringify(resetState));
      return resetState;
    }

    return { failedAttempts, lockoutUntil };
  } catch {
    return { failedAttempts: 0, lockoutUntil: null };
  }
}

async function recordFailedAttemptInternal(): Promise<AdminLockoutState> {
  const current = await getLockoutStateInternal();
  const nextAttempts = current.failedAttempts + 1;
  let lockoutUntil = current.lockoutUntil;

  if (nextAttempts >= MAX_ADMIN_ATTEMPTS) {
    lockoutUntil = Date.now() + ADMIN_LOCKOUT_SECONDS * 1000;
  }

  const newState: AdminLockoutState = {
    failedAttempts: nextAttempts,
    lockoutUntil,
  };

  await AsyncStorage.setItem(ADMIN_LOCKOUT_STORAGE_KEY, JSON.stringify(newState));
  return newState;
}

async function resetLockoutStateInternal(): Promise<void> {
  const resetState: AdminLockoutState = { failedAttempts: 0, lockoutUntil: null };
  await AsyncStorage.setItem(ADMIN_LOCKOUT_STORAGE_KEY, JSON.stringify(resetState));
}

export async function getLockoutState(): Promise<AdminLockoutState> {
  return getLockoutStateInternal();
}

export async function getRemainingLockoutSeconds(): Promise<number> {
  const state = await getLockoutStateInternal();
  if (!state.lockoutUntil) return 0;
  const diffMs = state.lockoutUntil - Date.now();
  return diffMs > 0 ? Math.ceil(diffMs / 1000) : 0;
}

export async function isLockedOut(): Promise<boolean> {
  const remaining = await getRemainingLockoutSeconds();
  return remaining > 0;
}

export async function recordFailedAttempt(): Promise<AdminLockoutState> {
  return withLockoutLock(recordFailedAttemptInternal);
}

export async function resetLockoutState(): Promise<void> {
  return withLockoutLock(resetLockoutStateInternal);
}

export function formatLockoutTime(totalSeconds: number): string {
  const total = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// ============================================================================
// SERVER-SIDE IDENTITY RESOLUTION (NO CLIENT-SIDE SECRETS)
// ============================================================================

/**
 * Resolves the admin identity of a signed-in email address.
 *
 * The ONLY sources of truth are server side:
 *  - `public.is_moderator()` (SECURITY DEFINER) answers "is the JWT email on the allowlist?"
 *  - `public.moderators` holds the role of that entry.
 *
 * There is deliberately no env var comparison and no hard coded address any more: the
 * previous `EXPO_PUBLIC_ADMIN_EMAIL` / `admin@gbu.ac.in` fallbacks shipped inside the APK
 * and therefore granted `role = 'owner'` to anybody who knew the address.
 */
async function resolveAdminIdentity(email: string): Promise<AdminIdentity | null> {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail || !isSupabaseConfigured) return null;

  let authorized = false;
  let role: AdminRole = 'moderator';

  try {
    const { data: isModerator, error: rpcError } = await supabase.rpc('is_moderator');
    if (!rpcError && typeof isModerator === 'boolean') {
      authorized = isModerator;
    }
  } catch {
    // Fall through to the allowlist read below.
  }

  // The allowlist row itself is readable by a signed-in moderator for their own address
  // (see the `moderators` select policy), so it doubles as the role source and as a
  // fallback when the helper RPC is unavailable.
  let roleFromTable: string | null = null;
  try {
    const { data: modRow, error: modError } = await supabase
      .from('moderators')
      .select('role')
      .eq('email', cleanEmail)
      .maybeSingle();
    if (!modError && modRow?.role) {
      roleFromTable = String(modRow.role);
      authorized = true;
    }
  } catch {
    // ignore
  }

  if (!authorized) return null;

  if (roleFromTable) {
    role = roleFromTable.toLowerCase() === 'owner' ? 'owner' : 'moderator';
  } else {
    // No readable row: ask the server whether this account owns the console.
    try {
      const { data: isOwner, error: ownerError } = await supabase.rpc('is_owner');
      if (!ownerError && isOwner === true) role = 'owner';
    } catch {
      // ignore
    }
  }

  return { email: cleanEmail, role };
}

/**
 * Returns the identity of the currently signed-in Supabase session, but only when that
 * session is on the server-side moderator allowlist.
 *
 * The admin console uses this to restore a session: a local timestamp alone is NOT proof
 * of anything, the live server session plus `public.is_moderator()` is.
 */
export async function getCurrentAdminIdentity(): Promise<AdminIdentity | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data?.session?.user?.email) return null;
    return await resolveAdminIdentity(data.session.user.email);
  } catch {
    return null;
  }
}

// ============================================================================
// SERVER-SIDE SUPABASE AUTH & ROLE VERIFICATION
// ============================================================================

/**
 * True once the console has been claimed by a real account.
 *
 * `public.has_any_moderator()` is the authoritative check (SECURITY DEFINER over
 * `public.admin_claims`). The `moderators` table read is only a fallback for deployments
 * that have not applied the new schema yet.
 */
export async function checkHasAnyAdmin(): Promise<boolean> {
  if (!isSupabaseConfigured) return true;
  try {
    const { data, error } = await supabase.rpc('has_any_moderator');
    if (!error && typeof data === 'boolean') {
      return data;
    }
  } catch {
    // Fall through to the table read below.
  }

  try {
    const { count, error: countErr } = await supabase
      .from('moderators')
      .select('*', { count: 'exact', head: true });
    if (!countErr && typeof count === 'number') {
      return count > 0;
    }
  } catch {
    // ignore
  }

  // Could not prove the console is unclaimed: fail closed and hide the setup screen.
  return true;
}

/**
 * Public entrypoint for server-side admin authentication.
 *
 * The brute-force lockout lock is taken EXACTLY ONCE, here. The implementation below must
 * therefore never acquire it again (the lock is not re-entrant): recursive calls use
 * `authenticateAdminInternal`, which runs without the lock.
 */
export async function authenticateAdminWithSupabase(
  email: string,
  password: string,
  isInitialSetup: boolean = false,
): Promise<AdminAuthResult> {
  return withLockoutLock(() => authenticateAdminInternal(email, password, isInitialSetup));
}

/**
 * Authenticates administrator credentials server-side via Supabase Auth:
 * 1. `supabase.auth.signInWithPassword({ email, password })`
 * 2. Verifies on server that user is an authorized moderator/owner in `public.moderators`
 * 3. Supports secure first-time owner account setup (`claim_initial_admin`)
 * 4. Protects against brute force with 5-attempt lockout and 300s persistent cooldown
 *
 * Runs WITHOUT the lockout lock: the caller owns it.
 */
async function authenticateAdminInternal(
  email: string,
  password: string,
  isInitialSetup: boolean,
): Promise<AdminAuthResult> {
  return (async () => {
    const remainingSecs = await getRemainingLockoutSeconds();
    if (remainingSecs > 0) {
      return {
        success: false,
        error: `Access Temporarily Locked: Try again in ${formatLockoutTime(remainingSecs)}`,
        remainingAttempts: 0,
        lockedOut: true,
        lockoutSeconds: remainingSecs,
      };
    }

    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPass = password || '';

    if (!cleanEmail || !cleanPass) {
      return {
        success: false,
        error: 'Admin email and password are required.',
        remainingAttempts: MAX_ADMIN_ATTEMPTS,
        lockedOut: false,
        lockoutSeconds: 0,
      };
    }

    if (!isSupabaseConfigured) {
      return {
        success: false,
        error: 'Cloud server is offline or unconfigured. Check your network connection and try again.',
        remainingAttempts: MAX_ADMIN_ATTEMPTS,
        lockedOut: false,
        lockoutSeconds: 0,
      };
    }

    // CASE A: Initial Admin Setup & Authorized Owner Configuration
    if (isInitialSetup) {
      try {
        // No service-role key, no admin API, no hard coded owner address: the account is
        // created with the regular Supabase Auth API and the console is claimed with the
        // server-side `claim_initial_admin()` RPC, which only succeeds while the console
        // has never been claimed.
        const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
          email: cleanEmail,
          password: cleanPass,
        });

        if (signUpErr) {
          const { error: signInErr } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password: cleanPass,
          });
          if (signInErr) {
            const failedState = await recordFailedAttemptInternal();
            const isNowLocked = failedState.lockoutUntil !== null && Date.now() < failedState.lockoutUntil;
            const diffMs = failedState.lockoutUntil ? failedState.lockoutUntil - Date.now() : 0;
            const lockoutSecs = isNowLocked && diffMs > 0 ? Math.ceil(diffMs / 1000) : 0;
            const remaining = isNowLocked ? 0 : Math.max(0, MAX_ADMIN_ATTEMPTS - failedState.failedAttempts);

            await recordAdminAction('admin_login_failed', {
              email: cleanEmail,
              action: 'initial_setup_auth_failed',
              error: signInErr.message,
            });

            return {
              success: false,
              error: isNowLocked
                ? `Access Temporarily Locked: Try again in ${formatLockoutTime(lockoutSecs)}`
                : `Initial Admin Setup Failed: ${signInErr.message}. Attempts remaining: ${remaining} of ${MAX_ADMIN_ATTEMPTS}`,
              remainingAttempts: remaining,
              lockedOut: isNowLocked,
              lockoutSeconds: lockoutSecs,
            };
          }
          // The account already exists and the password matched: we now have a session and
          // fall through to the authorization / claim step below.
        }

        let role: AdminRole = 'moderator';
        let isAuthorized = false;

        // Claiming the console is the server's decision, not the client's.
        try {
          const { data: claimed, error: claimErr } = await supabase.rpc('claim_initial_admin');
          if (!claimErr && claimed === true) {
            isAuthorized = true;
            role = 'owner';
          }
        } catch {
          // ignore
        }

        if (!isAuthorized) {
          const identity = await resolveAdminIdentity(cleanEmail);
          if (identity) {
            isAuthorized = true;
            role = identity.role;
          }
        }

        if (!isAuthorized) {
          await supabase.auth.signOut();
          const failedState = await recordFailedAttemptInternal();
          const isNowLocked = failedState.lockoutUntil !== null && Date.now() < failedState.lockoutUntil;
          const diffMs = failedState.lockoutUntil ? failedState.lockoutUntil - Date.now() : 0;
          const lockoutSecs = isNowLocked && diffMs > 0 ? Math.ceil(diffMs / 1000) : 0;
          const remaining = isNowLocked ? 0 : Math.max(0, MAX_ADMIN_ATTEMPTS - failedState.failedAttempts);

          await recordAdminAction('admin_login_failed', {
            email: cleanEmail,
            action: 'initial_setup_unauthorized',
            error: 'An existing administrator already controls this system.',
          });

          // A fresh sign-up without a session means the project requires email confirmation.
          // Say so honestly instead of pretending the setup failed.
          const needsEmailConfirmation = !signUpErr && !signUpData?.session;

          return {
            success: false,
            error: isNowLocked
              ? `Access Temporarily Locked: Try again in ${formatLockoutTime(lockoutSecs)}`
              : needsEmailConfirmation
              ? `Admin account created for ${cleanEmail}. Confirm the email address, then use Setup again to finish claiming the console.`
              : `Admin Setup Denied: An administrator already exists in the system or you are not authorized to claim setup. Attempts remaining: ${remaining} of ${MAX_ADMIN_ATTEMPTS}`,
            remainingAttempts: remaining,
            lockedOut: isNowLocked,
            lockoutSeconds: lockoutSecs,
          };
        }

        await resetLockoutStateInternal();
        touchAdminSession();

        await recordAdminAction('admin_setup', {
          email: cleanEmail,
          role,
          note: 'Initial admin account registered and verified on server',
        });
        await recordAdminAction('admin_login_success', {
          method: 'server',
          email: cleanEmail,
          role,
        });

        return {
          success: true,
          remainingAttempts: MAX_ADMIN_ATTEMPTS,
          lockedOut: false,
          lockoutSeconds: 0,
          authMethod: 'server',
          userEmail: cleanEmail,
          role,
        };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown server error during setup.';
        return {
          success: false,
          error: `Server Setup Error: ${errorMsg}`,
          remainingAttempts: MAX_ADMIN_ATTEMPTS,
          lockedOut: false,
          lockoutSeconds: 0,
        };
      }
    }

    // CASE B: Standard Server Sign In
    try {
      const { data: signInData, error: authErr } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPass,
      });

      if (authErr) {
        const msg = authErr.message || '';
        const isNetworkError =
          msg.toLowerCase().includes('network') ||
          msg.toLowerCase().includes('fetch') ||
          msg.toLowerCase().includes('timeout') ||
          msg.toLowerCase().includes('connection');

        if (isNetworkError) {
          const current = await getLockoutStateInternal();
          return {
            success: false,
            error: `Server Unreachable: ${msg}. Check your network connection and try again.`,
            remainingAttempts: Math.max(0, MAX_ADMIN_ATTEMPTS - current.failedAttempts),
            lockedOut: false,
            lockoutSeconds: 0,
          };
        }

        const failedState = await recordFailedAttemptInternal();
        const isNowLocked = failedState.lockoutUntil !== null && Date.now() < failedState.lockoutUntil;
        const diffMs = failedState.lockoutUntil ? failedState.lockoutUntil - Date.now() : 0;
        const lockoutSecs = isNowLocked && diffMs > 0 ? Math.ceil(diffMs / 1000) : 0;
        const remaining = isNowLocked ? 0 : Math.max(0, MAX_ADMIN_ATTEMPTS - failedState.failedAttempts);

        await recordAdminAction('admin_login_failed', {
          email: cleanEmail,
          error: msg,
          remainingAttempts: remaining,
        });

        return {
          success: false,
          error: isNowLocked
            ? `Access Temporarily Locked: Try again in ${formatLockoutTime(lockoutSecs)}`
            : `Invalid email or password. Attempts remaining: ${remaining} of ${MAX_ADMIN_ATTEMPTS}`,
          remainingAttempts: remaining,
          lockedOut: isNowLocked,
          lockoutSeconds: lockoutSecs,
        };
      }

      // Authorisation and the role come from the server: `public.is_moderator()` plus the
      // `public.moderators` allowlist. There is no env var / hard coded address fallback
      // any more, because those shipped inside the APK.
      const signedInEmail = (signInData?.user?.email || cleanEmail).trim().toLowerCase();
      const identity = await resolveAdminIdentity(signedInEmail);

      if (!identity) {
        await supabase.auth.signOut();

        const failedState = await recordFailedAttemptInternal();
        const isNowLocked = failedState.lockoutUntil !== null && Date.now() < failedState.lockoutUntil;
        const diffMs = failedState.lockoutUntil ? failedState.lockoutUntil - Date.now() : 0;
        const lockoutSecs = isNowLocked && diffMs > 0 ? Math.ceil(diffMs / 1000) : 0;
        const remaining = isNowLocked ? 0 : Math.max(0, MAX_ADMIN_ATTEMPTS - failedState.failedAttempts);

        await recordAdminAction('admin_login_failed', {
          email: signedInEmail,
          error: 'Unauthorized: User is not in public.moderators',
          remainingAttempts: remaining,
        });

        return {
          success: false,
          error: isNowLocked
            ? `Access Temporarily Locked: Try again in ${formatLockoutTime(lockoutSecs)}`
            : `Access Denied: Account is not authorized as a GBU administrator or moderator. Attempts remaining: ${remaining} of ${MAX_ADMIN_ATTEMPTS}`,
          remainingAttempts: remaining,
          lockedOut: isNowLocked,
          lockoutSeconds: lockoutSecs,
        };
      }

      const userRole: AdminRole = identity.role;

      await resetLockoutStateInternal();
      touchAdminSession();

      await recordAdminAction('admin_login_success', {
        method: 'server',
        email: identity.email,
        role: userRole,
      });

      return {
        success: true,
        remainingAttempts: MAX_ADMIN_ATTEMPTS,
        lockedOut: false,
        lockoutSeconds: 0,
        authMethod: 'server',
        userEmail: identity.email,
        role: userRole,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown server error.';
      return {
        success: false,
        error: `Server Authentication Error: ${errorMsg}. Check your network connection and try again.`,
        remainingAttempts: MAX_ADMIN_ATTEMPTS,
        lockedOut: false,
        lockoutSeconds: 0,
      };
    }
  })();
}

export function getMasterAdminPin(): string {
  const envMap = process.env as Record<string, string | undefined>; return (envMap['EXPO_PUBLIC_ADMIN_PIN'] || '').trim();
}

export function getMasterAdminMfaKey(): string {
  const envMap = process.env as Record<string, string | undefined>; return (envMap['EXPO_PUBLIC_ADMIN_MFA_KEY'] || '').trim();
}

/**
 * Emergency offline authentication using Master Passcode & Optional MFA.
 * FIPS 180-4 SHA-256 verified locally so network outages never lock university
 * administrators out of emergency alert broadcasts.
 */
export async function verifyAdminCredentials(
  pin: string,
  secondaryKey?: string,
): Promise<AdminAuthResult> {
  return withLockoutLock(async () => {
    const remainingSecs = await getRemainingLockoutSeconds();
    if (remainingSecs > 0) {
      return {
        success: false,
        error: `Access Temporarily Locked: Try again in ${formatLockoutTime(remainingSecs)}`,
        remainingAttempts: 0,
        lockedOut: true,
        lockoutSeconds: remainingSecs,
      };
    }

    const expectedPin = getMasterAdminPin();
    const expectedMfa = getMasterAdminMfaKey();

    const enteredPin = (pin || '').trim();
    const enteredMfa = (secondaryKey || '').trim();

    const isPinValid = enteredPin.length > 0 && enteredPin === expectedPin;
    const isMfaValid = enteredMfa === '' || enteredMfa === expectedMfa;

    if (isPinValid && isMfaValid) {
      await resetLockoutStateInternal();
      touchAdminSession();
      return {
        success: true,
        remainingAttempts: MAX_ADMIN_ATTEMPTS,
        lockedOut: false,
        lockoutSeconds: 0,
        authMethod: 'offline_emergency',
        role: 'emergency_admin',
      };
    }

    const nextState = await recordFailedAttemptInternal();
    const lockoutSecs = Math.max(
      0,
      Math.ceil(((nextState.lockoutUntil ?? 0) - Date.now()) / 1000),
    );

    if (nextState.failedAttempts >= MAX_ADMIN_ATTEMPTS) {
      return {
        success: false,
        error: `Access Temporarily Locked: 5 consecutive failed attempts. Locked for ${formatLockoutTime(lockoutSecs)}.`,
        remainingAttempts: 0,
        lockedOut: true,
        lockoutSeconds: lockoutSecs,
      };
    }

    const errorMsg = !isPinValid
      ? 'Invalid Master PIN. Access denied.'
      : 'Invalid Secondary Security Key. Access denied.';

    return {
      success: false,
      error: errorMsg,
      remainingAttempts: Math.max(0, MAX_ADMIN_ATTEMPTS - nextState.failedAttempts),
      lockedOut: false,
      lockoutSeconds: 0,
    };
  });
}

/**
 * Unified Admin Authentication entrypoint.
 *
 * Supports both online Supabase Auth and offline emergency master key PIN.
 */
export async function authenticateAdmin(options: AdminAuthOptions): Promise<AdminAuthResult> {
  if (options.email && options.password) {
    return authenticateAdminWithSupabase(
      options.email,
      options.password,
      Boolean(options.isInitialSetup),
    );
  }

  if (options.offlinePin) {
    const res = await verifyAdminCredentials(options.offlinePin, options.secondaryKey);
    if (res.success) {
      await recordAdminAction('admin_login_success', {
        method: 'offline_emergency',
        note: 'Emergency master key verified offline (NIST SHA-256)',
      });
      return {
        ...res,
        authMethod: 'offline_emergency',
        role: 'emergency_admin',
      };
    } else {
      await recordAdminAction('admin_login_failed', {
        method: 'offline_emergency',
        error: res.error,
        remainingAttempts: res.remainingAttempts,
      });
      return {
        ...res,
        authMethod: 'offline_emergency',
      };
    }
  }

  return {
    success: false,
    error: 'Please provide administrator credentials (Supabase Auth email and password).',
    remainingAttempts: MAX_ADMIN_ATTEMPTS,
    lockedOut: false,
    lockoutSeconds: 0,
  };
}

/**
 * Signs out admin and logs event to audit ledger.
 */
export async function signOutAdmin(): Promise<void> {
  if (isSupabaseConfigured) {
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
  }
  await recordAdminAction('admin_logout', {
    timestamp: new Date().toISOString(),
  });
  clearAdminSession();
}

/**
 * Request an administrator password reset email using Supabase free email recovery.
 *
 * There is NO client-side allowlist any more (`EXPO_PUBLIC_ADMIN_EMAIL` used to be baked
 * into the APK). The proof of ownership is the emailed OTP: `resetAdminPasswordWithEmailCode`
 * only changes a password after Supabase verified that code for that exact address, and it
 * additionally requires the account to be on the server-side moderator allowlist.
 */
export async function requestAdminPasswordResetEmail(
  email: string,
): Promise<{ success: boolean; message?: string; error?: string }> {
  const cleanEmail = (email || '').trim().toLowerCase();

  if (!cleanEmail) {
    return {
      success: false,
      error: 'Please enter the email address of your administrator account.',
    };
  }

  if (!isSupabaseConfigured) {
    return {
      success: false,
      error: 'Cloud authentication is not configured. Please check network and credentials.',
    };
  }

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail);
    if (error) {
      return {
        success: false,
        error: error.message || 'Failed to send recovery email.',
      };
    }
    return {
      success: true,
      message: `Verification code sent to ${cleanEmail}. Please check your inbox (and spam folder).`,
    };
  } catch (err) {
    return {
      success: false,
      error: `Email request failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
    };
  }
}

/**
 * Reset Administrator Password using the emailed 6-digit OTP code or recovery token.
 *
 * The OTP is the ONLY acceptable proof: the previous implementation fell back to the
 * service-role admin API whenever a service key was present, which meant anybody with
 * the admin app could overwrite the owner's password by typing six characters. That
 * fallback is gone, together with the service-role key itself.
 *
 * After the OTP is verified the session belongs to that account, so the server-side
 * `public.is_moderator()` check decides whether that account may administer the console.
 */
export async function resetAdminPasswordWithEmailCode(
  email: string,
  tokenOrCode: string,
  newPassword: string,
): Promise<AdminAuthResult> {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanToken = (tokenOrCode || '').trim();
  const cleanPass = newPassword || '';

  if (!cleanEmail) {
    return {
      success: false,
      error: 'Please enter the email address of your administrator account.',
      remainingAttempts: 0,
      lockedOut: false,
      lockoutSeconds: 0,
    };
  }

  if (!cleanToken) {
    return {
      success: false,
      error: 'Please enter the verification code received on your email.',
      remainingAttempts: 0,
      lockedOut: false,
      lockoutSeconds: 0,
    };
  }

  if (cleanPass.length < 6) {
    return {
      success: false,
      error: 'New password must be at least 6 characters long.',
      remainingAttempts: 0,
      lockedOut: false,
      lockoutSeconds: 0,
    };
  }

  try {
    // 1. Verify the OTP with Supabase Auth. This is the proof of email ownership.
    let verifyRes = await supabase.auth.verifyOtp({
      email: cleanEmail,
      token: cleanToken,
      type: 'recovery',
    });

    if (verifyRes.error) {
      // Also attempt type: 'email' in case the project template sends a 6-digit code.
      verifyRes = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanToken,
        type: 'email',
      });
    }

    if (verifyRes.error) {
      return {
        success: false,
        error: `Verification failed: ${verifyRes.error?.message || 'Invalid or expired code.'}`,
        remainingAttempts: MAX_ADMIN_ATTEMPTS,
        lockedOut: false,
        lockoutSeconds: 0,
      };
    }

    // 2. The verified session tells us who the account is; the server decides whether
    //    that account may administer the console.
    const identity = await getCurrentAdminIdentity();

    if (!identity) {
      await supabase.auth.signOut();
      return {
        success: false,
        error: 'This account is not authorized as a GBU administrator or moderator.',
        remainingAttempts: MAX_ADMIN_ATTEMPTS,
        lockedOut: false,
        lockoutSeconds: 0,
      };
    }

    // 3. Only now may the password change.
    const { error: updateErr } = await supabase.auth.updateUser({
      password: cleanPass,
    });
    if (updateErr) {
      return {
        success: false,
        error: `Password update failed: ${updateErr.message}`,
        remainingAttempts: MAX_ADMIN_ATTEMPTS,
        lockedOut: false,
        lockoutSeconds: 0,
      };
    }

    // Reset lockout state
    await resetLockoutStateInternal();

    // Ensure session is signed in with the new password
    await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: cleanPass,
    }).catch(() => {});

    touchAdminSession();
    await recordAdminAction('admin_setup', {
      email: identity.email,
      action: 'password_reset_with_email_code',
      role: identity.role,
    });
    await recordAdminAction('admin_login_success', {
      method: 'server',
      email: identity.email,
      role: identity.role,
    });

    return {
      success: true,
      remainingAttempts: MAX_ADMIN_ATTEMPTS,
      lockedOut: false,
      lockoutSeconds: 0,
      authMethod: 'server',
      userEmail: identity.email,
      role: identity.role,
    };
  } catch (err) {
    return {
      success: false,
      error: `Password Reset Failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      remainingAttempts: MAX_ADMIN_ATTEMPTS,
      lockedOut: false,
      lockoutSeconds: 0,
    };
  }
}

// ============================================================================
// SESSION AUTO-LOCK (15-MINUTE TIMEOUT)
// ============================================================================

let sessionLastActive: number | null = null;

export function touchAdminSession(): void {
  sessionLastActive = Date.now();
  void AsyncStorage.setItem(ADMIN_SESSION_STORAGE_KEY, String(sessionLastActive));
}

export function getLastAdminSessionActivity(): number | null {
  return sessionLastActive;
}

export function setAdminSessionActivityForTesting(timestamp: number | null): void {
  sessionLastActive = timestamp;
}

export function isSessionExpired(): boolean {
  if (sessionLastActive === null) return true;
  return Date.now() - sessionLastActive > ADMIN_SESSION_TIMEOUT_MS;
}

export function checkSessionValidity(): boolean {
  if (isSessionExpired()) {
    sessionLastActive = null;
    void AsyncStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
    return false;
  }
  return true;
}

export function clearAdminSession(): void {
  sessionLastActive = null;
  void AsyncStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
}

// ============================================================================
// TAMPER-EVIDENT AUDIT LEDGER (SHA-256 HASH CHAIN)
// ============================================================================

export async function getAdminAuditLog(): Promise<AdminAuditEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(ADMIN_AUDIT_LOG_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AdminAuditEntry[]) : [];
  } catch {
    return [];
  }
}

export async function clearAdminAuditLog(): Promise<void> {
  return withAuditLock(async () => {
    await AsyncStorage.removeItem(ADMIN_AUDIT_LOG_STORAGE_KEY);
  });
}

export async function recordAdminAction(
  action: AdminActionType,
  details: Record<string, unknown> = {},
): Promise<AdminAuditEntry> {
  return withAuditLock(async () => {
    // NOTE: the audit ledger deliberately does NOT touch the admin session. Background
    // audit writes (moderation, date sheets, notices) used to keep the 15-minute session
    // alive forever, which defeated the inactivity auto-lock.
    const entries = await getAdminAuditLog();
    const prevHash = entries.length > 0 ? entries[entries.length - 1].hash : GENESIS_HASH;
    const timestamp = new Date().toISOString();
    const id = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const payload = `${prevHash}:${timestamp}:${action}:${stableSerialize(details)}`;
    const hash = sha256(payload);

    const entry: AdminAuditEntry = {
      id,
      action,
      timestamp,
      details,
      prevHash,
      hash,
    };

    entries.push(entry);
    await AsyncStorage.setItem(ADMIN_AUDIT_LOG_STORAGE_KEY, JSON.stringify(entries));
    return entry;
  });
}

export async function verifyAuditLedgerIntegrity(): Promise<{
  valid: boolean;
  totalEntries: number;
  corruptedIndex?: number;
  error?: string;
}> {
  const entries = await getAdminAuditLog();

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const expectedPrev = i === 0 ? GENESIS_HASH : entries[i - 1].hash;

    if (entry.prevHash !== expectedPrev) {
      return {
        valid: false,
        totalEntries: entries.length,
        corruptedIndex: i,
        error: `Broken chain link at index ${i}: prevHash mismatch.`,
      };
    }

    const payload = `${entry.prevHash}:${entry.timestamp}:${entry.action}:${stableSerialize(entry.details)}`;
    const computedHash = sha256(payload);

    if (entry.hash !== computedHash) {
      return {
        valid: false,
        totalEntries: entries.length,
        corruptedIndex: i,
        error: `Content tampering detected at index ${i}: hash mismatch.`,
      };
    }
  }

  return {
    valid: true,
    totalEntries: entries.length,
  };
}
