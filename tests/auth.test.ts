import { useAuthStore } from '../src/store/useAuthStore';

describe('Auth Store & Security Rules', () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
  });

  it('allows guest mode without any credentials or network call', () => {
    useAuthStore.getState().loginAsGuest();
    const state = useAuthStore.getState();
    expect(state.isGuest).toBe(true);
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('validates roll number and password loosely on app login', async () => {
    const res = await useAuthStore.getState().login('  22/bcs/048  ', 'password123');
    expect(res.success).toBe(true);

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.isGuest).toBe(false);
    expect(state.user?.rollNo).toBe('22/BCS/048');
  });

  it('rejects empty credentials with a friendly error message', async () => {
    const res = await useAuthStore.getState().login('', '');
    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
  });
});
