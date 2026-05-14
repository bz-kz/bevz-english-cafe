import { create } from 'zustand';
import {
  onAuthStateChanged,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase';

interface AuthState {
  user: FirebaseUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>(() => ({
  user: null,
  loading: true,
  signOut: async () => {
    await signOut(firebaseAuth);
  },
}));

if (typeof window !== 'undefined') {
  onAuthStateChanged(firebaseAuth, user => {
    useAuthStore.setState({ user, loading: false });
  });
}
