# Design — User Auth + マイページ (sub-project 1)

**Date**: 2026-05-14
**Author**: Claude Code (Opus 4.7) + kz
**Scope**: First of a 2-part feature. Adds user accounts (signup/login), a personal "マイページ" with profile and contact-history views. Lesson booking history is a separate sub-project (sub-project 2).

## Context

The site currently has only an anonymous contact form. There is no auth, no user entity, no admin panel. After the GCP migration the backend is Firestore-on-Cloud-Run, well positioned to add Firebase Auth without introducing a new identity provider.

Users want a single-sign-in account where they can:
- Maintain their profile (name, phone) so contact-form pre-fill is possible
- See their past contact submissions in one place
- (Future sub-project) See past and upcoming lesson bookings

This spec covers everything needed to ship the first sub-project as an independent feature.

## Goals / non-goals

**Goals**
- Public signup with email+password and Google OAuth (Firebase Auth)
- Verified-email-backed profile, editable name/phone
- Personal contact-submission history page
- Anonymous contact submissions from the same email get retroactively linked on signup
- ContactForm pre-fills with profile data when the visitor is logged in
- All API requests authenticated server-side via Firebase Admin SDK
- Tests cover the happy path and the major edge cases

**Non-goals (out of scope for sub-project 1)**
- Lesson booking, scheduling, payments, calendar — sub-project 2
- Apple Sign In, LINE Login — only email+password + Google OAuth in v1
- Email change flow ("account settings") — read-only on the profile page
- Password reset UI (Firebase handles via email; we link to Firebase's hosted page in v1)
- Admin panel / staff-side dashboard
- SSR-side route protection (relies on client guard + backend token verify)
- Anonymous-user merge after signing in with a different email (we only backfill the *verified* email)

## User-confirmed decisions

| Question | Decision |
|---|---|
| Auth provider | Firebase Auth |
| Sign-in methods | Email+password, Google OAuth |
| Signup audience | Open to all site visitors |
| Existing contacts on signup | Retroactively linked by verified email |
| Profile fields | name (editable), email (read-only), phone (editable, optional) |

## Architecture

```
[Next.js frontend]                    [Firebase Auth]
   /login, /signup, /mypage   ◀──ID token──  (Google OAuth + email/password)
        │
        │  Bearer ID token (1h, auto-refreshed)
        ▼
[FastAPI on Cloud Run]
   - firebase-admin SDK verify token
   - /api/v1/users/me           (GET / PUT profile)
   - /api/v1/users/me/contacts  (GET own history)
        │
        ▼
[Firestore]
   users/{uid}             (new collection)
   contacts/{id}           (existing; + user_id, backfilled on signup)
```

Firebase Auth handles credentials and token issuance; FastAPI never sees the password. The same ID token authenticates every backend call. Firestore is the only persistent store; no separate user DB.

## Data model

### `users/{uid}` (new)

| Field | Type | Notes |
|---|---|---|
| uid | string | Firebase Auth UID (also the Firestore document ID) |
| email | string | Verified email from Firebase Auth. Indexed via natural collection access. |
| name | string | Editable. Initial value from `display_name` if Google OAuth, else from the signup form. |
| phone | string \| null | Editable, optional. Same Phone value-object validation as `Contact`. |
| created_at | timestamp | Set on first creation. |
| updated_at | timestamp | Set on every write. |

### `contacts/{id}` (modified)

Add one nullable field:

| Field | Type | Notes |
|---|---|---|
| user_id | string \| null | Firebase UID of the owning user, if any. Anonymous submissions stay null. |

No Firestore schema migration needed (Firestore is schemaless). The Pydantic schema and `Contact` entity gain an optional `user_id`. The SQLAlchemy path is already gone (Phase D).

## Backend (FastAPI)

### Domain layer (new)

`app/domain/entities/user.py`:
```python
@dataclass
class User:
    uid: str
    email: str
    name: str
    phone: Phone | None = None
    created_at: datetime = field(default_factory=...)
    updated_at: datetime = field(default_factory=...)

    def update(self, *, name: str | None = None, phone: Phone | None = None) -> None:
        ...  # mutate + bump updated_at
```

`app/domain/repositories/user_repository.py`:
```python
class UserRepository(ABC):
    @abstractmethod
    async def save(self, user: User) -> User: ...
    @abstractmethod
    async def find_by_uid(self, uid: str) -> User | None: ...
    @abstractmethod
    async def find_by_email(self, email: str) -> User | None: ...
```

### Infrastructure layer (new)

`app/infrastructure/repositories/firestore_user_repository.py` — mirrors `FirestoreContactRepository`. Collection `users`, doc id = uid, `set(merge=False)` semantics.

### Auth dependency (new)

`app/api/dependencies/auth.py`:
```python
from fastapi import Depends, Header, HTTPException, status
from firebase_admin import auth as fb_auth
from app.domain.entities.user import User

async def get_current_user(
    authorization: str = Header(...),
    user_repo: UserRepository = Depends(get_user_repository),
) -> User:
    token = authorization.removeprefix("Bearer ").strip()
    try:
        decoded = fb_auth.verify_id_token(token)
    except Exception as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"Invalid token: {e}")
    uid = decoded["uid"]
    user = await user_repo.find_by_uid(uid)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not registered")
    return user
```

`firebase_admin` is initialized once at module import (`firebase_admin.initialize_app()` — uses ADC on Cloud Run, project id from `Settings.gcp_project_id`).

`get_user_repository` is the same per-request factory pattern used by `get_contact_service`: composed in the endpoint's dependency layer, takes the Firestore AsyncClient from `get_firestore_client()`. Mirrors the existing pattern in `app/api/endpoints/contact.py` after Phase D.

### Endpoints (new)

`app/api/endpoints/users.py`:

- **`POST /api/v1/users/me`** — first-time signup wiring.
  - Path note: `/me` always means "the currently-authenticated Firebase user." `POST` on this path means "create the User record for the caller." Alternative `POST /api/v1/users` would be more REST-canonical but loses the implicit "you can only create yourself" constraint that the `/me` form encodes.
  - Auth: Bearer token (Firebase Auth account exists, but `users/{uid}` doc may not). This is the one endpoint that uses the `verify_id_token` directly without requiring the User doc to already exist — pulls uid + email from the decoded token.
  - Body: `{ name: str, phone?: str }`.
  - Logic: read uid+email from the verified token; create the `users/{uid}` doc; backfill `contacts where email == verified_email and user_id is null` with `user_id=uid`.
  - Returns the `User` plus a count of backfilled contacts.
  - If a user already exists with this uid → 409 (frontend treats as "already registered, go to /mypage").
- **`GET /api/v1/users/me`** — `Depends(get_current_user)` → returns the User.
- **`PUT /api/v1/users/me`** — `Depends(get_current_user)` + body `{ name?, phone? }`.
- **`GET /api/v1/users/me/contacts`** — list user's contacts. Query params `limit` (default 50), `offset` (default 0). Filters `contacts.user_id == user.uid`. Returns the same shape as the existing `Contact` response.

### Service layer (new)

`app/services/user_service.py` — orchestrates: User repo + Contact repo for the backfill. Stays free of FastAPI concerns; takes already-verified user data.

### Contact endpoint changes

`app/api/endpoints/contact.py:create_contact` — accept an *optional* auth header. When present, look up the user and set `user_id` on the new Contact. When absent, behave as today (anonymous).

### Settings / dependencies

`pyproject.toml`: add `firebase-admin>=6.5`.

`app/config.py`: no new fields required. Firebase Admin SDK uses ADC and `gcp_project_id` from existing settings.

Cloud Run runtime SA needs `roles/firebaseauth.viewer` on the project to call `verify_id_token`. Add as terraform binding in the cloudrun module.

## Frontend (Next.js)

### Firebase init (new)

`src/lib/firebase.ts`:
```ts
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const app = getApps()[0] ?? initializeApp({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
});
export const auth = getAuth(app);
```

`NEXT_PUBLIC_FIREBASE_*` are added to the Vercel HCP workspace's `env_vars` HCL map.

### Auth state (new)

`src/stores/authStore.ts` (zustand):
- `user: FirebaseUser | null`
- `loading: boolean` — initial token rehydration flag
- `onAuthStateChanged` subscription set up in a top-level `_app`-equivalent / `app/layout.tsx` provider component
- Selectors for components

### axios interceptor (modified)

`src/lib/api.ts`:
- Replace `localStorage.getItem('auth_token')` with `await auth.currentUser?.getIdToken()`
- 401 response → redirect to `/login` (or refresh + retry once on token expiry)

### Pages (new)

- **`/login`** — email+password form, Google sign-in button. On success: `router.push('/mypage')`.
- **`/signup`** — email+password + name field, Google sign-in button. On success: call `POST /api/v1/users/me`, then `router.push('/mypage')`.
- **`/mypage`** — protected client-side. Two sections:
  - プロフィール: name / email / phone display, edit button → modal or `/mypage/edit`.
  - 問い合わせ履歴: list `GET /api/v1/users/me/contacts` results, with status pill, lesson type, timestamp, message snippet.
- **`/mypage/edit`** — form for name + phone; calls `PUT /api/v1/users/me`.

### Route protection

Per-page client-side guard for v1:
```tsx
const { user, loading } = useAuth();
useEffect(() => {
  if (!loading && !user) router.push('/login');
}, [user, loading]);
if (loading || !user) return <Spinner />;
```
Backend already validates tokens, so a client-bypassed guard never reveals data — the bypass just shows a blank page until redirect.

### Header

`Header.tsx`:
- Logged out: "ログイン" link
- Logged in: avatar + name dropdown with "マイページ" / "ログアウト"

### ContactForm pre-fill

When `user` is non-null, default the form fields:
- `name` ← user.name
- `email` ← user.email
- `phone` ← user.phone ?? ""
Still editable in the form. On submit, if logged in, the API call carries the Bearer token; the backend sets `user_id` on the new contact.

## Errors / edge cases

| Case | Handling |
|---|---|
| Unverified email at signup | Account created; `/mypage` shows a banner "メール確認をしてください" with a "再送" button (`auth.sendEmailVerification`). Feature still usable. |
| ID token expired (>1h) | Firebase SDK auto-refreshes. Axios interceptor catches 401, retries once after `getIdToken(true)`; if still 401, redirect to `/login`. |
| Duplicate email at signup | Firebase Auth returns `auth/email-already-in-use`. Frontend shows "このメールは既に登録されています" with "ログインへ" link. |
| `POST /api/v1/users/me` race (called twice) | Second call returns 409; frontend treats 409 as "already registered, redirect to /mypage". |
| Anonymous contact backfill misses | If a user later changes their email in Firebase Auth, old anonymous contacts under the previous email do *not* re-link. Acceptable for v1; documented. |
| Contact form submit while logged in | Backend sets `user_id` automatically; user sees the submission immediately in /mypage. |
| Firebase Admin SDK init failure on Cloud Run | Log + 503 at startup. Health check fails fast — easier to debug than runtime failures. |

## Testing

### Backend

- **Unit**: `User` entity validation, `UserRepository` ABC contract via the existing pattern from `ContactRepository`.
- **Integration (Firestore Emulator-gated)**:
  - `FirestoreUserRepository` CRUD + edge cases
  - `UserService.signup_initialize` — including the contact-backfill side effect (seed anonymous contacts in conftest, sign up, assert user_id was set)
  - Endpoint tests against the real Firebase Admin token verify: mock at the SDK level (`fb_auth.verify_id_token` patched to return a known payload). The existing pattern from `tests/api/test_contact.py` extends to here.
- All backend tests stay emulator-gated; no real Firebase Auth in tests.

### Frontend

- **Unit**: zustand auth store transitions; ContactForm pre-fill logic with a mock `useAuth`.
- **Component**: Jest + RTL — `LoginForm`, `SignupForm`, `MyPage` with a mocked `firebase/auth` module.
- **E2E (Playwright)**: signup → /mypage → submit contact → see in history. Uses the Firebase Auth emulator for deterministic accounts.

## Deployment & ops

- **Vercel env vars** (HCP workspace `english-cafe-prod-vercel`'s `env_vars` HCL):
  - `NEXT_PUBLIC_FIREBASE_API_KEY` — public, not secret per Firebase docs
  - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` (`english-cafe-496209.firebaseapp.com`)
  - `NEXT_PUBLIC_FIREBASE_PROJECT_ID` (`english-cafe-496209`)
- **Cloud Run runtime SA**: add `roles/firebaseauth.viewer` so the backend can call `verify_id_token`. Terraform change in `terraform/modules/cloud-run-service/main.tf`.
- **GCP**: enable Firebase Auth API and Identity Platform on the project (one-time, via `gcloud services enable`).
- **Firebase Console**: configure the OAuth consent screen and Google sign-in provider (UI step, one-time).

## Open questions for the user

None — all the open scope/UX questions were resolved during brainstorming. Implementation-detail questions will be deferred to the writing-plans step.

## Files that change

Approximate list, scaled by stage:

**Backend (new)**
- `backend/app/domain/entities/user.py`
- `backend/app/domain/repositories/user_repository.py`
- `backend/app/infrastructure/repositories/firestore_user_repository.py`
- `backend/app/services/user_service.py`
- `backend/app/api/dependencies/auth.py`
- `backend/app/api/endpoints/users.py`
- `backend/app/api/schemas/user.py`
- `backend/tests/domain/test_user.py`
- `backend/tests/infrastructure/repositories/test_firestore_user_repository.py`
- `backend/tests/api/test_users.py`

**Backend (modified)**
- `backend/pyproject.toml` (+ firebase-admin)
- `backend/app/main.py` (mount users router)
- `backend/app/api/endpoints/contact.py` (optional auth → set user_id)
- `backend/app/domain/entities/contact.py` (+ user_id field)
- `backend/app/api/schemas/contact.py` (+ user_id in response only)
- `backend/tests/api/test_contact.py` (cover logged-in-and-anonymous paths)

**Frontend (new)**
- `frontend/src/lib/firebase.ts`
- `frontend/src/stores/authStore.ts`
- `frontend/src/hooks/useAuth.ts`
- `frontend/src/components/auth/LoginForm.tsx`
- `frontend/src/components/auth/SignupForm.tsx`
- `frontend/src/components/auth/GoogleSignInButton.tsx`
- `frontend/src/app/login/page.tsx`
- `frontend/src/app/signup/page.tsx`
- `frontend/src/app/mypage/page.tsx`
- `frontend/src/app/mypage/edit/page.tsx`
- `frontend/src/app/mypage/_components/ProfileCard.tsx`
- `frontend/src/app/mypage/_components/ContactHistory.tsx`
- E2E test under `frontend/tests/e2e/`

**Frontend (modified)**
- `frontend/package.json` (+ firebase)
- `frontend/src/lib/api.ts` (token via Firebase SDK)
- `frontend/src/components/forms/ContactForm.tsx` (pre-fill when logged in)
- `frontend/src/components/Header.tsx` (login/logout UI)
- `frontend/next.config.js` if any redirect rules are needed

**Terraform**
- `terraform/modules/cloud-run-service/main.tf` — add `roles/firebaseauth.viewer` binding on the runtime SA
- (Optional) `terraform/envs/prod/vercel/` `env_vars` HCL — add Firebase web config keys (via HCP UI, not terraform inputs)

**Docs**
- Update `CLAUDE.md` (auth flow section) once landed.
- This spec.

## Verification plan

1. Backend tests pass (49 passed → expected ~70 passed with new tests; 14 skipped count goes up if more emulator-gated).
2. Frontend lint + tsc clean.
3. Local docker-compose: signup → /mypage works against Firestore Emulator + Firebase Auth Emulator.
4. Vercel preview deploy: end-to-end via Playwright signup → mypage → contact submit → history shown.
5. Production cutover: enable Firebase Auth + Identity Platform, deploy backend revision, push frontend, smoke test.

## Rollout plan

This is a green-field feature with no schema migration. Rollout is push-and-go:

1. Land backend in PR with all routes feature-flagged off (router not mounted) — safe to merge anytime.
2. Land frontend in same or next PR with the new pages, but Header doesn't surface "ログイン" yet — also safe to merge.
3. Enable in prod: mount the users router, flip Header to expose the login link. Single deploy, low risk.
4. If issues: revert the Header + main.py router-mount commit; auth pages become orphaned but harmless until users navigate to them directly.
