'use client';

import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase';

interface Props {
  onSuccess: () => void;
  onError: (err: Error) => void;
}

export function GoogleSignInButton({ onSuccess, onError }: Props) {
  const handle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(firebaseAuth, provider);
      onSuccess();
    } catch (e) {
      onError(e as Error);
    }
  };
  return (
    <button
      type="button"
      onClick={handle}
      className="w-full rounded border border-gray-300 px-4 py-2 hover:bg-gray-50"
    >
      Google でサインイン
    </button>
  );
}
