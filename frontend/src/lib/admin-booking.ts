import axios from 'axios';
import { firebaseAuth } from '@/lib/firebase';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8010';

export interface AdminUserSummary {
  uid: string;
  email: string;
  name: string;
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await firebaseAuth.currentUser?.getIdToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function searchAdminUsers(
  q: string,
  limit = 50
): Promise<AdminUserSummary[]> {
  const headers = await authHeaders();
  const resp = await axios.get<AdminUserSummary[]>(
    `${API_BASE}/api/v1/admin/users`,
    { headers, params: { q, limit } }
  );
  return resp.data;
}

export interface ForceBookBody {
  user_id: string;
  consume_quota: boolean;
  consume_trial: boolean;
}

export interface ForceBookResponse {
  id: string;
  slot_id: string;
  user_id: string;
  status: string;
  created_at: string;
}

export async function adminForceBook(
  slotId: string,
  body: ForceBookBody
): Promise<ForceBookResponse> {
  const headers = await authHeaders();
  const resp = await axios.post<ForceBookResponse>(
    `${API_BASE}/api/v1/admin/lesson-slots/${slotId}/bookings`,
    body,
    { headers }
  );
  return resp.data;
}

export interface ForceCancelBody {
  refund_quota: boolean;
  refund_trial: boolean;
}

export interface ForceCancelResponse {
  id: string;
  status: string;
  cancelled_at: string | null;
}

export async function adminForceCancel(
  bookingId: string,
  body: ForceCancelBody
): Promise<ForceCancelResponse> {
  const headers = await authHeaders();
  const resp = await axios.post<ForceCancelResponse>(
    `${API_BASE}/api/v1/admin/bookings/${bookingId}/cancel`,
    body,
    { headers }
  );
  return resp.data;
}
