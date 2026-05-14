# Design — Lesson booking 2a (schedule + customer booking)

**Date**: 2026-05-14
**Author**: Claude Code (Opus 4.7) + kz
**Scope**: First of a 4-part feature (2a/2b/2c/2d). Adds admin-managed lesson slots, customer-facing booking, simple user-initiated cancellation, and a マイページ section showing upcoming + past bookings. Payments (2b), reminders (2c), and recurring slots (2d) are explicitly out of scope.

## Context

After sub-project 1 (`2026-05-14-mypage-auth-design.md`), authenticated users have a プロフィール and contact-submission history. The site has marketing copy for lesson types but no actual booking system — the "無料体験予約" CTA today routes to the contact form.

This spec adds the smallest end-to-end lesson booking that produces real value:
- Admin creates time-slotted lessons (one slot at a time, no recurring templates yet)
- Customers browse open slots (teacher hidden) and book the ones they want
- Booked customers see upcoming + past bookings on マイページ
- Customers can cancel their own bookings (no deadline rule yet)
- Admin can later assign a teacher to a slot, edit capacity, or close a slot

After 2a ships, payments (2b), reminders (2c), and recurring schedule templates (2d) are independent follow-ups.

## Goals / non-goals

**Goals**
- Admin can create / edit / delete lesson slots via `/admin/*` pages on the same Next.js site
- Authenticated customers see open slots (no teacher info) and book them
- Capacity is enforced atomically — no double-bookings even under concurrent requests
- Customers see their bookings (upcoming + past) on マイページ
- Customers can cancel their own confirmed bookings; capacity returns to the pool
- Tests cover the happy path and the core race-condition risk

**Non-goals (out of scope for 2a)**
- Payments — `price_yen` is displayed but not collected (2b adds Stripe)
- Email / LINE reminders — admin handles communication manually for now (2c)
- Recurring schedule templates ("weekly Monday 19:00 group") — 2d
- Cancellation deadline rules (e.g., "no cancel within 24h") — 2c
- Waitlist when a slot is full — out of scope; users see "満席" and don't book
- Admin permission management UI (granting `admin` claim) — initial admin is set via `gcloud` one-shot
- Teacher self-serve schedule editing — only the global admin edits slots; teachers don't have their own login flow
- Calendar / iCal export — out of scope

## User-confirmed decisions

| Question | Decision |
|---|---|
| Scope | Full eventually, but decompose into 2a/2b/2c/2d. 2a only here. |
| Slot model | "Admin creates concrete slots, listed for users" — 5-tuple of date/teacher/type/capacity/price |
| Teacher visibility to users | Hidden; admin assigns separately |
| Admin UI location | Same Next.js site at `/admin/*`, gated by Firebase Auth custom claim |
| Slot creation in 2a | One at a time, manual; recurring templates deferred to 2d |
| Lesson type | Reuse the existing `LessonType` enum (7 values) |
| Cancellation in 2a | Yes, simple version (user cancels their own; capacity returns) |

## Architecture

```
[browser]                                        [Firebase Auth]
  /book (auth, lists open slots)   ─── ID token ──── (custom claim: admin?)
  /mypage (shows bookings)
  /admin/lessons (admin claim only)
       │
       │ Bearer ID token
       ▼
[FastAPI on Cloud Run]
  Public:    GET /api/v1/lesson-slots (open + future)
             GET /api/v1/lesson-slots/{id}
  Auth:      POST /api/v1/bookings
             GET /api/v1/users/me/bookings
             PATCH /api/v1/bookings/{id}/cancel
  Admin:     POST/PUT/DELETE /api/v1/admin/lesson-slots[/{id}]
             GET /api/v1/admin/lesson-slots/{id}/bookings
       │
       ▼
[Firestore]
  users/{uid}            (existing)
  contacts/{id}          (existing)
  lesson_slots/{id}      (new)
  bookings/{id}          (new)
```

Booking capacity is enforced via `firestore.async_transaction` so concurrent POSTs to the same near-full slot can't oversell.

## Data model

### `lesson_slots/{id}`

| Field | Type | Notes |
|---|---|---|
| id | string (UUID) | Document ID |
| start_at | timestamp | Lesson start time, tz-aware UTC |
| end_at | timestamp | Lesson end time |
| lesson_type | string | One of the existing `LessonType` enum values (`trial`, `group`, `private`, `business`, `toeic`, `online`, `other`) |
| capacity | int | ≥ 1 |
| booked_count | int | 0 ≤ booked_count ≤ capacity, mutated only via transaction |
| price_yen | int \| null | Display only in 2a; 2b enforces payment |
| teacher_id | string \| null | Admin-assigned; hidden from non-admin responses |
| notes | string \| null | Admin-only notes (e.g., "Sarah で確定済") |
| status | enum | `"open"` / `"closed"` (admin-closed) / `"cancelled"` (admin-cancelled) |
| created_at | timestamp | |
| updated_at | timestamp | Bumped on any write |

