import axios from 'axios';
import { firebaseAuth } from '@/lib/firebase';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8010';

export type LessonType =
  | 'trial'
  | 'group'
  | 'private'
  | 'business'
  | 'toeic'
  | 'online'
  | 'other';

export interface LessonSlot {
  id: string;
  start_at: string;
  end_at: string;
  lesson_type: LessonType;
  capacity: number;
  booked_count: number;
  remaining: number;
  price_yen: number | null;
  status: 'open' | 'closed' | 'cancelled';
}

export interface LessonSlotAdmin extends LessonSlot {
  teacher_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Booking {
  id: string;
  status: 'confirmed' | 'cancelled';
  created_at: string;
  cancelled_at: string | null;
  slot: LessonSlot;
}

async function authHeaders(): Promise<Record<string, string>> {
  await firebaseAuth.authStateReady();
  const user = firebaseAuth.currentUser;
  if (!user) return {};
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

export async function listOpenSlots(): Promise<LessonSlot[]> {
  const resp = await axios.get<LessonSlot[]>(`${API_BASE}/api/v1/lesson-slots`);
  return resp.data;
}

export async function bookSlot(slotId: string): Promise<Booking> {
  const resp = await axios.post(
    `${API_BASE}/api/v1/bookings`,
    { slot_id: slotId },
    { headers: await authHeaders() }
  );
  return resp.data;
}

export async function listMyBookings(): Promise<Booking[]> {
  const resp = await axios.get<Booking[]>(
    `${API_BASE}/api/v1/users/me/bookings`,
    { headers: await authHeaders() }
  );
  return resp.data;
}

export async function cancelBooking(bookingId: string): Promise<Booking> {
  const resp = await axios.patch(
    `${API_BASE}/api/v1/bookings/${bookingId}/cancel`,
    {},
    { headers: await authHeaders() }
  );
  return resp.data;
}

// --- Admin ---

export interface CreateSlotInput {
  start_at: string;
  end_at: string;
  lesson_type: LessonType;
  capacity: number;
  price_yen?: number | null;
  teacher_id?: string | null;
  notes?: string | null;
}

export async function adminCreateSlot(
  input: CreateSlotInput
): Promise<LessonSlotAdmin> {
  const resp = await axios.post(
    `${API_BASE}/api/v1/admin/lesson-slots`,
    input,
    { headers: await authHeaders() }
  );
  return resp.data;
}

export async function adminUpdateSlot(
  id: string,
  input: Partial<CreateSlotInput & { status: 'open' | 'closed' | 'cancelled' }>
): Promise<LessonSlotAdmin> {
  const resp = await axios.put(
    `${API_BASE}/api/v1/admin/lesson-slots/${id}`,
    input,
    { headers: await authHeaders() }
  );
  return resp.data;
}

export async function adminDeleteSlot(
  id: string,
  force = false
): Promise<void> {
  await axios.delete(
    `${API_BASE}/api/v1/admin/lesson-slots/${id}${force ? '?force=true' : ''}`,
    { headers: await authHeaders() }
  );
}
