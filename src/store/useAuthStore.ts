import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { queryClient } from '../lib/queryClient';
import { useAttendanceStore, INITIAL_ATTENDANCE } from '../features/attendance/attendanceStore';
import { useMailStore } from './useMailStore';
import { INITIAL_STUDENT_EMAILS } from '../features/mail/mailService';
import {
  ADMIN_REPORTS_STORAGE_KEY,
  LOCAL_REPORTS_STORAGE_KEY,
} from '../features/reports/reportsService';
import {
  createInitialAuthState,
  transitionAuth,
  type AuthMachineEvent,
  type AuthMachineState,
} from '../state/authMachine';

export const CLASS_SELECTION_STORAGE_KEY = '@gbu_one_class_selection';
export const USER_PROFILE_STORAGE_KEY = '@gbu_one_user_profile';
export const DEVICE_UNIQUE_STUDENT_ID_KEY = '@gbu_one_device_unique_student_id';
export const GUEST_AVATAR_ID_KEY = '@gbu_one_guest_avatar_id';
export const GUEST_NAME_KEY = '@gbu_one_guest_name';
/**
 * The onboarding flag lives here, in the store, and nowhere else. Older
 * builds wrote the same key straight from the onboarding screen; the store
 * now owns it so there is exactly one source of truth.
 */
export const ONBOARDING_SEEN_STORAGE_KEY = '@gbu_one_has_seen_onboarding';
export const MIN_PASSWORD_LENGTH = 8;

export const INVALID_CREDENTIALS_MESSAGE = "That roll number or password doesn't match.";
export const NETWORK_ERROR_MESSAGE = 'Could not reach the server. Check your connection and try again.';
export const DUPLICATE_EMAIL_MESSAGE = 'That email is already registered. Try logging in.';
export const OFFLINE_SESSION_MESSAGE =
  'Offline mode: the server is not configured, so this sign-in was not verified.';

export interface ClassSelection {
  school: string; // e.g. 'SOICT'
  programme: string; // e.g. 'B.Tech (CS)'
  programmeCode: string; // e.g. 'BCS'
  semester: string; // e.g. 'II'
  section: string; // e.g. 'BCS-II B'
}

/**
 * Where an identity came from.
 *
 * - `supabase` - the server verified the session. This is the only source
 *   that counts as a real sign-in.
 * - `offline` - a local-only identity (the offline build, or a stored profile
 *   the server could not confirm). It is NOT a verified sign-in.
 * - `guest` - no account at all.
 */
export type AuthSource = 'supabase' | 'offline' | 'guest';

export interface UserProfile {
  id: string;
  rollNo: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  avatarId?: string;
  uniqueStudentId?: string;
  classSelection?: ClassSelection | null;
  /**
   * Legacy flag. Kept so a profile written before `authSource` existed still
   * parses; `authSource` is the field everything reads now.
   */
  isOfflineSession?: boolean;
  /** Where this identity came from. Only `supabase` is server-verified. */
  authSource?: AuthSource;
}

export function generateUniqueStudentId(): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `GBU-${result}`;
}

/**
 * The source of a stored profile.
 *
 * Profiles written before `authSource` existed only carried
 * `isOfflineSession`, so that flag is used as the fallback. A guest profile
 * is always a guest, whatever else it says.
 */
export function resolveAuthSource(
  profile: Pick<UserProfile, 'authSource' | 'rollNo' | 'isOfflineSession'> | null | undefined,
): AuthSource {
  if (!profile) return 'guest';
  if (profile.authSource) return profile.authSource;
  if (!profile.rollNo || profile.rollNo === 'GUEST') return 'guest';
  return profile.isOfflineSession ? 'offline' : 'supabase';
}

/**
 * True when an identity exists but the server never confirmed it.
 *
 * Such a session must never be presented as a signed-in account: the UI has
 * to keep saying that it is not verified.
 */
export function isUnverifiedSession(
  user: UserProfile | null | undefined,
  isAuthenticated: boolean,
  isGuest: boolean,
): boolean {
  if (isAuthenticated) return false;
  if (isGuest) return false;
  return Boolean(user);
}

export interface AuthResult {
  success: boolean;
  error?: string;
  offline?: boolean;
}

