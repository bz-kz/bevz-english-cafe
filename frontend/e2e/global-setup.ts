import { FullConfig } from '@playwright/test';
import { randomUUID } from 'node:crypto';

// Single shared e2e project id — must match docker-compose backend
// GCP_PROJECT_ID / GOOGLE_CLOUD_PROJECT and the auth emulator --project (C1).
const PROJECT = 'demo-english-cafe';
const AUTH = 'http://localhost:9099';
const FS = `http://localhost:8080/v1/projects/${PROJECT}/databases/(default)/documents`;
const KEY = 'any';

async function ping(url: string, name: string) {
  try {
    await fetch(url);
  } catch {
    throw new Error(
      `e2e dep down: ${name} (${url}) — run 'docker compose up -d --wait'`
    );
  }
}

async function clearAuth() {
  await fetch(`${AUTH}/emulator/v1/projects/${PROJECT}/accounts`, {
    method: 'DELETE',
  });
}

async function signUp(email: string, password: string): Promise<string> {
  const r = await fetch(
    `${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=${KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  const j = (await r.json()) as { localId: string };
  return j.localId;
}

async function setAdmin(localId: string) {
  await fetch(
    `${AUTH}/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:update?key=${KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        localId,
        customAttributes: JSON.stringify({ admin: true }),
      }),
    }
  );
}

// Force Firestore timestamp typing where the backend repo reads the field as
// a datetime (compared with datetime.now / used for ordering). Seeding such a
// field as a string silently breaks the read path.
class Ts {
  constructor(public iso: string) {}
}
const ts = (iso: string) => new Ts(iso);

async function fsSet(path: string, fields: Record<string, unknown>) {
  const toVal = (v: unknown): unknown =>
    v instanceof Ts
      ? { timestampValue: v.iso }
      : typeof v === 'boolean'
        ? { booleanValue: v }
        : typeof v === 'number'
          ? { integerValue: String(v) }
          : { stringValue: String(v) };
  const body = {
    fields: Object.fromEntries(
      Object.entries(fields).map(([k, v]) => [k, toVal(v)])
    ),
  };
  await fetch(`${FS}/${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export default async function globalSetup(_c: FullConfig) {
  await ping(`${AUTH}/`, 'firebase-auth-emulator:9099');
  await ping('http://localhost:8080/', 'firestore-emulator:8080');
  await ping('http://localhost:8010/health', 'backend:8010');

  await clearAuth();
  const userUid = await signUp('e2e-user@example.com', 'Passw0rd!e2e');
  const adminUid = await signUp('e2e-admin@example.com', 'Passw0rd!e2e');
  await setAdmin(adminUid);

  const now = Date.now();
  const ym = new Date(now).toISOString().slice(0, 7); // YYYY-MM
  const nowIso = new Date(now).toISOString();
  // BookingGrid renders a slot only when its LOCAL hour/minute lands on a grid
  // cell (hours 9–15, minute 0/30) AND start - now >= 24h, within a 14-day
  // window. Pick 10:00 local time 3 days out so the open `○` cell is clickable
  // and backend find_in_range / book() (start_at > now) all hold.
  const slotDay = new Date(now);
  slotDay.setDate(slotDay.getDate() + 3);
  slotDay.setHours(10, 0, 0, 0);
  const startAt = slotDay.toISOString();
  const slotEnd = new Date(slotDay.getTime() + 60 * 60 * 1000);
  const endAt = slotEnd.toISOString();
  // Quota must outlive the booking check (expires_at > now).
  const quotaExpires = new Date(now + 60 * 24 * 3600 * 1000).toISOString();

  // --- users/{uid} ---
  // FirestoreUserRepository._from_dict requires email/name/created_at/
  // updated_at (raw indexing — KeyError if absent); plan/trial_used via .get.
  await fsSet(`users/${userUid}`, {
    uid: userUid,
    email: 'e2e-user@example.com',
    name: 'E2E User',
    plan: 'standard',
    trial_used: false,
    created_at: ts(nowIso),
    updated_at: ts(nowIso),
  });
  await fsSet(`users/${adminUid}`, {
    uid: adminUid,
    email: 'e2e-admin@example.com',
    name: 'E2E Admin',
    plan: 'standard',
    trial_used: false,
    created_at: ts(nowIso),
    updated_at: ts(nowIso),
  });

  // --- monthly_quota/{uid}_{YYYY-MM} ---
  // Doc id is `{user_id}_{year_month}` (FirestoreMonthlyQuotaRepository.find).
  // _from_dict requires user_id/year_month/plan_at_grant/granted/used/
  // granted_at/expires_at; BookingService reads expires_at (> now datetime),
  // granted/used (int) and orders by granted_at — both dates are timestamps.
  await fsSet(`monthly_quota/${userUid}_${ym}`, {
    user_id: userUid,
    year_month: ym,
    plan_at_grant: 'standard',
    granted: 8,
    used: 0,
    granted_at: ts(nowIso),
    expires_at: ts(quotaExpires),
  });

  // --- lesson_slots/{UUID} ---
  // Doc id MUST be a valid UUID (FirestoreLessonSlotRepository._from_dict does
  // UUID(doc_id)). _from_dict requires start_at/end_at/lesson_type/capacity/
  // booked_count/status/created_at/updated_at. lesson_type != trial so the
  // quota-consuming book() path is exercised; start_at/end_at are timestamps.
  const slotId = randomUUID();
  await fsSet(`lesson_slots/${slotId}`, {
    id: slotId,
    start_at: ts(startAt),
    end_at: ts(endAt),
    lesson_type: 'group',
    capacity: 5,
    booked_count: 0,
    price_yen: 3000,
    status: 'open',
    created_at: ts(nowIso),
    updated_at: ts(nowIso),
  });

  process.env.E2E_USER_EMAIL = 'e2e-user@example.com';
  process.env.E2E_ADMIN_EMAIL = 'e2e-admin@example.com';
  process.env.E2E_PASSWORD = 'Passw0rd!e2e';
}
