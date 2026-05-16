import { create } from 'zustand';
import {
  onAuthStateChanged,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase';

interface AuthState {
  user: FirebaseUser | null;
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>(() => ({
  user: null,
  isAdmin: false,
  loading: true,
  signOut: async () => {
    await signOut(firebaseAuth);
  },
}));

const ABSOLUTE_SESSION_MS = 24 * 60 * 60 * 1000;
let expiryTimer: ReturnType<typeof setTimeout> | null = null;

if (typeof window !== 'undefined') {
  onAuthStateChanged(firebaseAuth, async user => {
    if (expiryTimer) {
      clearTimeout(expiryTimer);
      expiryTimer = null;
    }
    if (!user) {
      useAuthStore.setState({ user: null, isAdmin: false, loading: false });
      return;
    }
    // Absolute session cap: force sign-out 24h after the last real sign-in.
    // lastSignInTime does NOT change on silent token refresh, so this is a
    // true absolute bound regardless of activity.
    const lastSignInMs = Date.parse(user.metadata.lastSignInTime ?? '');
    if (!Number.isNaN(lastSignInMs)) {
      const ageMs = Date.now() - lastSignInMs;
      if (ageMs >= ABSOLUTE_SESSION_MS) {
        useAuthStore.setState({ user: null, isAdmin: false, loading: false });
        await signOut(firebaseAuth);
        return;
      }
      expiryTimer = setTimeout(() => {
        void signOut(firebaseAuth);
      }, ABSOLUTE_SESSION_MS - ageMs);
    }
    const tokenResult = await user.getIdTokenResult();
    const isAdmin = Boolean(tokenResult.claims.admin);
    useAuthStore.setState({ user, isAdmin, loading: false });
  });
}
