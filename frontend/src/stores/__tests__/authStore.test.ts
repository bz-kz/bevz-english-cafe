jest.mock('@/lib/firebase', () => ({ firebaseAuth: {} }));

const signOutSpy = jest.fn().mockResolvedValue(undefined);
let cb: (u: unknown) => unknown;

jest.mock('firebase/auth', () => ({
  onAuthStateChanged: (_a: unknown, fn: (u: unknown) => unknown) => {
    cb = fn;
    return () => {};
  },
  signOut: (...a: unknown[]) => signOutSpy(...a),
}));

// Drain the microtask queue (no real timers needed; safe under fake timers).
const flush = async () => {
  for (let i = 0; i < 5; i += 1) {
    await Promise.resolve();
  }
};

describe('authStore absolute 24h expiry', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    signOutSpy.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('forces signOut for a stale (>24h) session', async () => {
    await import('@/stores/authStore');
    await cb({
      metadata: {
        lastSignInTime: new Date(Date.now() - 25 * 3600 * 1000).toUTCString(),
      },
      getIdTokenResult: async () => ({ claims: {} }),
    });
    await flush();
    expect(signOutSpy).toHaveBeenCalled();
  });

  it('does not sign out a fresh session until 24h elapses', async () => {
    await import('@/stores/authStore');
    await cb({
      metadata: { lastSignInTime: new Date().toUTCString() },
      getIdTokenResult: async () => ({ claims: {} }),
    });
    await flush();
    expect(signOutSpy).not.toHaveBeenCalled();
    jest.advanceTimersByTime(24 * 3600 * 1000);
    expect(signOutSpy).toHaveBeenCalledTimes(1);
  });

  it('does not throw or sign out when the user is null', async () => {
    await import('@/stores/authStore');
    await expect(cb(null)).resolves.not.toThrow();
    await flush();
    expect(signOutSpy).not.toHaveBeenCalled();
  });
});
