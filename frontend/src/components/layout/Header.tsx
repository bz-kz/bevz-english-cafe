'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';

const Header = () => {
  const { user, isAdmin, signOut } = useAuthStore();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isUserMenuOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      ) {
        setIsUserMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsUserMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [isUserMenuOpen]);

  const navigation = [
    { name: 'ホーム', href: '/' },
    { name: '講師紹介', href: '/instructors' },
    { name: 'レッスン', href: '/lessons' },
    { name: '予約', href: '/book' },
    { name: '動画', href: '/videos' },
    { name: 'お問い合わせ', href: '/contact' },
  ];

  const closeUserMenu = () => setIsUserMenuOpen(false);

  return (
    <header className="bg-white shadow-sm">
      <nav className="container-custom">
        <div className="flex h-16 items-center justify-between">
          <div className="flex-shrink-0">
            <Link href="/" className="flex items-center">
              <span className="text-2xl font-bold text-primary-600">
                英会話カフェ
              </span>
            </Link>
          </div>

          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-4">
              {navigation.map(item => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-primary-600"
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </div>

          <div className="hidden md:flex md:items-center md:gap-3">
            <Link href="/contact" className="btn-primary">
              無料体験予約
            </Link>
            {user ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsUserMenuOpen(v => !v)}
                  aria-haspopup="menu"
                  aria-expanded={isUserMenuOpen}
                  className="rounded px-3 py-2 text-sm hover:bg-gray-100"
                >
                  {user.displayName ?? user.email ?? 'ユーザー'}
                </button>
                {isUserMenuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 z-10 mt-1 w-40 rounded border bg-white shadow"
                  >
                    <Link
                      href="/mypage"
                      onClick={closeUserMenu}
                      className="block px-3 py-2 text-sm hover:bg-gray-50"
                    >
                      マイページ
                    </Link>
                    {isAdmin && (
                      <Link
                        href="/admin/lessons"
                        onClick={closeUserMenu}
                        className="block px-3 py-2 text-sm hover:bg-gray-50"
                      >
                        Admin
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        closeUserMenu();
                        signOut();
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                    >
                      ログアウト
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/login"
                className="rounded px-3 py-2 text-sm hover:bg-gray-100"
              >
                ログイン
              </Link>
            )}
          </div>

          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="inline-flex items-center justify-center rounded-md p-2 text-gray-700 hover:bg-gray-100 hover:text-primary-600"
              aria-expanded="false"
            >
              <span className="sr-only">メニューを開く</span>
              {!isMenuOpen ? (
                <svg
                  className="block h-6 w-6"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              ) : (
                <svg
                  className="block h-6 w-6"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>

        {isMenuOpen && (
          <div className="md:hidden">
            <div className="space-y-1 px-2 pb-3 pt-2 sm:px-3">
              {navigation.map(item => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="block rounded-md px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-100 hover:text-primary-600"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.name}
                </Link>
              ))}
              <Link
                href="/contact"
                className="mt-4 block w-full rounded-lg bg-primary-600 px-4 py-2 text-center font-medium text-white hover:bg-primary-700"
                onClick={() => setIsMenuOpen(false)}
              >
                無料体験予約
              </Link>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
};

export default Header;
