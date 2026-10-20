import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useAuthStore,
  USER_PROFILE_STORAGE_KEY,
  MIN_PASSWORD_LENGTH,
  INVALID_CREDENTIALS_MESSAGE,
  NETWORK_ERROR_MESSAGE,
  DUPLICATE_EMAIL_MESSAGE,
} from '../src/store/useAuthStore';
import { supabase } from '../src/lib/supabase';

interface MockAuthApi {
  signInWithPassword: jest.Mock;
  signUp: jest.Mock;
  resetPasswordForEmail: jest.Mock;
  signOut: jest.Mock;
}

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
      signOut: jest.fn(),
    },
  },
}));

const authApi = (supabase as unknown as { auth: MockAuthApi }).auth;

const authError = (message: string, code: string, status: number) => ({
  message,
  code,
  status,
});

describe('Auth Store', () => {
  beforeEach(() => {
    mockAuthConfig.configured = false;
    authApi.signInWithPassword.mockReset();
    authApi.signUp.mockReset();
    authApi.resetPasswordForEmail.mockReset();
    authApi.signOut.mockReset();
    useAuthStore.getState().logout();
  });

  it('allows guest mode without any credentials or network call', () => {
    useAuthStore.getState().loginAsGuest();
    const state = useAuthStore.getState();
    expect(state.isGuest).toBe(true);
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('rejects empty credentials with a friendly error message', async () => {
    const res = await useAuthStore.getState().login('', '');
    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
  });

  it('requires at least 8 characters for the app password', async () => {
    const res = await useAuthStore.getState().login('22/BCS/048', 'short12');
    expect(res.success).toBe(false);
    expect(res.error).toBe(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);

    const registerRes = await useAuthStore.getState().register({
      rollNo: '22/BCS/048',
      name: 'Aarav Sharma',
      email: 'aarav@gbu.ac.in',
      password: 'short12',
    });
    expect(registerRes.success).toBe(false);
    expect(registerRes.error).toBe(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  });

  it('signs in with a local session and flags it as offline when Supabase is not configured', async () => {
    mockAuthConfig.configured = false;

    const res = await useAuthStore.getState().login('  22/bcs/048  ', 'password123');

    expect(res.success).toBe(true);
    expect(res.offline).toBe(true);
    expect(authApi.signInWithPassword).not.toHaveBeenCalled();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.isGuest).toBe(false);
    expect(state.user?.rollNo).toBe('22/BCS/048');
    expect(state.user?.isOfflineSession).toBe(true);
  });

  it('rejects a wrong password instead of falling back to a local session', async () => {
    mockAuthConfig.configured = true;
    authApi.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: authError('Invalid login credentials', 'invalid_credentials', 400),
    });

    const res = await useAuthStore.getState().login('22/BCS/048', 'anything6chars');

    expect(res.success).toBe(false);
    expect(res.error).toBe(INVALID_CREDENTIALS_MESSAGE);
    expect(res.offline).toBeUndefined();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isGuest).toBe(true);
    expect(state.user).toBeNull();
  });

  it('reports a network failure separately from a wrong password', async () => {
    mockAuthConfig.configured = true;
    authApi.signInWithPassword.mockRejectedValue(new Error('Network request failed'));

    const res = await useAuthStore.getState().login('22/BCS/048', 'password123');

    expect(res.success).toBe(false);
    expect(res.error).toBe(NETWORK_ERROR_MESSAGE);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('asks an unconfirmed email to be confirmed before logging in', async () => {
    mockAuthConfig.configured = true;
    authApi.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: authError('Email not confirmed', 'email_not_confirmed', 400),
    });

    const res = await useAuthStore.getState().login('22/BCS/048', 'password123');

    expect(res.success).toBe(false);
    expect(res.error).toBe('Confirm your email address first, then log in.');
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('signs in through Supabase without falling back when the credentials are right', async () => {
    mockAuthConfig.configured = true;
    authApi.signInWithPassword.mockResolvedValue({
      data: {
        user: { id: 'user-1', email: '22bcs048@gbu.ac.in', user_metadata: { name: 'Aarav Sharma' } },
        session: { access_token: 'token' },
      },
      error: null,
    });

    const res = await useAuthStore.getState().login('22/BCS/048', 'password123');

    expect(res.success).toBe(true);
    expect(res.offline).toBe(false);
    expect(authApi.signInWithPassword).toHaveBeenCalledWith({
      email: '22bcs048@gbu.ac.in',
      password: 'password123',
    });

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.id).toBe('user-1');
    expect(state.user?.name).toBe('Aarav Sharma');
    expect(state.user?.isOfflineSession).toBe(false);
  });

  it('refuses a duplicate email registration instead of fabricating a local account', async () => {
    mockAuthConfig.configured = true;
    authApi.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: authError('User already registered', 'user_already_exists', 422),
    });

    const res = await useAuthStore.getState().register({
      rollNo: '22/BCS/048',
      name: 'Aarav Sharma',
      email: 'aarav@gbu.ac.in',
      password: 'password123',
    });

    expect(res.success).toBe(false);
    expect(res.error).toBe(DUPLICATE_EMAIL_MESSAGE);

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
  });

  it('does not log a student in before their email is confirmed', async () => {
    mockAuthConfig.configured = true;
    authApi.signUp.mockResolvedValue({
      data: { user: { id: 'user-2' }, session: null },
      error: null,
    });

    const res = await useAuthStore.getState().register({
      rollNo: '22/BCS/048',
      name: 'Aarav Sharma',
      email: 'aarav@gbu.ac.in',
      password: 'password123',
    });

    expect(res.success).toBe(false);
    expect(res.error).toBe('Account created. Confirm your email address, then log in.');
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('creates the account when Supabase returns a confirmed session', async () => {
    mockAuthConfig.configured = true;
    authApi.signUp.mockResolvedValue({
      data: { user: { id: 'user-3' }, session: { access_token: 'token' } },
      error: null,
    });

    const res = await useAuthStore.getState().register({
      rollNo: '22/BCS/048',
      name: 'Aarav Sharma',
      email: 'aarav@gbu.ac.in',
      password: 'password123',
    });

    expect(res.success).toBe(true);
    expect(res.offline).toBe(false);
    expect(useAuthStore.getState().user?.id).toBe('user-3');
  });

  it('creates a local account flagged as offline when Supabase is not configured', async () => {
    mockAuthConfig.configured = false;

    const res = await useAuthStore.getState().register({
      rollNo: '22/BCS/048',
      name: 'Aarav Sharma',
      email: 'aarav@gbu.ac.in',
      password: 'password123',
    });

    expect(res.success).toBe(true);
    expect(res.offline).toBe(true);
    expect(authApi.signUp).not.toHaveBeenCalled();
    expect(useAuthStore.getState().user?.isOfflineSession).toBe(true);
  });

  it('says password reset needs the backend when Supabase is not configured', async () => {
    mockAuthConfig.configured = false;

    const res = await useAuthStore.getState().requestPasswordReset('aarav@gbu.ac.in');

    expect(res.success).toBe(false);
    expect(res.error).toContain('backend');
    expect(authApi.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('sends the reset link through Supabase when it is configured', async () => {
    mockAuthConfig.configured = true;
    authApi.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });

    const res = await useAuthStore.getState().requestPasswordReset('aarav@gbu.ac.in');

    expect(res.success).toBe(true);
    expect(authApi.resetPasswordForEmail).toHaveBeenCalledWith(
      'aarav@gbu.ac.in',
      expect.objectContaining({ redirectTo: expect.any(String) })
    );
  });

  it('never writes the app password to local storage', async () => {
    mockAuthConfig.configured = false;

    await useAuthStore.getState().login('22/BCS/048', 'password123');

    const stored = await AsyncStorage.getItem(USER_PROFILE_STORAGE_KEY);
    expect(stored).toBeTruthy();
    expect(stored).not.toContain('password123');
  });
});
