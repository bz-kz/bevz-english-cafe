'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { useAuth } from '@/hooks/useAuth';
import { getMe, type MeResponse } from '@/lib/booking';
import { ProfileCard } from './_components/ProfileCard';
import { ContactHistory } from './_components/ContactHistory';
import { BookingsList } from './_components/BookingsList';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8010';

interface ContactItem {
  id: string;
  created_at: string;
  lesson_type: string;
  message: string;
  status: string;
}

export default function MyPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<MeResponse | null>(null);
  const [contacts, setContacts] = useState<ContactItem[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const token = await user.getIdToken();
      const headers = { Authorization: `Bearer ${token}` };
      const [profileData, contactsRes] = await Promise.all([
        getMe(),
        axios.get<ContactItem[]>(`${API_BASE}/api/v1/users/me/contacts`, {
          headers,
        }),
      ]);
      setProfile(profileData);
      setContacts(contactsRes.data);
    })();
  }, [user]);

  if (loading || !user || !profile) {
    return <div className="p-6 text-center">読み込み中…</div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-3xl font-bold">マイページ</h1>
      <ProfileCard profile={profile} />
      <BookingsList />
      <ContactHistory contacts={contacts} />
    </div>
  );
}
