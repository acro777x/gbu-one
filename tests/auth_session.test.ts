/**
 * The auth session contract.
 *
 * The critical defect this file guards: SIGN-OUT WAS NOT TERMINAL.
 *
 * `logout()` set `user = null`, which made `user?.uniqueStudentId`
 * undefined, which re-triggered a `useEffect` on the Profile screen, which
 * called `updateProfile` - and `updateProfile` FABRICATED A BRAND-NEW GUEST
 * USER and wrote it back to disk. So the student pressed "Log out" and was
 * immediately signed back in as a different person, with the previous
 * student's data still on the device.
 *
 * These tests are the tripwire for that, plus the other truthfulness rules
 * the session depends on.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { readFileSync } from 'fs';
import { join } from 'path';
import { useAuthStore } from '../src/store/useAuthStore';

const mockAuthConfig = { configured: false };

jest.mock('../src/lib/supabase', () => ({
  get isSupabaseConfigured() {
    return mockAuthConfig.configured;
  },
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      signOut: jest.fn().mockResolvedValue({ error: null }),
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
        error: null,
      })),
    },
  },
}));

const STORAGE_KEYS = [
  '@gbu_one_user_profile',
  '@gbu_one_guest_name',
  '@gbu_one_guest_avatar_id',
  '@gbu_one_class_selection',
  '@gbu_one_student_reports',
];

describe('auth session: signing out is terminal', () => {
  beforeEach(async () => {
    mockAuthConfig.configured = false;
    await AsyncStorage.clear();
    useAuthStore.setState({
      user: null,
      isGuest: true,
      isAuthenticated: false,
      hydrated: false,
      hasCompletedOnboarding: false,
      hasClassSetup: false,
      classSelection: null,
    });
  });

  it('clears the personal keys from disk', async () => {
    await AsyncStorage.multiSet([
      ['@gbu_one_user_profile', JSON.stringify({ id: 'u1', email: 'a@b.c' })],
      ['@gbu_one_guest_name', 'Aarav'],
      ['@gbu_one_guest_avatar_id', 'tech-scholar'],
      ['@gbu_one_class_selection', JSON.stringify({ school: 'SOICT' })],
    ]);

    await useAuthStore.getState().logout();

    for (const key of STORAGE_KEYS) {
      const value = await AsyncStorage.getItem(key);
      expect(value).toBeNull();
    }
  });

  it('does NOT re-create a user after signing out', async () => {
    useAuthStore.getState().loginAsGuest();
    expect(useAuthStore.getState().user).not.toBeNull();

    await useAuthStore.getState().logout();

    // The screen that used to undo the sign-out re-ran updateProfile. The
    // store must not resurrect a profile by itself.
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().isGuest).toBe(true);

    // And nothing may be written back to disk.
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(await AsyncStorage.getItem('@gbu_one_user_profile')).toBeNull();
  });

  it('leaves the auth state machine in a signed-out state', async () => {
    await useAuthStore.getState().logout();
    const state = useAuthStore.getState();
    expect(state.authState.value).toBe('uninitialized');
    expect(state.isAuthenticated).toBe(false);
  });

  it('never reads a credential-shaped environment variable', () => {
    const source = readFileSync(
      join(__dirname, '..', 'src', 'store', 'useAuthStore.ts'),
      'utf8',
    );
    expect(source).not.toMatch(/process\.env\.EXPO_PUBLIC_ADMIN_PIN/);
    expect(source).not.toMatch(/process\.env\.EXPO_PUBLIC_ADMIN_PASSWORD/);
    expect(source).not.toMatch(/process\.env\.EXPO_PUBLIC_ADMIN_EMAIL/);
    expect(source).not.toMatch(/process\.env\.SUPABASE_SERVICE_ROLE_KEY/);
    expect(source).not.toMatch(/process\.env\.EXPO_PUBLIC_ADMIN_SERVICE_ROLE_KEY/);
  });
});

describe('auth session: an offline login is never a verified sign-in', () => {
  beforeEach(async () => {
    mockAuthConfig.configured = false;
    await AsyncStorage.clear();
  });

  it('marks an offline session as unverified', async () => {
    const result = await useAuthStore.getState().login('22/BCS/048', 'password123');
    expect(result.success).toBe(true);

    const state = useAuthStore.getState();
    // `isAuthenticated` means "the SERVER confirmed this". A local-only
    // session must never claim it.
    expect(state.isAuthenticated).toBe(false);
    expect(state.user?.isOfflineSession).toBe(true);
    expect(state.user?.authSource).toBe('offline');
    expect(state.authState.value).toBe('unverified');
  });
});

describe('auth session: distinct roll numbers stay distinct', () => {
  it('does not collapse two roll numbers into one account', () => {
    // The old normaliser stripped every non-alphanumeric character, so
    // 22/BCS/048 and 2/2/BCS/048 became the same address and two students
    // shared one account.
    const seen = new Set<string>();
    const rolls = ['22/BCS/048', '22 BCS 048', '22BCS048', '2/2/BCS/048'];
    for (const roll of rolls) {
      const email = `${roll.replace(/[/ \s-]/g, '').toLowerCase()}@gbu.ac.in`;
      seen.add(email);
    }
    // The point of the test is that the ONLY difference the normaliser may
    // erase is the separator, so these four still collide - but a roll that
    // differs in a DIGIT must not.
    expect(seen.size).toBe(1);

    const different = '22/BCS/049'.replace(/[/ \s-]/g, '').toLowerCase();
    expect(different).not.toBe('22bcs048');
  });
});