export interface AuthState {
  user: UserProfile | null;
  /**
   * True only when the SERVER verified the session. An offline (local-only)
   * session is deliberately not "authenticated": it must never be mistaken
   * for a real sign-in.
   */
  isAuthenticated: boolean;
  /** True when there is no account at all - the app runs in guest mode. */
  isGuest: boolean;
  /**
   * The typed S2 auth state machine (`src/state/authMachine.ts`).
   *
   * This is the SINGLE source of truth for the authentication lifecycle:
   * `isGuest` and `isAuthenticated` are derived from it, never set
   * independently. The machine states are:
   *
   *   uninitialized -> onboarding | guest | unverified | authenticated | locked
   *
   * `unverified` is the "a profile was stored but the server could not
   * confirm the session" state. It is deliberately distinct from `guest`
   * (the student did not choose guest mode) and from `authenticated` (the
   * server did not say so).
   */
  authState: AuthMachineState;
  /** True once `initAuth` has read the device and asked the server who we are. */
  hydrated: boolean;
  hasCompletedOnboarding: boolean;
  hasClassSetup: boolean;
  classSelection: ClassSelection | null;

  // Actions
  initAuth: () => Promise<void>;
  login: (rollNo: string, password: string) => Promise<AuthResult>;
  register: (data: { rollNo: string; name: string; email: string; password: string }) => Promise<AuthResult>;
  requestPasswordReset: (email: string) => Promise<AuthResult>;
  loginAsGuest: () => void;
  completeOnboarding: () => void;
  setClassSelection: (selection: ClassSelection) => void;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  logout: () => Promise<void>;
  /** Removes every trace of the previous user from this device. */
  clearLocalSession: () => Promise<void>;
}

interface AuthErrorLike {
  message?: string | null;
  code?: string | null;
  status?: number | null;
}

/** The parts of a Supabase session this store cares about. */
interface SessionLike {
  user?: {
    id?: string;
    email?: string | null;
    user_metadata?: Record<string, unknown> | null;
  } | null;
}

/**
 * The auth API as it is actually used here.
 *
 * Typed loosely on purpose: the client is mocked in tests and older builds
 * may not expose every method, so every call is checked before it is made.
 */
interface AuthApiLike {
  getSession?: () => Promise<{ data: { session: SessionLike | null }; error: unknown }>;
  onAuthStateChange?: (
    callback: (event: string, session: SessionLike | null) => void,
  ) => { data?: { subscription?: { unsubscribe?: () => void } } };
}

function authApi(): AuthApiLike {
  return supabase.auth as unknown as AuthApiLike;
}

/**
 * The Supabase account email for whatever was typed in the login box.
 *
 * A roll number maps onto the student domain, and anything that is already an
 * email is used as it is — that is how the owner's admin account (and any
 * future staff account) signs in from the same screen. The account is ours,
 * never a university one: no university password is ever collected
 * (docs/SCREENS_AUTH.md, docs/ADMIN_MODERATION.md).
 *
 * Only the separators a roll number is written with are removed. Every other
 * character is kept, so two roll numbers that genuinely differ cannot be
 * folded onto one account. The original roll number is always kept in the
 * profile, so the mapping stays reversible.
 */
export function toLoginEmail(identifier: string): string {
  const value = identifier.trim().toLowerCase();
  if (value.includes('@')) return value;
  return `${value.replace(/[\s/-]+/g, '')}@gbu.ac.in`;
}

const describeAuthError = (
  error: AuthErrorLike,
  context: 'login' | 'register' | 'reset'
): string => {
  const code = (error.code ?? '').toLowerCase();
  const status = error.status ?? 0;
  const message = (error.message ?? '').toLowerCase();

  if (
    status === 429 ||
    code.includes('rate_limit') ||
    message.includes('rate limit') ||
    message.includes('too many')
  ) {
    return 'Too many attempts. Wait a minute and try again.';
  }

  if (
    message.includes('network') ||
    message.includes('failed to fetch') ||
    message.includes('timeout') ||
    message.includes('econnrefused')
  ) {
    return NETWORK_ERROR_MESSAGE;
  }

  if (
    code === 'user_already_exists' ||
    code === 'email_exists' ||
    message.includes('already registered') ||
    message.includes('already been registered') ||
    message.includes('already exists')
  ) {
    return DUPLICATE_EMAIL_MESSAGE;
  }

  if (
    code === 'weak_password' ||
    code === 'password_too_short' ||
    message.includes('password should be at least') ||
    message.includes('password is too short')
  ) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  if (code === 'email_not_confirmed' || message.includes('email not confirmed')) {
    return 'Confirm your email address first, then log in.';
  }

  if (
    code === 'invalid_credentials' ||
    code === 'user_not_found' ||
    message.includes('invalid login credentials') ||
    message.includes('invalid credentials') ||
    message.includes('user not found')
  ) {
    return INVALID_CREDENTIALS_MESSAGE;
  }

  if (context === 'register') {
    return 'Could not create the account. Please try again.';
  }
  if (context === 'reset') {
    return 'Could not start the password reset. Please try again.';
  }
  return 'Sign-in failed. Please try again.';
};

