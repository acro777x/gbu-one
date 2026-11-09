import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export const CLASS_SELECTION_STORAGE_KEY = '@gbu_one_class_selection';
export const USER_PROFILE_STORAGE_KEY = '@gbu_one_user_profile';
export const DEVICE_UNIQUE_STUDENT_ID_KEY = '@gbu_one_device_unique_student_id';
export const GUEST_AVATAR_ID_KEY = '@gbu_one_guest_avatar_id';
export const GUEST_NAME_KEY = '@gbu_one_guest_name';
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

export interface UserProfile {
  id: string;
  rollNo: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  avatarId?: string;
  uniqueStudentId?: string;
  classSelection?: ClassSelection | null;
  isOfflineSession?: boolean;
}

export function generateUniqueStudentId(): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `GBU-${result}`;
}

export interface AuthResult {
  success: boolean;
  error?: string;
  offline?: boolean;
}

export interface AuthState {
  user: UserProfile | null;
  isGuest: boolean;
  isAuthenticated: boolean;
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
  logout: () => void;
}

interface AuthErrorLike {
  message?: string | null;
  code?: string | null;
  status?: number | null;
}

/**
 * The Supabase account email for whatever was typed in the login box.
 *
 * A roll number maps onto the student domain, and anything that is already an
 * email is used as it is — that is how the owner's admin account (and any
 * future staff account) signs in from the same screen. The account is ours,
 * never a university one: no university password is ever collected
 * (docs/SCREENS_AUTH.md, docs/ADMIN_MODERATION.md).
 */
export function toLoginEmail(identifier: string): string {
  const value = identifier.trim().toLowerCase();
  if (value.includes('@')) return value;
  return `${value.replace(/[^a-z0-9]/g, '')}@gbu.ac.in`;
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

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isGuest: true, // Default to guest mode during development
  isAuthenticated: false,
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
      const [savedClass, savedUser, savedDeviceId, savedAvatarId, savedGuestName] =
        await Promise.all([
          AsyncStorage.getItem(CLASS_SELECTION_STORAGE_KEY),
          AsyncStorage.getItem(USER_PROFILE_STORAGE_KEY),
          AsyncStorage.getItem(DEVICE_UNIQUE_STUDENT_ID_KEY),
          AsyncStorage.getItem(GUEST_AVATAR_ID_KEY),
          AsyncStorage.getItem(GUEST_NAME_KEY),
        ]);

      cachedDeviceId = savedDeviceId;
      cachedAvatarId = savedAvatarId;
      cachedGuestName = savedGuestName;

      const updates: Partial<AuthState> = {};

      if (savedClass) {
        try {
          updates.classSelection = JSON.parse(savedClass);
          updates.hasClassSetup = true;
        } catch (_) {
          // ignore corrupted class selection
        }
      }

      if (savedUser) {
        try {
          const user: UserProfile = JSON.parse(savedUser);
          if (!user.uniqueStudentId) {
            user.uniqueStudentId = cachedDeviceId || generateUniqueStudentId();
          }
          if (!cachedDeviceId) {
            cachedDeviceId = user.uniqueStudentId;
            AsyncStorage.setItem(DEVICE_UNIQUE_STUDENT_ID_KEY, cachedDeviceId).catch(() => {});
          }
          if (!cachedAvatarId && user.avatarId) {
            cachedAvatarId = user.avatarId;
            AsyncStorage.setItem(GUEST_AVATAR_ID_KEY, cachedAvatarId).catch(() => {});
          }
          if (!cachedGuestName && user.name && user.name !== 'Student') {
            cachedGuestName = user.name;
            AsyncStorage.setItem(GUEST_NAME_KEY, cachedGuestName).catch(() => {});
          }

          AsyncStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(user)).catch(() => {});

          updates.user = user;
          const isGuestProfile =
            user.rollNo === 'GUEST' || (user.isOfflineSession && (!user.rollNo || user.rollNo === 'GUEST'));
          if (isGuestProfile) {
            updates.isGuest = true;
            updates.isAuthenticated = false;
          } else {
            updates.isAuthenticated = true;
            updates.isGuest = false;
          }
        } catch (_) {
          // ignore corrupted user profile
        }
      } else {
        const currentUser = get().user;
        if (currentUser && !currentUser.uniqueStudentId) {
          const studentId = cachedDeviceId || generateUniqueStudentId();
          cachedDeviceId = studentId;
          const patched = {
            ...currentUser,
            uniqueStudentId: studentId,
          };
          updates.user = patched;
          AsyncStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(patched)).catch(() => {});
          AsyncStorage.setItem(DEVICE_UNIQUE_STUDENT_ID_KEY, studentId).catch(() => {});
        } else if (!currentUser) {
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
          };
          updates.user = guestProfile;
          updates.isGuest = true;
          updates.isAuthenticated = false;
          AsyncStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(guestProfile)).catch(() => {});
        }
      }

      set(updates);
    } catch (_) {
      // ignore storage hydration error
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
        };

        set({
          user: userProfile,
          isGuest: false,
          isAuthenticated: true,
        });

        await AsyncStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(userProfile)).catch(() => {});
        return { success: true, offline: false };
      } catch (_) {
        return { success: false, error: NETWORK_ERROR_MESSAGE };
      }
    }

    // Supabase is not configured: local-only session for the offline build.
    const localUser: UserProfile = {
      id: `usr_${Date.now()}`,
      rollNo: identifier,
      name: identifier.startsWith('22') ? 'Aarav Sharma' : (persistentGuestName || 'Student'),
      email: toLoginEmail(identifier),
      avatarId: persistentAvatarId,
      uniqueStudentId: persistentUniqueId,
      classSelection: get().classSelection,
      isOfflineSession: true,
    };

    set({
      user: localUser,
      isGuest: false,
      isAuthenticated: true,
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
        };

        set({
          user: newUser,
          isGuest: false,
          isAuthenticated: true,
        });

        await AsyncStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(newUser)).catch(() => {});
        return { success: true, offline: false };
      } catch (_) {
        return { success: false, error: NETWORK_ERROR_MESSAGE };
      }
    }

    // Supabase is not configured: local-only account for the offline build.
    const localUser: UserProfile = {
      id: `usr_${Date.now()}`,
      rollNo: trimmedRoll,
      name: trimmedName,
      email: trimmedEmail,
      avatarId: persistentAvatarId,
      uniqueStudentId: persistentUniqueId,
      classSelection: get().classSelection,
      isOfflineSession: true,
    };

    set({
      user: localUser,
      isGuest: false,
      isAuthenticated: true,
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
    };

    set({
      user: guestUser,
      isGuest: true,
      isAuthenticated: false,
    });

    AsyncStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(guestUser)).catch(() => {});
  },

  completeOnboarding: () => {
    set({ hasCompletedOnboarding: true });
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
      email: 'guest@gbu.ac.in',
      classSelection: get().classSelection,
      isOfflineSession: true,
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

  logout: () => {
    if (isSupabaseConfigured) {
      supabase.auth.signOut().catch(() => {});
    }
    set({
      user: null,
      isGuest: true,
      isAuthenticated: false,
    });
    AsyncStorage.removeItem(USER_PROFILE_STORAGE_KEY).catch(() => {});
  },
}));

// Hydrate on startup
useAuthStore.getState().initAuth();

export default useAuthStore;
