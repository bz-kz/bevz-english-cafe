import axios from 'axios';
import { firebaseAuth } from '@/lib/firebase';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8010';

export class NoSubscriptionError extends Error {
  constructor() {
    super('no_subscription');
    this.name = 'NoSubscriptionError';
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  await firebaseAuth.authStateReady();
  const user = firebaseAuth.currentUser;
  if (!user) return {};
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

export async function createCheckout(
  plan: 'light' | 'standard' | 'intensive'
): Promise<string> {
  const resp = await axios.post<{ url: string }>(
    `${API_BASE}/api/v1/billing/checkout`,
    { plan },
    { headers: await authHeaders() }
  );
  return resp.data.url;
}

export async function createPortal(): Promise<string> {
  try {
    const resp = await axios.post<{ url: string }>(
      `${API_BASE}/api/v1/billing/portal`,
      {},
      { headers: await authHeaders() }
    );
    return resp.data.url;
  } catch (e: unknown) {
    const err = e as {
      response?: { status?: number; data?: { detail?: { code?: string } } };
    };
    if (
      err.response?.status === 409 &&
      err.response.data?.detail?.code === 'no_subscription'
    ) {
      throw new NoSubscriptionError();
    }
    throw e;
  }
}
