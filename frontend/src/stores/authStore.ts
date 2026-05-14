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

if (typeof window !== 'undefined') {
  onAuthStateChanged(firebaseAuth, async user => {
    if (!user) {
      useAuthStore.setState({ user: null, isAdmin: false, loading: false });
      return;
    }
    const tokenResult = await user.getIdTokenResult();
    const isAdmin = Boolean(tokenResult.claims.admin);
    useAuthStore.setState({ user, isAdmin, loading: false });
  });
}