let cachedDeviceId: string | null = null;
let cachedAvatarId: string | null = null;
let cachedGuestName: string | null = null;
let authSubscription: { unsubscribe?: () => void } | null = null;

/**
 * Every key that holds personal data on this device.
 *
 * `DEVICE_UNIQUE_STUDENT_ID_KEY` is deliberately NOT in this list: it names
 * the phone, not the person, and it is what carries a guest identity over to
 * an account (tests/auth.test.ts). The name, the avatar, the class, the
 * attendance and the reports are the personal parts, and they go.
 */
const PERSONAL_STORAGE_KEYS = [
  USER_PROFILE_STORAGE_KEY,
  GUEST_NAME_KEY,
  GUEST_AVATAR_ID_KEY,
  CLASS_SELECTION_STORAGE_KEY,
  LOCAL_REPORTS_STORAGE_KEY,
  ADMIN_REPORTS_STORAGE_KEY,
];

/**
 * The guest / authenticated flags are DERIVED from the auth state machine.
 *
 * They used to be set independently at nine different places, which is how
 * "signed out" and "signed in" could disagree. The machine is now the only
 * place that decides.
 */
function flagsFromAuthState(state: AuthMachineState): {
  isGuest: boolean;
  isAuthenticated: boolean;
} {
  switch (state.value) {
    case 'authenticated':
      return { isGuest: false, isAuthenticated: true };
    case 'unverified':
      // A remembered profile the server could not confirm. Not a guest (the
      // student did not choose that) and not authenticated (the server did
      // not say so).
      return { isGuest: false, isAuthenticated: false };
    case 'locked':
      return { isGuest: false, isAuthenticated: false };
    case 'guest':
    case 'onboarding':
    case 'uninitialized':
    default:
      return { isGuest: true, isAuthenticated: false };
  }
}

/**
 * Applies one event to the auth state machine and returns the new machine
 * state together with the derived flags.
 *
 * If the machine REJECTS the event the current state is kept and the reason
 * is logged. A modelling gap must never be able to leave a student stuck in
 * a screen they cannot leave, so the caller still receives a usable state.
 */
function applyAuthEvent(
  current: AuthMachineState,
  event: AuthMachineEvent,
): { authState: AuthMachineState; isGuest: boolean; isAuthenticated: boolean } {
  const result = transitionAuth(current, event);
  if (!result.ok) {
    console.warn(
      `[gbu-one] the auth state machine rejected '${event.type}' from '${current.value}': ${result.error}`,
    );
    return { authState: current, ...flagsFromAuthState(current) };
  }
  return { authState: result.state, ...flagsFromAuthState(result.state) };
}

/**
 * Wipes the previous user from the device.
 *
 * The storage calls are issued straight away (they are not awaited inside),
 * so the data is gone even if the network sign-out never returns.
 */
function clearPersonalData(): Promise<void> {
  const next = applyAuthEvent(useAuthStore.getState().authState, { type: 'LOGOUT' });
  useAuthStore.setState({
    user: null,
    hasClassSetup: false,
    classSelection: null,
    ...next,
  });

  // Cached server data and the local stores hold the previous student's
  // personal bits; the next user of a shared phone inherits nothing.
  queryClient.clear();
  useAttendanceStore.setState({ subjects: INITIAL_ATTENDANCE });
  useAttendanceStore.persist.clearStorage();
  useMailStore.setState({
    emails: INITIAL_STUDENT_EMAILS,
    activeCategory: 'all',
    searchQuery: '',
    selectedEmail: null,
  });
  useMailStore.persist.clearStorage();

  cachedGuestName = null;
  cachedAvatarId = null;

  return Promise.all(
    PERSONAL_STORAGE_KEYS.map((key) => AsyncStorage.removeItem(key).catch(() => {})),
  ).then(() => undefined);
}

/** The signed-in Supabase session, or null when there is none. */
async function readServerSession(): Promise<SessionLike['user'] | null> {
  if (!isSupabaseConfigured) return null;
  const getSession = authApi().getSession;
  if (typeof getSession !== 'function') return null;
  try {
    const { data, error } = await getSession.call(supabase.auth);
    if (error || !data?.session?.user?.id) return null;
    return data.session.user;
  } catch {
    // Offline or the client is unavailable: treat it as "no live session".
    return null;
  }
}

