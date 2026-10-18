import { create } from 'zustand';

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

  login: async (rollNo: string, password: string) => {
    // Basic validation
    const trimmedRoll = rollNo.trim().toUpperCase();
    if (!trimmedRoll || !password) {
      return { success: false, error: 'Please enter both roll number and password.' };
    }

    if (password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters.' };
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

    return { success: true };
  },

  register: async ({ rollNo, name, email, password }) => {
    const trimmedRoll = rollNo.trim().toUpperCase();
    if (!trimmedRoll || !name || !email || !password) {
      return { success: false, error: 'Please fill in all required fields.' };
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
  },

  logout: () => {
    set({
      user: null,
      isGuest: true,
      isAuthenticated: false,
    });
  },
}));

export default useAuthStore;
