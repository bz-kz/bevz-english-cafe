'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase';
import { GoogleSignInButton } from './GoogleSignInButton';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(firebaseAuth, email, password);
      router.push('/mypage');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ログインに失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-6 p-6">
      <h1 className="text-2xl font-bold">ログイン</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
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
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="パスワード"
          className="w-full rounded border px-3 py-2"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
        >
          {submitting ? 'ログイン中…' : 'ログイン'}
        </button>
      </form>
      <div className="relative">
        <hr className="my-4" />
        <span className="absolute left-1/2 top-2 -translate-x-1/2 bg-white px-2 text-sm text-gray-500">
          または
        </span>
      </div>
      <GoogleSignInButton
        onSuccess={() => router.push('/mypage')}
        onError={e => setError(e.message)}
      />
      <p className="text-center text-sm">
        アカウント未作成の方は{' '}
        <a href="/signup" className="text-blue-600 underline">
          サインアップ
        </a>
      </p>
    </div>
  );
}
