'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
} from 'firebase/auth';
import axios from 'axios';
import { firebaseAuth } from '@/lib/firebase';
import { GoogleSignInButton } from './GoogleSignInButton';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8010';

async function initializeUser(name: string, phone: string | undefined) {
  const token = await firebaseAuth.currentUser?.getIdToken();
  if (!token) throw new Error('Firebase user missing');
  await axios.post(
    `${API_BASE}/api/v1/users/me`,
    { name, phone: phone || null },
    { headers: { Authorization: `Bearer ${token}` } }
  );
}

export function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const cred = await createUserWithEmailAndPassword(
        firebaseAuth,
        email,
        password
      );
      await sendEmailVerification(cred.user);
      await initializeUser(name, undefined);
      router.push('/mypage');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'サインアップに失敗しました'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSuccess = async () => {
    try {
      const displayName = firebaseAuth.currentUser?.displayName ?? '';
      await initializeUser(displayName || 'ゲスト', undefined);
      router.push('/mypage');
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        // Already registered — proceed to mypage
        router.push('/mypage');
      } else {
        setError(
          err instanceof Error ? err.message : 'サインアップに失敗しました'
        );
      }
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-6 p-6">
      <h1 className="text-2xl font-bold">サインアップ</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          required
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="お名前"
          className="w-full rounded border px-3 py-2"
        />
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="メールアドレス"
          className="w-full rounded border px-3 py-2"
        />
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="パスワード (6 文字以上)"
          className="w-full rounded border px-3 py-2"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
        >
          {submitting ? '送信中…' : 'サインアップ'}
        </button>
      </form>
      <div className="relative">
        <hr className="my-4" />
        <span className="absolute left-1/2 top-2 -translate-x-1/2 bg-white px-2 text-sm text-gray-500">
          または
        </span>
      </div>
      <GoogleSignInButton
        onSuccess={handleGoogleSuccess}
        onError={e => setError(e.message)}
      />
      <p className="text-center text-sm">
        登録済みの方は{' '}
        <a href="/login" className="text-blue-600 underline">
          ログイン
        </a>
      </p>
    </div>
  );
}