Indexes (Firestore composite indexes — required for the queries below):
- `lesson_slots` on `(status, start_at ASC)` — for `GET /api/v1/lesson-slots` to list open future slots ordered by start time

### `bookings/{id}`

| Field | Type | Notes |
|---|---|---|
| id | string (UUID) | Document ID |
| slot_id | string | Foreign key to `lesson_slots` |
| user_id | string | Foreign key to `users.uid` |
| status | enum | `"confirmed"` / `"cancelled"` |
| created_at | timestamp | |
| cancelled_at | timestamp \| null | Set when status flips to `cancelled` |

Indexes:
- `bookings` on `(user_id, status, created_at DESC)` — for `GET /api/v1/users/me/bookings`
- `bookings` on `(user_id, slot_id, status)` — for the in-transaction check that prevents double-booking the same slot
- `bookings` on `(slot_id, status)` — for `GET /api/v1/admin/lesson-slots/{id}/bookings`

A user is allowed multiple bookings on the same slot only if previous ones were cancelled. We enforce "at most one confirmed booking per (user_id, slot_id)" in the transaction.

## Backend (FastAPI)

### Domain layer (new)

`app/domain/entities/lesson_slot.py`:
```python
@dataclass
class LessonSlot:
    id: UUID
    start_at: datetime
    end_at: datetime
    lesson_type: LessonType
    capacity: int
    booked_count: int
    price_yen: int | None
    teacher_id: str | None
    notes: str | None
    status: SlotStatus  # new enum: open|closed|cancelled
    created_at: datetime
    updated_at: datetime

    def __post_init__(self):
        if self.start_at >= self.end_at:
            raise ValueError("end_at must be after start_at")
        if self.capacity < 1:
            raise ValueError("capacity must be >= 1")
        if not 0 <= self.booked_count <= self.capacity:
            raise ValueError("booked_count out of range")

    @property
    def is_full(self) -> bool: return self.booked_count >= self.capacity

    @property
    def remaining(self) -> int: return self.capacity - self.booked_count
```

`app/domain/entities/booking.py`:
```python
@dataclass
class Booking:
    id: UUID
    slot_id: str
    user_id: str
    status: BookingStatus  # new enum: confirmed|cancelled
    created_at: datetime
    cancelled_at: datetime | None
```

`app/domain/enums/lesson_booking.py` — `SlotStatus`, `BookingStatus`.

`app/domain/repositories/lesson_slot_repository.py` + `booking_repository.py` — ABCs.

### Infrastructure (new)

`app/infrastructure/repositories/firestore_lesson_slot_repository.py` and `firestore_booking_repository.py` — mirror the existing `FirestoreContactRepository` / `FirestoreUserRepository` patterns. Each takes `firestore.AsyncClient`. Collection names `lesson_slots`, `bookings`.

### Booking transaction service

`app/services/booking_service.py`:
```python
class BookingService:
    def __init__(self, slot_repo, booking_repo, firestore_client):
        ...

    async def book(self, *, user: User, slot_id: str) -> Booking:
        """Atomic: check slot open + capacity + no existing confirmed booking,
        then create booking and bump slot.booked_count."""
        slot_ref = self._fs.collection("lesson_slots").document(slot_id)
        bookings_col = self._fs.collection("bookings")

        @firestore.async_transactional
        async def txn(tx):
            slot_snap = await slot_ref.get(transaction=tx)
            if not slot_snap.exists:
                raise SlotNotFoundError(slot_id)
            slot = self._slot_repo._dict_to_entity(slot_snap.to_dict(), slot_id)
            if slot.status != SlotStatus.OPEN:
                raise SlotNotOpenError(slot_id)
            if slot.start_at <= datetime.now(UTC):
                raise SlotInPastError(slot_id)
            if slot.is_full:
                raise SlotFullError(slot_id)

            # No double-booking: enforce at-most-one CONFIRMED booking per (user, slot)
            existing_query = (
                bookings_col
                  .where("user_id", "==", user.uid)
                  .where("slot_id", "==", slot_id)
                  .where("status", "==", "confirmed")
                  .limit(1)
            )
            async for _ in existing_query.stream(transaction=tx):
                raise AlreadyBookedError(slot_id)

            booking = Booking(
                id=uuid4(), slot_id=slot_id, user_id=user.uid,
                status=BookingStatus.CONFIRMED,
                created_at=datetime.now(UTC), cancelled_at=None,
            )
            tx.update(slot_ref, {"booked_count": slot.booked_count + 1,
                                  "updated_at": datetime.now(UTC)})
            tx.set(bookings_col.document(str(booking.id)),
                   self._booking_repo._entity_to_dict(booking))
            return booking

        return await txn(self._fs.transaction())

    async def cancel(self, *, user: User, booking_id: str) -> Booking:
        """Atomic: flip status to cancelled, decrement slot.booked_count."""
        # similar transaction structure
```