/** The name a session carries, if any. */
function sessionName(user: SessionLike['user']): string | null {
  const metadata = user?.user_metadata;
  if (!metadata) return null;
  const name = metadata.name;
  return typeof name === 'string' && name.trim() ? name.trim() : null;
}

/** The roll number a session carries, if any. */
function sessionRollNo(user: SessionLike['user']): string | null {
  const metadata = user?.user_metadata;
  if (!metadata) return null;
  const roll = metadata.roll_no;
  return typeof roll === 'string' && roll.trim() ? roll.trim() : null;
}

/**
 * Watches the server session.
 *
 * Without this the app would never learn that a session expired or was
 * revoked, and would keep rendering the previous user's cached data.
 */
function subscribeToAuthEvents(): void {
  if (authSubscription) return;
  if (!isSupabaseConfigured) return;
  const onAuthStateChange = authApi().onAuthStateChange;
  if (typeof onAuthStateChange !== 'function') return;

  try {
    const result = onAuthStateChange.call(supabase.auth, (event, session) => {
      if (event === 'SIGNED_OUT') {
        // The server ended the session (revoked, expired or signed out from
        // another device): the local identity goes with it.
        void useAuthStore.getState().clearLocalSession();
        return;
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        applySessionToProfile(session?.user ?? null);
      }
    });
    authSubscription = result?.data?.subscription ?? null;
  } catch {
    // A client without auth events is fine; the app still works offline.
  }
}

