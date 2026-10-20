import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export const CLASS_SELECTION_STORAGE_KEY = '@gbu_one_class_selection';
export const USER_PROFILE_STORAGE_KEY = '@gbu_one_user_profile';
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
  classSelection?: ClassSelection | null;
  isOfflineSession?: boolean;
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
  logout: () => void;
}

interface AuthErrorLike {
  message?: string | null;
  code?: string | null;
  status?: number | null;
}

const toStudentEmail = (rollNo: string): string =>
  `${rollNo.toLowerCase().replace(/[^a-z0-9]/g, '')}@gbu.ac.in`;

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
      const [savedClass, savedUser] = await Promise.all([
        AsyncStorage.getItem(CLASS_SELECTION_STORAGE_KEY),
        AsyncStorage.getItem(USER_PROFILE_STORAGE_KEY),
      ]);

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
          const user = JSON.parse(savedUser);
          updates.user = user;
          updates.isAuthenticated = true;
          updates.isGuest = false;
        } catch (_) {
          // ignore corrupted user profile
        }
      }

      set(updates);
    } catch (_) {
      // ignore storage hydration error
    }
  },

  login: async (rollNo: string, password: string) => {
    const trimmedRoll = rollNo.trim().toUpperCase();
    if (!trimmedRoll || !password) {
      return { success: false, error: 'Please enter both roll number and password.' };
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return {
        success: false,
        error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      };
    }

    if (isSupabaseConfigured) {
      const studentEmail = toStudentEmail(trimmedRoll);

      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: studentEmail,
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
          rollNo: trimmedRoll,
          name: typeof metadataName === 'string' ? metadataName : 'Student',
          email: signedInUser.email || studentEmail,
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
      rollNo: trimmedRoll,
      name: trimmedRoll.startsWith('22') ? 'Aarav Sharma' : 'Student',
      email: toStudentEmail(trimmedRoll),
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
    set({
      user: null,
      isGuest: true,
      isAuthenticated: false,
    });
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