Race-safety: Firestore transactions in the Python AsyncClient give us optimistic-lock semantics with automatic retry on conflict.

### Admin authorization

Extend `app/api/dependencies/auth.py`:
```python
async def get_admin_user(user: Annotated[User, Depends(get_current_user)]) -> User:
    # In Phase 1 the User entity gains an is_admin field hydrated from the
    # Firebase Auth custom claim "admin: true" in get_current_user. If we
    # don't want to put it on User, query Firebase Admin SDK again here.
    if not getattr(user, "is_admin", False):
        raise HTTPException(403, "Admin access required")
    return user
```

To support this, `get_current_user` reads the `admin` custom claim from the decoded token and attaches it to the User dataclass as `is_admin: bool` (default False). The Firestore `users/{uid}` doc does NOT store admin status — Firebase Auth's custom claims are the source of truth.

Initial admin bootstrap:
```bash
# One-time, manual, by an existing GCP project owner
firebase auth:export users.json --project english-cafe-496209
# OR use the Firebase Admin SDK via a small Python script:
python -c "
import firebase_admin
from firebase_admin import auth
firebase_admin.initialize_app()
auth.set_custom_user_claims('<kz-uid>', {'admin': True})
"
```

This is a documented one-shot operation, not in scope for the implementation plan.

### Endpoints

`app/api/endpoints/lesson_slots.py`:
- `GET /api/v1/lesson-slots?from=<iso>&to=<iso>` — public, filters to `status=open AND start_at > now()` plus optional date range; teacher_id and notes are stripped from the response
- `GET /api/v1/lesson-slots/{id}` — public, same field-stripping
- `POST /api/v1/admin/lesson-slots` — admin only, full LessonSlot creation
- `PUT /api/v1/admin/lesson-slots/{id}` — admin only, partial update
- `DELETE /api/v1/admin/lesson-slots/{id}` — admin only; refuses if confirmed bookings exist unless `?force=true`
- `GET /api/v1/admin/lesson-slots/{id}/bookings` — admin only, with user info joined

`app/api/endpoints/bookings.py`:
- `POST /api/v1/bookings` — body `{slot_id}` (auth required) → transaction → 201 + Booking response
- `GET /api/v1/users/me/bookings` — auth required, includes slot snapshot for each booking (joined server-side to avoid N+1 in frontend)
- `PATCH /api/v1/bookings/{id}/cancel` — auth required, owner-only, transaction

### Schemas (Pydantic)

`app/api/schemas/lesson_slot.py`:
- `LessonSlotPublicResponse` — user-facing, no teacher_id, no notes
- `LessonSlotAdminResponse` — admin-facing, all fields
- `LessonSlotCreate` / `LessonSlotUpdate` — admin body types

`app/api/schemas/booking.py`:
- `BookingCreate` — `{slot_id: str}`
- `BookingResponse` — includes nested `LessonSlotPublicResponse` for context

## Frontend (Next.js)

### Customer pages (new)

- `/book` — server-rendered list of open future slots from `GET /api/v1/lesson-slots`. Each slot card shows date, time, lesson type (Japanese label), remaining capacity, price (if non-null). "予約する" button is enabled for auth'd users; unauth'd users see "ログインして予約" linking to /login.

### マイページ extension

`/mypage` adds a third section after profile and contact history:
- `BookingsList` component — displays results from `GET /api/v1/users/me/bookings`, grouped by upcoming vs past. Each upcoming entry has a "キャンセル" button → PATCH /cancel → optimistic UI update.

### Admin pages (new)

Gated by Firebase `admin` claim. Client-side guard reads claim from `IdTokenResult.claims.admin`:
```tsx
// hooks/useAdminGuard.ts
const claims = await user.getIdTokenResult();
if (!claims.claims.admin) router.push('/');
```