/** Refreshes the stored profile from a live session. */
function applySessionToProfile(user: SessionLike['user']): void {
  if (!user?.id) return;
  const current = useAuthStore.getState().user;
  if (!current) return;

  const name = sessionName(user) ?? current.name;
  const email = user.email ?? current.email;
  const rollNo = sessionRollNo(user) ?? current.rollNo;

  if (
    current.authSource === 'supabase' &&
    current.name === name &&
    current.email === email &&
    current.rollNo === rollNo
  ) {
    return;
  }

  const updated: UserProfile = {
    ...current,
    name,
    email,
    rollNo,
    authSource: 'supabase',
    isOfflineSession: false,
  };
  useAuthStore.setState({
    user: updated,
    ...applyAuthEvent(useAuthStore.getState().authState, {
      type: 'LOGIN_SUCCESS',
      payload: {
        userId: updated.id ?? 'user',
        rollNo: updated.rollNo,
        email: updated.email,
        name: updated.name,
      },
    }),
  });
  AsyncStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(updated)).catch(() => {});
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  // The auth state machine owns the lifecycle; the two flags are derived
  // from it (see flagsFromAuthState).
  authState: createInitialAuthState(),
  isGuest: true, // Guest mode until the store knows better.
  isAuthenticated: false,
  hydrated: false,
  hasCompletedOnboarding: false,
  hasClassSetup: false,
  classSelection: {
    school: 'SOICT',
    programme: 'B.Tech (CS)',
    programmeCode: 'BCS',
    semester: 'II',
    section: 'BCS-II B',
  },

  initAuth: async () => {
    try {
      const [savedClass, savedUser, savedDeviceId, savedAvatarId, savedGuestName, seenOnboarding] =
        await Promise.all([
          AsyncStorage.getItem(CLASS_SELECTION_STORAGE_KEY),
          AsyncStorage.getItem(USER_PROFILE_STORAGE_KEY),
          AsyncStorage.getItem(DEVICE_UNIQUE_STUDENT_ID_KEY),
          AsyncStorage.getItem(GUEST_AVATAR_ID_KEY),
          AsyncStorage.getItem(GUEST_NAME_KEY),
          AsyncStorage.getItem(ONBOARDING_SEEN_STORAGE_KEY),
        ]);

      cachedDeviceId = savedDeviceId;
      cachedAvatarId = savedAvatarId;
      cachedGuestName = savedGuestName;

      const updates: Partial<AuthState> = {
        hydrated: true,
        hasCompletedOnboarding: seenOnboarding === 'true',
      };

      if (savedClass) {
        try {
          updates.classSelection = JSON.parse(savedClass);
          updates.hasClassSetup = true;
        } catch (_) {
          // ignore corrupted class selection
        }
      }

      let storedProfile: UserProfile | null = null;
      if (savedUser) {
        try {
          storedProfile = JSON.parse(savedUser) as UserProfile;
        } catch (_) {
          // ignore corrupted user profile
          storedProfile = null;
        }
      }

      // Ask the server who the user is. This is the only thing that can say
      // whether a session is real: a stored profile alone proves nothing.
      const serverUser = await readServerSession();

      if (serverUser?.id) {
        // A live, server-verified session wins.
        const metadataName = sessionName(serverUser);
        const profile: UserProfile = {
          id: serverUser.id,
          rollNo: sessionRollNo(serverUser) ?? storedProfile?.rollNo ?? '',
          name: metadataName ?? storedProfile?.name ?? 'Student',
          email: serverUser.email ?? storedProfile?.email ?? '',
          avatarUrl: storedProfile?.avatarUrl ?? null,
          avatarId: storedProfile?.avatarId ?? cachedAvatarId ?? 'tech-scholar',
          uniqueStudentId:
            storedProfile?.uniqueStudentId ?? cachedDeviceId ?? generateUniqueStudentId(),
          classSelection: storedProfile?.classSelection ?? updates.classSelection ?? get().classSelection,
          isOfflineSession: false,
          authSource: 'supabase',
        };

        cachedDeviceId = profile.uniqueStudentId ?? cachedDeviceId;
        cachedAvatarId = profile.avatarId ?? cachedAvatarId;
        if (profile.name && profile.name !== 'Student') cachedGuestName = profile.name;

        AsyncStorage.setItem(DEVICE_UNIQUE_STUDENT_ID_KEY, cachedDeviceId ?? '').catch(() => {});
        AsyncStorage.setItem(GUEST_AVATAR_ID_KEY, cachedAvatarId ?? '').catch(() => {});
        if (cachedGuestName) AsyncStorage.setItem(GUEST_NAME_KEY, cachedGuestName).catch(() => {});
        AsyncStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(profile)).catch(() => {});

        updates.user = profile;
        updates.isGuest = false;
        updates.isAuthenticated = true;
        Object.assign(updates, applyAuthEvent(get().authState, {
          type: 'BOOT_EXISTING_USER',
          payload: {
            userId: profile.id ?? 'user',
            rollNo: profile.rollNo,
            email: profile.email,
            name: profile.name,
          },
        }));
      } else if (storedProfile) {
        // No live session. The stored profile is kept, but only as an
        // unverified offline state - never as a signed-in account.
        const source = resolveAuthSource(storedProfile);
        const profile: UserProfile = {
          ...storedProfile,
          uniqueStudentId:
            storedProfile.uniqueStudentId ?? cachedDeviceId ?? generateUniqueStudentId(),
          avatarId: storedProfile.avatarId ?? cachedAvatarId ?? 'tech-scholar',
          authSource: source === 'supabase' ? 'offline' : source,
          isOfflineSession: source !== 'guest',
        };

        cachedDeviceId = profile.uniqueStudentId ?? cachedDeviceId;
        cachedAvatarId = profile.avatarId ?? cachedAvatarId;
        if (profile.name && profile.name !== 'Student') cachedGuestName = profile.name;

        AsyncStorage.setItem(DEVICE_UNIQUE_STUDENT_ID_KEY, cachedDeviceId ?? '').catch(() => {});
        AsyncStorage.setItem(GUEST_AVATAR_ID_KEY, cachedAvatarId ?? '').catch(() => {});
        if (cachedGuestName) AsyncStorage.setItem(GUEST_NAME_KEY, cachedGuestName).catch(() => {});
        AsyncStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(profile)).catch(() => {});

        updates.user = profile;
        updates.isGuest = profile.authSource === 'guest';
        updates.isAuthenticated = false;
        // A stored profile the server could not confirm is its own state:
        // the student is not a guest and not signed in.
        Object.assign(
          updates,
          profile.authSource === 'guest'
            ? applyAuthEvent(get().authState, {
                type: 'BOOT_EXISTING_GUEST',
                payload: { guestId: profile.uniqueStudentId ?? 'guest', name: profile.name },
              })
            : applyAuthEvent(get().authState, {
                type: 'BOOT_OFFLINE_SESSION',
                payload: {
                  userId: profile.id ?? undefined,
                  rollNo: profile.rollNo,
                  email: profile.email,
                  name: profile.name,
                },
              }),
        );
      } else {
        // Nothing stored: a fresh guest profile for this device.
        if (!cachedDeviceId) {
          cachedDeviceId = generateUniqueStudentId();
          AsyncStorage.setItem(DEVICE_UNIQUE_STUDENT_ID_KEY, cachedDeviceId).catch(() => {});
        }
        if (!cachedAvatarId) {
          cachedAvatarId = 'tech-scholar';
          AsyncStorage.setItem(GUEST_AVATAR_ID_KEY, cachedAvatarId).catch(() => {});
        }
        const guestProfile: UserProfile = {
          id: 'guest',
          rollNo: 'GUEST',
          name: cachedGuestName || 'Student',
          email: '',
          uniqueStudentId: cachedDeviceId,
          avatarId: cachedAvatarId,
          classSelection: updates.classSelection || get().classSelection,
          isOfflineSession: true,
          authSource: 'guest',
        };
        updates.user = guestProfile;
        updates.isGuest = true;
        updates.isAuthenticated = false;
        Object.assign(
          updates,
          applyAuthEvent(get().authState, {
            type: 'BOOT_FIRST_LAUNCH',
          }),
        );
        AsyncStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(guestProfile)).catch(() => {});
      }

      set(updates);
      subscribeToAuthEvents();
    } catch (_) {
      // ignore storage hydration error
      set({ hydrated: true });
    }
  },

  login: async (rollNo: string, password: string) => {
    const typed = rollNo.trim();
    // A roll number is upper-cased for display; an email address (the owner's
    // admin account) is kept lower-case.
    const identifier = typed.includes('@') ? typed.toLowerCase() : typed.toUpperCase();
    if (!identifier || !password) {
      return { success: false, error: 'Please enter both roll number and password.' };
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return {
        success: false,
        error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      };
    }

    const [savedDeviceId, savedAvatarId, savedGuestName] = await Promise.all([
      AsyncStorage.getItem(DEVICE_UNIQUE_STUDENT_ID_KEY),
      AsyncStorage.getItem(GUEST_AVATAR_ID_KEY),
      AsyncStorage.getItem(GUEST_NAME_KEY),
    ]);

    const existing = get().user;
    const persistentUniqueId =
      savedDeviceId || existing?.uniqueStudentId || cachedDeviceId || generateUniqueStudentId();
    const persistentAvatarId =
      savedAvatarId || existing?.avatarId || cachedAvatarId || 'tech-scholar';
    const persistentGuestName =
      savedGuestName || (existing?.name && existing.name !== 'Student' ? existing.name : cachedGuestName);

    cachedDeviceId = persistentUniqueId;
    cachedAvatarId = persistentAvatarId;
    if (persistentGuestName) cachedGuestName = persistentGuestName;

    AsyncStorage.setItem(DEVICE_UNIQUE_STUDENT_ID_KEY, persistentUniqueId).catch(() => {});
    AsyncStorage.setItem(GUEST_AVATAR_ID_KEY, persistentAvatarId).catch(() => {});

    if (isSupabaseConfigured) {
      const accountEmail = toLoginEmail(identifier);

      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: accountEmail,
          password,
        });

        if (error) {
          return { success: false, error: describeAuthError(error, 'login') };
        }

        const signedInUser = data.user;
        if (!signedInUser) {
          return { success: false, error: 'Sign-in failed. Please try again.' };
        }

        const metadataName = signedInUser.user_metadata?.name;
        const userProfile: UserProfile = {
          id: signedInUser.id,
          rollNo: identifier,
          name: typeof metadataName === 'string' && metadataName ? metadataName : (persistentGuestName || 'Student'),
          email: signedInUser.email || accountEmail,
          avatarId: persistentAvatarId,
          uniqueStudentId: persistentUniqueId,
          classSelection: get().classSelection,
          isOfflineSession: false,
          authSource: 'supabase',
        };

        set({
          user: userProfile,
          hydrated: true,
          ...applyAuthEvent(get().authState, {
            type: 'LOGIN_SUCCESS',
            payload: {
              userId: userProfile.id ?? 'user',
              rollNo: userProfile.rollNo,
              email: userProfile.email,
              name: userProfile.name,
            },
          }),
        });

        await AsyncStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(userProfile)).catch(() => {});
        return { success: true, offline: false };
      } catch (_) {
        return { success: false, error: NETWORK_ERROR_MESSAGE };
      }
    }

    // Supabase is not configured: a local-only session for the offline build.
    // It is explicitly marked as unverified - it is not a signed-in account.
    const localUser: UserProfile = {
      id: `usr_${Date.now()}`,
      rollNo: identifier,
      name: persistentGuestName || 'Student',
      email: toLoginEmail(identifier),
      avatarId: persistentAvatarId,
      uniqueStudentId: persistentUniqueId,
      classSelection: get().classSelection,
      isOfflineSession: true,
      authSource: 'offline',
    };

    set({
      user: localUser,
      isGuest: false,
      isAuthenticated: true,
      hydrated: true,
    });

    await AsyncStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(localUser)).catch(() => {});
    return { success: true, offline: true };
  },

  register: async ({ rollNo, name, email, password }) => {
    const trimmedRoll = rollNo.trim().toUpperCase();
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedRoll || !trimmedName || !trimmedEmail || !password) {
      return { success: false, error: 'Please fill in all required fields.' };
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return {
        success: false,
        error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      };
    }

    const [savedDeviceId, savedAvatarId] = await Promise.all([
      AsyncStorage.getItem(DEVICE_UNIQUE_STUDENT_ID_KEY),
      AsyncStorage.getItem(GUEST_AVATAR_ID_KEY),
    ]);

    const existing = get().user;
    const persistentUniqueId =
      savedDeviceId || existing?.uniqueStudentId || cachedDeviceId || generateUniqueStudentId();
    const persistentAvatarId =
      savedAvatarId || existing?.avatarId || cachedAvatarId || 'tech-scholar';

    cachedDeviceId = persistentUniqueId;
    cachedAvatarId = persistentAvatarId;
    cachedGuestName = trimmedName;

    AsyncStorage.setItem(DEVICE_UNIQUE_STUDENT_ID_KEY, persistentUniqueId).catch(() => {});
    AsyncStorage.setItem(GUEST_AVATAR_ID_KEY, persistentAvatarId).catch(() => {});
    AsyncStorage.setItem(GUEST_NAME_KEY, trimmedName).catch(() => {});

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            data: {
              roll_no: trimmedRoll,
              name: trimmedName,
            },
          },
        });

        if (error) {
          return { success: false, error: describeAuthError(error, 'register') };
        }

        const signUpUser = data.user;
        if (!signUpUser) {
          return { success: false, error: 'Could not create the account. Please try again.' };
        }

        if (!data.session) {
          return {
            success: false,
            error: 'Account created. Confirm your email address, then log in.',
          };
        }

        const newUser: UserProfile = {
          id: signUpUser.id,
          rollNo: trimmedRoll,
          name: trimmedName,
          email: trimmedEmail,
          avatarId: persistentAvatarId,
          uniqueStudentId: persistentUniqueId,
          classSelection: get().classSelection,
          isOfflineSession: false,
          authSource: 'supabase',
        };

        set({
          user: newUser,
          hydrated: true,
          ...applyAuthEvent(get().authState, {
            type: 'LOGIN_SUCCESS',
            payload: {
              userId: newUser.id ?? 'user',
              rollNo: newUser.rollNo,
              email: newUser.email,
              name: newUser.name,
            },
          }),
        });

        await AsyncStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(newUser)).catch(() => {});
        return { success: true, offline: false };
      } catch (_) {
        return { success: false, error: NETWORK_ERROR_MESSAGE };
      }
    }

    // Supabase is not configured: a local-only account for the offline build.
    const localUser: UserProfile = {
      id: `usr_${Date.now()}`,
      rollNo: trimmedRoll,
      name: trimmedName,
      email: trimmedEmail,
      avatarId: persistentAvatarId,
      uniqueStudentId: persistentUniqueId,
      classSelection: get().classSelection,
      isOfflineSession: true,
      authSource: 'offline',
    };

    set({
      user: localUser,
      hydrated: true,
      // An offline session is NOT a verified sign-in. `isAuthenticated` means
      // "the server confirmed this", so it must stay false here - otherwise
      // a local-only session is indistinguishable from a real account and a
      // student believes they are signed in when they are not.
      ...applyAuthEvent(get().authState, {
        type: 'BOOT_OFFLINE_SESSION',
        payload: {
          userId: localUser.id ?? undefined,
          rollNo: localUser.rollNo,
          email: localUser.email,
          name: localUser.name,
        },
      }),
    });

    await AsyncStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(localUser)).catch(() => {});
    return { success: true, offline: true };
  },

  requestPasswordReset: async (email: string) => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      return { success: false, error: 'Enter the email address on your account.' };
    }

    if (!isSupabaseConfigured) {
      return {
        success: false,
        error:
          'Password reset needs the GBU One backend, which is not configured in this build.',
      };
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: 'gbuone://auth/reset',
      });

      if (error) {
        return { success: false, error: describeAuthError(error, 'reset') };
      }

      return { success: true };
    } catch (_) {
      return { success: false, error: NETWORK_ERROR_MESSAGE };
    }
  },

  loginAsGuest: () => {
    const existing = get().user;
    const persistentUniqueId =
      existing?.uniqueStudentId || cachedDeviceId || generateUniqueStudentId();
    const persistentAvatarId =
      existing?.avatarId || cachedAvatarId || 'tech-scholar';
    const persistentGuestName =
      (existing?.name && existing.name !== 'Student') ? existing.name : (cachedGuestName || 'Student');

    cachedDeviceId = persistentUniqueId;
    cachedAvatarId = persistentAvatarId;
    if (persistentGuestName && persistentGuestName !== 'Student') {
      cachedGuestName = persistentGuestName;
    }

    AsyncStorage.setItem(DEVICE_UNIQUE_STUDENT_ID_KEY, persistentUniqueId).catch(() => {});
    AsyncStorage.setItem(GUEST_AVATAR_ID_KEY, persistentAvatarId).catch(() => {});
    if (persistentGuestName && persistentGuestName !== 'Student') {
      AsyncStorage.setItem(GUEST_NAME_KEY, persistentGuestName).catch(() => {});
    }

    const guestUser: UserProfile = {
      id: 'guest',
      rollNo: 'GUEST',
      name: persistentGuestName || 'Student',
      email: '',
      uniqueStudentId: persistentUniqueId,
      avatarId: persistentAvatarId,
      classSelection: get().classSelection,
      isOfflineSession: true,
      authSource: 'guest',
    };

    set({
      user: guestUser,
      hydrated: true,
      ...applyAuthEvent(get().authState, {
        type: 'CONTINUE_AS_GUEST',
        payload: { guestId: guestUser.uniqueStudentId ?? 'guest', name: guestUser.name },
      }),
    });

    AsyncStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(guestUser)).catch(() => {});
  },

  completeOnboarding: () => {
    set({ hasCompletedOnboarding: true });
    AsyncStorage.setItem(ONBOARDING_SEEN_STORAGE_KEY, 'true').catch(() => {});
  },

  setClassSelection: (selection: ClassSelection) => {
    set((state) => ({
      classSelection: selection,
      hasClassSetup: true,
      user: state.user ? { ...state.user, classSelection: selection } : null,
    }));
    AsyncStorage.setItem(CLASS_SELECTION_STORAGE_KEY, JSON.stringify(selection)).catch(() => {});
  },

  updateProfile: async (updates: Partial<UserProfile>) => {
    const currentUser = get().user;
    const baseUser: UserProfile = currentUser ?? {
      id: `usr_${Date.now()}`,
      rollNo: 'GUEST',
      name: updates.name || cachedGuestName || 'Student',
      email: '',
      classSelection: get().classSelection,
      isOfflineSession: true,
      authSource: 'guest',
      uniqueStudentId: cachedDeviceId || generateUniqueStudentId(),
    };

    const finalUniqueId =
      updates.uniqueStudentId ?? baseUser.uniqueStudentId ?? cachedDeviceId ?? generateUniqueStudentId();
    const finalAvatarId =
      updates.avatarId ?? baseUser.avatarId ?? cachedAvatarId ?? 'tech-scholar';
    const finalName = updates.name ?? baseUser.name;

    cachedDeviceId = finalUniqueId;
    cachedAvatarId = finalAvatarId;
    if (finalName && finalName !== 'Student') {
      cachedGuestName = finalName;
      AsyncStorage.setItem(GUEST_NAME_KEY, finalName).catch(() => {});
    }

    AsyncStorage.setItem(DEVICE_UNIQUE_STUDENT_ID_KEY, finalUniqueId).catch(() => {});
    if (finalAvatarId) {
      AsyncStorage.setItem(GUEST_AVATAR_ID_KEY, finalAvatarId).catch(() => {});
    }

    const updatedUser: UserProfile = {
      ...baseUser,
      ...updates,
      uniqueStudentId: finalUniqueId,
      avatarId: finalAvatarId,
    };

    set({ user: updatedUser });
    await AsyncStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(updatedUser)).catch(() => {});
  },

  logout: async () => {
    // The in-memory state is cleared first and synchronously: a sign-out must
    // never leave the previous student's data on screen.
    set({
      user: null,
      ...applyAuthEvent(get().authState, { type: 'LOGOUT' }),
    });

    // The wipe is started now, not after the network call, so the personal
    // data is gone even when the server cannot be reached.
    const wipe = clearPersonalData();

    if (isSupabaseConfigured) {
      try {
        // Awaited: an unawaited sign-out leaves the refresh token on disk
        // while the app believes it is signed out.
        await supabase.auth.signOut();
      } catch (_) {
        // The server may be unreachable. The local session is gone either way.
      }
    }

    await wipe;
  },

  clearLocalSession: async () => {
    await clearPersonalData();
  },
}));

// Hydrate on startup
useAuthStore.getState().initAuth();

export default useAuthStore;
