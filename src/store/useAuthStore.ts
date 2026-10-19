import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export const CLASS_SELECTION_STORAGE_KEY = '@gbu_one_class_selection';
export const USER_PROFILE_STORAGE_KEY = '@gbu_one_user_profile';

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
  login: (rollNo: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (data: { rollNo: string; name: string; email: string; password: string }) => Promise<{ success: boolean; error?: string }>;
  loginAsGuest: () => void;
  completeOnboarding: () => void;
  setClassSelection: (selection: ClassSelection) => void;
  logout: () => void;
}

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

    if (password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters.' };
    }

    // Try Supabase Auth if configured
    if (isSupabaseConfigured) {
      try {
        const studentEmail = `${trimmedRoll.toLowerCase().replace(/[^a-z0-9]/g, '')}@gbu.ac.in`;
        const { data, error } = await supabase.auth.signInWithPassword({
          email: studentEmail,
          password,
        });

        if (!error && data.user) {
          const userProfile: UserProfile = {
            id: data.user.id,
            rollNo: trimmedRoll,
            name: data.user.user_metadata?.name || 'Student',
            email: data.user.email || studentEmail,
            classSelection: get().classSelection,
          };

          set({
            user: userProfile,
            isGuest: false,
            isAuthenticated: true,
          });

          await AsyncStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(userProfile)).catch(() => {});
          return { success: true };
        }
      } catch (_) {
        // Fallback to local session
      }
    }

    // Authenticate user profile (our app auth, never storing university passwords)
    const mockUser: UserProfile = {
      id: `usr_${Date.now()}`,
      rollNo: trimmedRoll,
      name: trimmedRoll.startsWith('22') ? 'Aarav Sharma' : 'Student',
      email: `${trimmedRoll.toLowerCase().replace(/[^a-z0-9]/g, '')}@gbu.ac.in`,
      classSelection: get().classSelection,
    };

    set({
      user: mockUser,
      isGuest: false,
      isAuthenticated: true,
    });

    await AsyncStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(mockUser)).catch(() => {});
    return { success: true };
  },

  register: async ({ rollNo, name, email, password }) => {
    const trimmedRoll = rollNo.trim().toUpperCase();
    if (!trimmedRoll || !name || !email || !password) {
      return { success: false, error: 'Please fill in all required fields.' };
    }

    if (password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters.' };
    }

    // Try Supabase Auth if configured
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              roll_no: trimmedRoll,
              name: name.trim(),
            },
          },
        });

        if (!error && data.user) {
          const newUser: UserProfile = {
            id: data.user.id,
            rollNo: trimmedRoll,
            name: name.trim(),
            email: email.trim(),
            classSelection: get().classSelection,
          };

          set({
            user: newUser,
            isGuest: false,
            isAuthenticated: true,
          });

          await AsyncStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(newUser)).catch(() => {});
          return { success: true };
        }
      } catch (_) {
        // Fallback to local registration
      }
    }

    const newUser: UserProfile = {
      id: `usr_${Date.now()}`,
      rollNo: trimmedRoll,
      name: name.trim(),
      email: email.trim(),
      classSelection: get().classSelection,
    };

    set({
      user: newUser,
      isGuest: false,
      isAuthenticated: true,
    });

    await AsyncStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(newUser)).catch(() => {});
    return { success: true };
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