Pages:
- `/admin/lessons` — list + "新規作成" form (date, time, end time, type, capacity, price_yen, notes)
- `/admin/lessons/[id]` — edit form + bookings table for that slot (with each booking's user name + email)

Backend is the security boundary; the client guard is UX-only.

## Errors / edge cases

| Case | Handling |
|---|---|
| User books a slot that just became full (race) | Transaction sees capacity exceeded → 409 with code `SLOT_FULL` |
| User books a slot they already have a confirmed booking on | Transaction sees existing booking → 409 with `ALREADY_BOOKED` |
| User books a past slot | 400 with `SLOT_IN_PAST` |
| User books a `closed` or `cancelled` slot | 400 with `SLOT_NOT_OPEN` |
| User cancels someone else's booking | 403 |
| Admin deletes a slot with confirmed bookings | 409 unless `?force=true`; with force, bookings are cancelled in the same transaction and `cancelled_at` is set |
| Admin closes a slot | Existing bookings stay confirmed; new bookings rejected |
| Admin reduces capacity below booked_count | 409 with `CAPACITY_TOO_LOW` |
| Admin claim missing | 403 from `get_admin_user` |

## Testing

### Backend
- Domain unit tests for `LessonSlot` and `Booking` invariants
- Firestore Emulator integration tests for the two repositories (CRUD, query patterns)
- BookingService transaction tests — the key race-safety contract:
  - Happy path
  - Capacity exceeded
  - Slot closed/cancelled
  - Slot in past
  - Already-booked-by-this-user
  - Cancel decrements booked_count
  - Cancel of someone else's booking → permission error
- API tests mock `firebase_admin.auth.verify_id_token` to inject {uid, admin:bool} claim variants

### Frontend
- Component tests for BookingsList, SlotCard, admin form
- E2E (Playwright) after merge: admin creates a slot → user books → user cancels → admin sees updated state

## Deployment & ops

- **Firestore composite indexes**: create via `gcloud firestore indexes composite create` or via terraform `google_firestore_index` resource in the firestore stack
- **Admin bootstrap**: one-shot Python script (`scripts/grant_admin.py`) for the first admin
- **Cloud Run env**: no new env vars
- **Frontend**: same `NEXT_PUBLIC_API_URL`; no new env vars

## Open questions for the user

None for 2a. 2b/2c/2d will get their own specs when their turn comes.

## Files that change

**Backend (new)**
- `backend/app/domain/entities/lesson_slot.py`
- `backend/app/domain/entities/booking.py`
- `backend/app/domain/enums/lesson_booking.py` (SlotStatus, BookingStatus)
- `backend/app/domain/repositories/lesson_slot_repository.py`
- `backend/app/domain/repositories/booking_repository.py`
- `backend/app/infrastructure/repositories/firestore_lesson_slot_repository.py`
- `backend/app/infrastructure/repositories/firestore_booking_repository.py`
- `backend/app/services/booking_service.py`
- `backend/app/api/dependencies/auth.py` (extend with `get_admin_user`)
- `backend/app/api/endpoints/lesson_slots.py`
- `backend/app/api/endpoints/bookings.py`
- `backend/app/api/schemas/lesson_slot.py`
- `backend/app/api/schemas/booking.py`
- All corresponding tests

**Backend (modify)**
- `backend/app/api/dependencies/repositories.py` — add factories
- `backend/app/main.py` — mount new routers
- `backend/app/domain/entities/user.py` — add `is_admin: bool` field (default False, NOT persisted — hydrated from token claim)

**Frontend (new)**
- `frontend/src/app/book/page.tsx`
- `frontend/src/app/book/_components/SlotCard.tsx`
- `frontend/src/app/mypage/_components/BookingsList.tsx`
- `frontend/src/app/admin/layout.tsx` (admin guard wrapper)
- `frontend/src/app/admin/lessons/page.tsx`
- `frontend/src/app/admin/lessons/_components/SlotForm.tsx`
- `frontend/src/app/admin/lessons/[id]/page.tsx`
- `frontend/src/hooks/useAdminGuard.ts`
- `frontend/src/lib/booking.ts` (typed client helpers)

**Frontend (modify)**
- `frontend/src/app/mypage/page.tsx` — wire in BookingsList
- `frontend/src/components/layout/Header.tsx` — show "予約" link

**Terraform (modify)**
- `terraform/modules/firestore-database/main.tf` — add composite indexes via `google_firestore_index`
- (Optional) `terraform/envs/prod/firestore/terragrunt.hcl` — surface a list of indexes if we want them parameterized

**Scripts (new)**
- `scripts/grant_admin.py` — one-shot to set admin claim on a Firebase user by uid

## Verification plan

1. Backend tests pass with emulator: ~70+ tests including new transaction tests
2. Frontend tsc + lint clean
3. Live Firebase Auth bootstrap: grant admin claim to kz; verify `/admin/lessons` accessible
4. Smoke E2E (Playwright): admin creates slot → user books → user cancels → admin sees state

## Rollout plan

Same pattern as sub-project 1:
1. Land backend + frontend in PR, behind a feature flag (`NEXT_PUBLIC_LESSON_BOOKING_ENABLED`) initially off in prod
2. Bootstrap admin claim manually
3. Verify in production preview, then flip the flag on
4. If issues: flip flag off; rollback by reverting the flag-gate commit
