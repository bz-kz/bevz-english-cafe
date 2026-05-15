# Stripe Backend (Sub-project 4c-2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `StripeService` + webhook receiver + billing endpoints so users buy a Stripe Checkout subscription and webhooks drive 4c-1's `MonthlyQuota` grant; plan changes/cancel go to Stripe Customer Portal. No frontend (= 4c-3).

**Architecture:** Official sync `stripe` lib wrapped in `asyncio.to_thread`. `invoice.paid` is the SOLE quota-grant path (full `PLAN_QUOTA[plan]` for any `billing_reason`); its grant + a `processed_stripe_events/{event.id}` write happen in ONE Firestore `@fs.async_transactional` (exactly-once under concurrent delivery — network resolution of uid/plan is done BEFORE the txn). Non-critical events use claim-first via `ProcessedEventRepository.claim` (`.create()` fail-if-exists). `checkout.session.completed` saves the user BEFORE claim (it is the sole carrier of `stripe_customer_id`).

**Tech Stack:** FastAPI + Firestore AsyncClient + Python 3.12 (uv) + `stripe` (sync, `to_thread`) + pytest + Firestore emulator + `unittest.mock`.

**Spec:** [`docs/superpowers/specs/2026-05-15-stripe-backend-4c2-design.md`](../specs/2026-05-15-stripe-backend-4c2-design.md). Depends on 4c-1 (PR #15, MERGED).

---

## File Structure

### Create
- `backend/app/domain/repositories/processed_event_repository.py` — interface
- `backend/app/infrastructure/repositories/firestore_processed_event_repository.py` — impl
- `backend/app/services/stripe_service.py` — Stripe SDK calls + webhook dispatch
- `backend/app/api/schemas/billing.py` — Pydantic request/response
- `backend/app/api/endpoints/billing.py` — 3 endpoints
- `backend/tests/infrastructure/repositories/test_firestore_processed_event_repository.py`
- `backend/tests/services/test_stripe_service.py`
- `backend/tests/api/test_billing_endpoints.py`

### Modify
- `backend/pyproject.toml` — add `stripe` dep
- `backend/app/config.py` — Stripe Settings fields
- `backend/app/domain/entities/user.py` — +5 fields + `update_subscription`
- `backend/app/infrastructure/repositories/firestore_user_repository.py` — mapping
- `backend/app/services/email_service.py` — `send_payment_failed` on Protocol + SMTP + Mock
- `backend/app/api/dependencies/repositories.py` — `get_stripe_service` + imports
- `backend/app/api/schemas/user.py` — +4 subscription fields on `UserResponse`
- `backend/app/api/endpoints/users.py` — `get_profile` fills subscription fields
- `backend/app/main.py` — billing router
- `backend/tests/services/test_email_service.py` — `send_payment_failed`
- the `/users/me` test module — subscription fields present

---

## Task 1: Stripe dependency + Settings

**Files:**
- Modify: `backend/pyproject.toml`
- Modify: `backend/app/config.py`

- [ ] **Step 1: Add `stripe` to pyproject dependencies**

Edit `backend/pyproject.toml` `dependencies` array — add after `"google-cloud-firestore>=2.16.0",`:

```toml
    "stripe~=9.0",
```

- [ ] **Step 2: Sync deps**

Run: `cd backend && uv sync`
Expected: resolves, installs `stripe` 9.x.

- [ ] **Step 3: Add Stripe Settings fields**

Edit `backend/app/config.py` — insert before `model_config = ...`:

```python
    # --- Stripe (sub-project 4c-2) ---
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_price_light: str = ""
    stripe_price_standard: str = ""
    stripe_price_intensive: str = ""
    stripe_portal_return_url: str = "http://localhost:3010/mypage/plan"
    checkout_success_url: str = "http://localhost:3010/mypage/plan?status=success"
    checkout_cancel_url: str = "http://localhost:3010/mypage/plan?status=cancel"
```

- [ ] **Step 4: Verify import**

Run: `cd backend && uv run python -c "import stripe; from app.config import get_settings; print(stripe.__version__, get_settings().checkout_success_url)"`
Expected: prints a `9.x` version + the localhost success url.

- [ ] **Step 5: Commit**

```bash
git add backend/pyproject.toml backend/uv.lock backend/app/config.py
git commit -m "feat(stripe): add stripe~=9 dep + Stripe Settings fields"
```

---

## Task 2: `User` subscription fields + `update_subscription`

**Files:**
- Modify: `backend/app/domain/entities/user.py`
- Modify: `backend/app/infrastructure/repositories/firestore_user_repository.py`
- Test: `backend/tests/infrastructure/repositories/test_firestore_user_repository.py`

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/infrastructure/repositories/test_firestore_user_repository.py` (the file already has emulator guard + a `repo` fixture from 4c-1; reuse the existing fixture name — inspect the top of the file and match it):

```python
async def test_subscription_fields_roundtrip(repo):
    from datetime import UTC, datetime
    from app.domain.entities.user import User
    now = datetime(2026, 6, 1, tzinfo=UTC)
    u = User(uid="sub1", email="s@example.com", name="Sub")
    u.update_subscription(
        customer_id="cus_X",
        subscription_id="sub_X",
        status="active",
        cancel_at_period_end=True,
        current_period_end=now,
    )
    await repo.save(u)
    got = await repo.find_by_uid("sub1")
    assert got is not None
    assert got.stripe_customer_id == "cus_X"
    assert got.stripe_subscription_id == "sub_X"
    assert got.subscription_status == "active"
    assert got.subscription_cancel_at_period_end is True
    assert got.current_period_end == now


async def test_subscription_fields_default_none(repo):
    from app.domain.entities.user import User
    u = User(uid="sub2", email="s2@example.com", name="Sub2")
    await repo.save(u)
    got = await repo.find_by_uid("sub2")
    assert got is not None
    assert got.stripe_customer_id is None
    assert got.subscription_status is None
    assert got.subscription_cancel_at_period_end is False
    assert got.current_period_end is None
```

- [ ] **Step 2: Run — expect failure**

Run: `cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uv run pytest tests/infrastructure/repositories/test_firestore_user_repository.py -v -k subscription`
Expected: FAIL — `AttributeError: 'User' object has no attribute 'update_subscription'`.

- [ ] **Step 3: Add entity fields + method**

Edit `backend/app/domain/entities/user.py`. Add the 5 fields **after** `updated_at` (all default-valued; every call site uses kwargs — verified safe; `is_admin` stays a runtime attr, unaffected):

```python
@dataclass
class User:
    uid: str
    email: str
    name: str
    phone: Phone | None = None
    plan: Plan | None = None
    plan_started_at: datetime | None = None
    trial_used: bool = False
    is_admin: bool = False
    created_at: datetime = field(default_factory=_utc_now)
    updated_at: datetime = field(default_factory=_utc_now)
    stripe_customer_id: str | None = None
    stripe_subscription_id: str | None = None
    subscription_status: str | None = None
    subscription_cancel_at_period_end: bool = False
    current_period_end: datetime | None = None
```

Add this method after `mark_trial_used`:

```python
    def update_subscription(
        self,
        *,
        customer_id: str | None = None,
        subscription_id: str | None = None,
        status: str | None = None,
        cancel_at_period_end: bool | None = None,
        current_period_end: datetime | None = None,
    ) -> None:
        """Stripe webhook 由来のサブスク状態を反映。None は「変更なし」。"""
        if customer_id is not None:
            self.stripe_customer_id = customer_id
        if subscription_id is not None:
            self.stripe_subscription_id = subscription_id
        if status is not None:
            self.subscription_status = status
        if cancel_at_period_end is not None:
            self.subscription_cancel_at_period_end = cancel_at_period_end
        if current_period_end is not None:
            self.current_period_end = current_period_end
        self.updated_at = _utc_now()

    def clear_subscription(self) -> None:
        """解約 (customer.subscription.deleted) 時。"""
        self.plan = None
        self.plan_started_at = None
        self.stripe_subscription_id = None
        self.subscription_status = "canceled"
        self.subscription_cancel_at_period_end = False
        self.updated_at = _utc_now()
```

- [ ] **Step 4: Map in repository**

Edit `backend/app/infrastructure/repositories/firestore_user_repository.py` `_to_dict` — add to the returned dict:

```python
            "stripe_customer_id": user.stripe_customer_id,
            "stripe_subscription_id": user.stripe_subscription_id,
            "subscription_status": user.subscription_status,
            "subscription_cancel_at_period_end": user.subscription_cancel_at_period_end,
            "current_period_end": user.current_period_end,
```

And `_from_dict` — add to the `User(...)` construction:

```python
            stripe_customer_id=data.get("stripe_customer_id"),
            stripe_subscription_id=data.get("stripe_subscription_id"),
            subscription_status=data.get("subscription_status"),
            subscription_cancel_at_period_end=bool(
                data.get("subscription_cancel_at_period_end", False)
            ),
            current_period_end=data.get("current_period_end"),
```

- [ ] **Step 5: Run — expect pass**

Run: `cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uv run pytest tests/infrastructure/repositories/test_firestore_user_repository.py -v`
Expected: new 2 pass + existing pass (the pre-existing `TestPhoneRoundTrip::test_phone_is_persisted` may still fail — known/unrelated, leave it).

- [ ] **Step 6: Ruff + mypy + commit**

```bash
cd backend && uv run ruff check app/domain/entities/user.py app/infrastructure/repositories/firestore_user_repository.py && uv run mypy app/domain
git add backend/app/domain/entities/user.py backend/app/infrastructure/repositories/firestore_user_repository.py backend/tests/infrastructure/repositories/test_firestore_user_repository.py
git commit -m "feat(user): subscription fields + update_subscription/clear_subscription"
```

---

## Task 3: `EmailService.send_payment_failed`

**Files:**
- Modify: `backend/app/services/email_service.py`
- Test: `backend/tests/services/test_email_service.py`

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/services/test_email_service.py` (inspect the file for its existing `MockEmailService` import style and match):

```python
async def test_mock_send_payment_failed_records_call():
    from app.services.email_service import MockEmailService
    svc = MockEmailService()
    ok = await svc.send_payment_failed("u@example.com", "山田太郎")
    assert ok is True
    assert any(
        "u@example.com" in str(c) for c in svc.sent_emails
    )  # MockEmailService records into sent_emails
```

> If `MockEmailService`'s recording attribute is not `sent_emails`, adapt the assertion to whatever list/attr the existing mock uses (inspect the class). The behavioural contract: returns `True` and records the recipient.

- [ ] **Step 2: Run — expect failure**

Run: `cd backend && uv run pytest tests/services/test_email_service.py -v -k payment_failed`
Expected: FAIL — `AttributeError: 'MockEmailService' object has no attribute 'send_payment_failed'`.

- [ ] **Step 3: Add to Protocol + both impls**

Edit `backend/app/services/email_service.py`:

In `class EmailService(Protocol):` add:

```python
    async def send_payment_failed(self, to_email: str, name: str) -> bool:
        """サブスク支払い失敗の通知メールを送信"""
        ...
```

In `class SMTPEmailService:` add (reuse the existing `_send_email` helper — match its real signature in the file):

```python
    async def send_payment_failed(self, to_email: str, name: str) -> bool:
        subject = "【英会話カフェ】お支払いが確認できませんでした"
        body = (
            f"{name} 様\n\n"
            "サブスクリプションのお支払いが確認できませんでした。\n"
            "カード情報をご確認のうえ、マイページの「プラン管理」から\n"
            "お支払い方法を更新してください。数日内に自動で再請求されます。\n\n"
            "英会話カフェ"
        )
        return await self._send_email(to_email, subject, body)
```

In `class MockEmailService:` add (match the recording pattern the existing mock methods use — e.g. append to `self.sent_emails`):

```python
    async def send_payment_failed(self, to_email: str, name: str) -> bool:
        self.sent_emails.append(
            {"to": to_email, "type": "payment_failed", "name": name}
        )
        logger.info("MockEmail payment_failed -> %s", to_email)
        return True
```

> Match `MockEmailService.__init__`'s actual recording structure. If it uses a different attribute than `sent_emails`, append in that structure consistently with the other mock methods.

- [ ] **Step 4: Run — expect pass**

Run: `cd backend && uv run pytest tests/services/test_email_service.py -v`
Expected: all pass.

- [ ] **Step 5: Ruff + commit**

```bash
cd backend && uv run ruff check app/services/email_service.py tests/services/test_email_service.py
git add backend/app/services/email_service.py backend/tests/services/test_email_service.py
git commit -m "feat(email): send_payment_failed on Protocol + SMTP + Mock"
```

---

## Task 4: `ProcessedEventRepository`

**Files:**
- Create: `backend/app/domain/repositories/processed_event_repository.py`
- Create: `backend/app/infrastructure/repositories/firestore_processed_event_repository.py`
- Test: `backend/tests/infrastructure/repositories/test_firestore_processed_event_repository.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/infrastructure/repositories/test_firestore_processed_event_repository.py`:

```python
"""Emulator tests for ProcessedEventRepository.claim (create-if-absent)."""

from __future__ import annotations

import os

import pytest

if not os.environ.get("FIRESTORE_EMULATOR_HOST"):
    pytest.skip("emulator not configured", allow_module_level=True)

from google.cloud import firestore as fs  # noqa: E402

from app.infrastructure.repositories.firestore_processed_event_repository import (
    FirestoreProcessedEventRepository,
)


@pytest.fixture
async def repo():
    client = fs.AsyncClient(project="test-project")
    async for d in client.collection("processed_stripe_events").stream():
        await d.reference.delete()
    return FirestoreProcessedEventRepository(client)


async def test_claim_first_time_true(repo):
    assert await repo.claim("evt_1", "invoice.paid") is True


async def test_claim_second_time_false(repo):
    await repo.claim("evt_2", "invoice.paid")
    assert await repo.claim("evt_2", "invoice.paid") is False


async def test_claim_distinct_ids_both_true(repo):
    assert await repo.claim("evt_a", "x") is True
    assert await repo.claim("evt_b", "x") is True
```

- [ ] **Step 2: Run — expect failure**

Run: `cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uv run pytest tests/infrastructure/repositories/test_firestore_processed_event_repository.py -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Create interface**

Create `backend/app/domain/repositories/processed_event_repository.py`:

```python
"""ProcessedEventRepository interface — Stripe webhook idempotency."""

from __future__ import annotations

from abc import ABC, abstractmethod


class ProcessedEventRepository(ABC):
    @abstractmethod
    async def claim(self, event_id: str, event_type: str) -> bool:
        """初回 True (この呼び出しが処理権を得た)、既処理なら False。

        Firestore create-if-absent の atomic 性に依存 (非クリティカル
        event の claim-first 用)。クリティカル invoice.paid は
        StripeService が transaction 内で別途 processed doc を扱う。
        """
        ...
```

- [ ] **Step 4: Create Firestore impl**

Create `backend/app/infrastructure/repositories/firestore_processed_event_repository.py`:

```python
"""Firestore impl of ProcessedEventRepository."""

from __future__ import annotations

from datetime import UTC, datetime

from google.api_core.exceptions import AlreadyExists
from google.cloud import firestore as fs  # type: ignore[import-untyped]

from app.domain.repositories.processed_event_repository import (
    ProcessedEventRepository,
)

_COLLECTION = "processed_stripe_events"


class FirestoreProcessedEventRepository(ProcessedEventRepository):
    def __init__(self, client: fs.AsyncClient) -> None:
        self._client = client
        self._collection = client.collection(_COLLECTION)

    async def claim(self, event_id: str, event_type: str) -> bool:
        try:
            await self._collection.document(event_id).create(
                {
                    "event_type": event_type,
                    "processed_at": datetime.now(UTC),
                }
            )
            return True
        except AlreadyExists:
            return False
```

- [ ] **Step 5: Run — expect pass**

Run: `cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uv run pytest tests/infrastructure/repositories/test_firestore_processed_event_repository.py -v`
Expected: 3 passed. (This proves the emulator honors `.create()` create-if-absent — a codebase-first dependency surface.)

- [ ] **Step 6: Ruff + mypy + commit**

```bash
cd backend && uv run ruff check app/domain/repositories/processed_event_repository.py app/infrastructure/repositories/firestore_processed_event_repository.py tests/infrastructure/repositories/test_firestore_processed_event_repository.py && uv run mypy app/domain
git add backend/app/domain/repositories/processed_event_repository.py backend/app/infrastructure/repositories/firestore_processed_event_repository.py backend/tests/infrastructure/repositories/test_firestore_processed_event_repository.py
git commit -m "feat(idempotency): ProcessedEventRepository.claim via Firestore create-if-absent"
```

---

## Task 5: `StripeService` — checkout + portal sessions

**Files:**
- Create: `backend/app/services/stripe_service.py`
- Test: `backend/tests/services/test_stripe_service.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/services/test_stripe_service.py`:

```python
"""StripeService tests — Stripe SDK fully mocked, no network."""

from __future__ import annotations

import os
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

if not os.environ.get("FIRESTORE_EMULATOR_HOST"):
    pytest.skip("emulator not configured", allow_module_level=True)

from google.cloud import firestore as fs  # noqa: E402

from app.config import Settings
from app.domain.entities.user import User
from app.domain.enums.plan import Plan
from app.infrastructure.repositories.firestore_monthly_quota_repository import (
    FirestoreMonthlyQuotaRepository,
)
from app.infrastructure.repositories.firestore_processed_event_repository import (
    FirestoreProcessedEventRepository,
)
from app.infrastructure.repositories.firestore_user_repository import (
    FirestoreUserRepository,
)
from app.services.email_service import MockEmailService
from app.services.stripe_service import StripeService


def _settings() -> Settings:
    s = Settings()
    s.stripe_secret_key = "sk_test_dummy"
    s.stripe_webhook_secret = "whsec_dummy"
    s.stripe_price_light = "price_light"
    s.stripe_price_standard = "price_standard"
    s.stripe_price_intensive = "price_intensive"
    return s


@pytest.fixture
async def client():
    return fs.AsyncClient(project="test-project")


@pytest.fixture(autouse=True)
async def _clean(client):
    for col in ("users", "monthly_quota", "processed_stripe_events"):
        async for d in client.collection(col).stream():
            await d.reference.delete()
    yield


@pytest.fixture
async def service(client):
    return StripeService(
        user_repo=FirestoreUserRepository(client),
        quota_repo=FirestoreMonthlyQuotaRepository(client),
        email_service=MockEmailService(),
        processed_repo=FirestoreProcessedEventRepository(client),
        fs_client=client,
        settings=_settings(),
    )


async def test_create_checkout_session_params(service):
    with patch("stripe.checkout.Session.create") as m:
        m.return_value = MagicMock(url="https://checkout.stripe/x")
        user = User(uid="u1", email="u1@example.com", name="U1")
        url = await service.create_checkout_session(user=user, plan=Plan.STANDARD)
    assert url == "https://checkout.stripe/x"
    kwargs = m.call_args.kwargs
    assert kwargs["client_reference_id"] == "u1"
    assert kwargs["subscription_data"]["metadata"]["firebase_uid"] == "u1"
    assert kwargs["line_items"][0]["price"] == "price_standard"
    assert kwargs["automatic_tax"] == {"enabled": True}
    assert kwargs["mode"] == "subscription"


async def test_create_portal_no_customer_raises_409(service):
    from fastapi import HTTPException
    user = User(uid="u2", email="u2@example.com", name="U2")
    with pytest.raises(HTTPException) as ei:
        await service.create_portal_session(user=user)
    assert ei.value.status_code == 409


async def test_create_portal_with_customer(service):
    with patch("stripe.billing_portal.Session.create") as m:
        m.return_value = MagicMock(url="https://portal.stripe/x")
        user = User(uid="u3", email="u3@example.com", name="U3")
        user.stripe_customer_id = "cus_3"
        url = await service.create_portal_session(user=user)
    assert url == "https://portal.stripe/x"
    assert m.call_args.kwargs["customer"] == "cus_3"
```

- [ ] **Step 2: Run — expect failure**

Run: `cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uv run pytest tests/services/test_stripe_service.py -v -k "checkout or portal"`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement skeleton + the two session methods**

Create `backend/app/services/stripe_service.py`:

```python
"""StripeService — checkout/portal sessions + webhook dispatch.

公式 stripe lib は同期。FastAPI async 経路では asyncio.to_thread で
オフロードする。invoice.paid の quota grant + processed_event 書き込みは
単一 Firestore transaction (exactly-once)。
"""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

import stripe
from fastapi import HTTPException, status
from google.cloud import firestore as fs  # type: ignore[import-untyped]

from app.config import Settings
from app.domain.entities.monthly_quota import MonthlyQuota
from app.domain.enums.plan import PLAN_QUOTA, Plan
from app.domain.services.quota_expiry import add_two_months
from app.infrastructure.repositories.firestore_monthly_quota_repository import (
    FirestoreMonthlyQuotaRepository,
)
from app.infrastructure.repositories.firestore_processed_event_repository import (
    FirestoreProcessedEventRepository,
)
from app.infrastructure.repositories.firestore_user_repository import (
    FirestoreUserRepository,
)
from app.services.email_service import EmailService

logger = logging.getLogger(__name__)

STRIPE_API_VERSION = "2024-06-20"


class StripeService:
    def __init__(
        self,
        *,
        user_repo: FirestoreUserRepository,
        quota_repo: FirestoreMonthlyQuotaRepository,
        email_service: EmailService,
        processed_repo: FirestoreProcessedEventRepository,
        fs_client: fs.AsyncClient,
        settings: Settings,
    ) -> None:
        self._users = user_repo
        self._quota = quota_repo
        self._email = email_service
        self._processed = processed_repo
        self._fs = fs_client
        self._settings = settings
        stripe.api_key = settings.stripe_secret_key
        # 冪等な定数代入 (常に同値) なので並行リクエストでも安全
        stripe.api_version = STRIPE_API_VERSION
        self._price_map: dict[Plan, str] = {
            Plan.LIGHT: settings.stripe_price_light,
            Plan.STANDARD: settings.stripe_price_standard,
            Plan.INTENSIVE: settings.stripe_price_intensive,
        }
        self._plan_for_price: dict[str, Plan] = {
            v: k for k, v in self._price_map.items() if v
        }

    async def create_checkout_session(self, *, user: Any, plan: Plan) -> str:
        session = await asyncio.to_thread(
            stripe.checkout.Session.create,
            mode="subscription",
            line_items=[{"price": self._price_map[plan], "quantity": 1}],
            client_reference_id=user.uid,
            subscription_data={"metadata": {"firebase_uid": user.uid}},
            customer=user.stripe_customer_id or None,
            customer_email=(
                user.email if not user.stripe_customer_id else None
            ),
            automatic_tax={"enabled": True},
            success_url=self._settings.checkout_success_url,
            cancel_url=self._settings.checkout_cancel_url,
        )
        return str(session.url)

    async def create_portal_session(self, *, user: Any) -> str:
        if not user.stripe_customer_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"code": "no_subscription"},
            )
        session = await asyncio.to_thread(
            stripe.billing_portal.Session.create,
            customer=user.stripe_customer_id,
            return_url=self._settings.stripe_portal_return_url,
        )
        return str(session.url)
```

- [ ] **Step 4: Run — expect pass**

Run: `cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uv run pytest tests/services/test_stripe_service.py -v -k "checkout or portal"`
Expected: 3 passed.

- [ ] **Step 5: Ruff + mypy + commit**

```bash
cd backend && uv run ruff check app/services/stripe_service.py tests/services/test_stripe_service.py && uv run mypy app/services
git add backend/app/services/stripe_service.py backend/tests/services/test_stripe_service.py
git commit -m "feat(stripe): StripeService checkout + portal session creation"
```

---

## Task 6: `handle_webhook` — signature verify + uid/plan resolution helper

**Files:**
- Modify: `backend/app/services/stripe_service.py`
- Test: `backend/tests/services/test_stripe_service.py`

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/services/test_stripe_service.py`:

```python
async def test_webhook_bad_signature_raises(service):
    with patch(
        "stripe.Webhook.construct_event",
        side_effect=stripe.SignatureVerificationError("bad", "sig"),
    ):
        with pytest.raises(stripe.SignatureVerificationError):
            await service.handle_webhook(raw_payload=b"{}", sig_header="bad")
```

(Add `import stripe` at top of the test file if not already present.)

- [ ] **Step 2: Run — expect failure**

Run: `cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uv run pytest tests/services/test_stripe_service.py -v -k bad_signature`
Expected: FAIL — `AttributeError: 'StripeService' object has no attribute 'handle_webhook'`.

- [ ] **Step 3: Implement webhook entry + helper**

Append to `StripeService` in `backend/app/services/stripe_service.py`:

```python
    def _resolve_sub_id(self, invoice: Any) -> str | None:
        sub = invoice.get("subscription")
        if sub:
            return str(sub)
        parent = invoice.get("parent") or {}
        details = parent.get("subscription_details") or {}
        sub = details.get("subscription")
        return str(sub) if sub else None

    async def _resolve_uid_plan(
        self, invoice: Any
    ) -> tuple[str, Plan] | None:
        sub_id = self._resolve_sub_id(invoice)
        if not sub_id:
            logger.error("invoice has no subscription id: %s", invoice.get("id"))
            return None
        subscription = await asyncio.to_thread(
            stripe.Subscription.retrieve, sub_id
        )
        uid = (subscription.get("metadata") or {}).get("firebase_uid")
        if not uid:
            logger.error("subscription %s missing firebase_uid", sub_id)
            return None
        price_id = subscription["items"]["data"][0]["price"]["id"]
        plan = self._plan_for_price.get(price_id)
        if plan is None:
            logger.error("unknown price id %s", price_id)
            return None
        return uid, plan

    async def handle_webhook(
        self, *, raw_payload: bytes, sig_header: str
    ) -> None:
        event = await asyncio.to_thread(
            stripe.Webhook.construct_event,
            raw_payload,
            sig_header,
            self._settings.stripe_webhook_secret,
        )
        etype = event["type"]
        obj = event["data"]["object"]
        if etype == "invoice.paid":
            await self._on_invoice_paid(event["id"], obj)
        elif etype == "checkout.session.completed":
            await self._on_checkout_completed(event["id"], etype, obj)
        elif etype == "customer.subscription.updated":
            await self._on_subscription_updated(event["id"], etype, obj)
        elif etype == "customer.subscription.deleted":
            await self._on_subscription_deleted(event["id"], etype, obj)
        elif etype == "invoice.payment_failed":
            await self._on_payment_failed(event["id"], etype, obj)
        else:
            logger.info("ignoring stripe event %s", etype)
```

Add stub handlers (filled in Tasks 7-9) so the module imports — append:

```python
    async def _on_invoice_paid(self, event_id: str, invoice: Any) -> None:
        raise NotImplementedError

    async def _on_checkout_completed(
        self, event_id: str, etype: str, obj: Any
    ) -> None:
        raise NotImplementedError

    async def _on_subscription_updated(
        self, event_id: str, etype: str, sub: Any
    ) -> None:
        raise NotImplementedError

    async def _on_subscription_deleted(
        self, event_id: str, etype: str, sub: Any
    ) -> None:
        raise NotImplementedError

    async def _on_payment_failed(
        self, event_id: str, etype: str, invoice: Any
    ) -> None:
        raise NotImplementedError
```

- [ ] **Step 4: Run — expect pass**

Run: `cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uv run pytest tests/services/test_stripe_service.py -v -k bad_signature`
Expected: PASS.

- [ ] **Step 5: Ruff + mypy + commit**

```bash
cd backend && uv run ruff check app/services/stripe_service.py tests/services/test_stripe_service.py && uv run mypy app/services
git add backend/app/services/stripe_service.py backend/tests/services/test_stripe_service.py
git commit -m "feat(stripe): webhook entry, signature verify, uid/plan resolver"
```

---

## Task 7: `checkout.session.completed` handler (save → claim order)

**Files:**
- Modify: `backend/app/services/stripe_service.py`
- Test: `backend/tests/services/test_stripe_service.py`

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/services/test_stripe_service.py`:

```python
def _event(etype: str, obj: dict, eid: str = "evt_x") -> dict:
    return {"id": eid, "type": etype, "data": {"object": obj}}


async def test_checkout_completed_saves_customer_and_plan(service, client):
    await FirestoreUserRepository(client).save(
        User(uid="cu1", email="cu1@example.com", name="Cu1")
    )
    sub_obj = {
        "metadata": {"firebase_uid": "cu1"},
        "items": {"data": [{"price": {"id": "price_standard"}}]},
    }
    ev = _event(
        "checkout.session.completed",
        {
            "client_reference_id": "cu1",
            "customer": "cus_1",
            "subscription": "sub_1",
        },
    )
    with (
        patch("stripe.Webhook.construct_event", return_value=ev),
        patch("stripe.Subscription.retrieve", return_value=sub_obj),
    ):
        await service.handle_webhook(raw_payload=b"{}", sig_header="ok")
    got = await FirestoreUserRepository(client).find_by_uid("cu1")
    assert got.stripe_customer_id == "cus_1"
    assert got.stripe_subscription_id == "sub_1"
    assert got.subscription_status == "active"
    assert got.plan == Plan.STANDARD
    # no quota granted by checkout.session.completed
    docs = [d async for d in client.collection("monthly_quota").stream()]
    assert docs == []
```

- [ ] **Step 2: Run — expect failure**

Run: `cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uv run pytest tests/services/test_stripe_service.py -v -k checkout_completed_saves`
Expected: FAIL — `NotImplementedError`.

- [ ] **Step 3: Implement handler**

Replace `_on_checkout_completed` stub in `backend/app/services/stripe_service.py`:

```python
    async def _on_checkout_completed(
        self, event_id: str, etype: str, obj: Any
    ) -> None:
        uid = obj.get("client_reference_id")
        if not uid:
            logger.error("checkout.session.completed missing client_reference_id")
            return
        user = await self._users.find_by_uid(uid)
        if user is None:
            logger.error("checkout completed for unknown uid %s", uid)
            return
        sub_id = obj.get("subscription")
        plan: Plan | None = None
        if sub_id:
            subscription = await asyncio.to_thread(
                stripe.Subscription.retrieve, sub_id
            )
            price_id = subscription["items"]["data"][0]["price"]["id"]
            plan = self._plan_for_price.get(price_id)
        user.update_subscription(
            customer_id=obj.get("customer"),
            subscription_id=sub_id,
            status="active",
        )
        if plan is not None:
            user.set_plan(plan)
        # save BEFORE claim: this event is the sole carrier of
        # stripe_customer_id; a claim-first lost-write would strand the
        # paying user without a customer id. save is an idempotent
        # overwrite so double-processing is harmless.
        await self._users.save(user)
        await self._processed.claim(event_id, etype)
```

- [ ] **Step 4: Run — expect pass**

Run: `cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uv run pytest tests/services/test_stripe_service.py -v -k checkout_completed_saves`
Expected: PASS.

- [ ] **Step 5: Ruff + mypy + commit**

```bash
cd backend && uv run ruff check app/services/stripe_service.py tests/services/test_stripe_service.py && uv run mypy app/services
git add backend/app/services/stripe_service.py backend/tests/services/test_stripe_service.py
git commit -m "feat(stripe): checkout.session.completed handler (save before claim)"
```

---

## Task 8: `invoice.paid` handler — atomic exactly-once grant

**Files:**
- Modify: `backend/app/services/stripe_service.py`
- Test: `backend/tests/services/test_stripe_service.py`

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/services/test_stripe_service.py`:

```python
def _invoice_event(eid: str, sub_id: str = "sub_p") -> dict:
    return _event("invoice.paid", {"id": "in_1", "subscription": sub_id}, eid)


async def test_invoice_paid_grants_full_quota(service, client):
    await FirestoreUserRepository(client).save(
        User(uid="ip1", email="ip1@example.com", name="Ip1")
    )
    sub_obj = {
        "metadata": {"firebase_uid": "ip1"},
        "items": {"data": [{"price": {"id": "price_light"}}]},
    }
    ev = _invoice_event("evt_ip1")
    with (
        patch("stripe.Webhook.construct_event", return_value=ev),
        patch("stripe.Subscription.retrieve", return_value=sub_obj),
    ):
        await service.handle_webhook(raw_payload=b"{}", sig_header="ok")
    docs = [d.to_dict() async for d in client.collection("monthly_quota").stream()]
    assert len(docs) == 1
    assert docs[0]["granted"] == 4  # PLAN_QUOTA[LIGHT]
    assert docs[0]["plan_at_grant"] == "light"
    pe = [d async for d in client.collection("processed_stripe_events").stream()]
    assert len(pe) == 1


async def test_invoice_paid_duplicate_event_skips(service, client):
    await FirestoreUserRepository(client).save(
        User(uid="ip2", email="ip2@example.com", name="Ip2")
    )
    sub_obj = {
        "metadata": {"firebase_uid": "ip2"},
        "items": {"data": [{"price": {"id": "price_light"}}]},
    }
    ev = _invoice_event("evt_dup")
    with (
        patch("stripe.Webhook.construct_event", return_value=ev),
        patch("stripe.Subscription.retrieve", return_value=sub_obj),
    ):
        await service.handle_webhook(raw_payload=b"{}", sig_header="ok")
        await service.handle_webhook(raw_payload=b"{}", sig_header="ok")
    docs = [d async for d in client.collection("monthly_quota").stream()]
    assert len(docs) == 1  # exactly-once despite re-delivery


async def test_invoice_paid_any_billing_reason_grants(service, client):
    await FirestoreUserRepository(client).save(
        User(uid="ip3", email="ip3@example.com", name="Ip3")
    )
    sub_obj = {
        "metadata": {"firebase_uid": "ip3"},
        "items": {"data": [{"price": {"id": "price_intensive"}}]},
    }
    ev = _event(
        "invoice.paid",
        {"id": "in_3", "subscription": "sub_3", "billing_reason": "subscription_update"},
        "evt_ip3",
    )
    with (
        patch("stripe.Webhook.construct_event", return_value=ev),
        patch("stripe.Subscription.retrieve", return_value=sub_obj),
    ):
        await service.handle_webhook(raw_payload=b"{}", sig_header="ok")
    docs = [d.to_dict() async for d in client.collection("monthly_quota").stream()]
    assert len(docs) == 1 and docs[0]["granted"] == 16  # Y: grants regardless
```

- [ ] **Step 2: Run — expect failure**

Run: `cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uv run pytest tests/services/test_stripe_service.py -v -k invoice_paid`
Expected: FAIL — `NotImplementedError`.

- [ ] **Step 3: Implement atomic handler**

Replace `_on_invoice_paid` stub in `backend/app/services/stripe_service.py`:

```python
    async def _on_invoice_paid(self, event_id: str, invoice: Any) -> None:
        # --- (txn の外) network I/O で uid/plan を確定 ---
        resolved = await self._resolve_uid_plan(invoice)
        if resolved is None:
            return  # logged inside; 200 to Stripe (no retry storm)
        uid, plan = resolved
        now = datetime.now(UTC)
        granted = PLAN_QUOTA[plan]
        quota = MonthlyQuota(
            user_id=uid,
            year_month=now.strftime("%Y-%m"),
            plan_at_grant=plan.value,
            granted=granted,
            used=0,
            granted_at=now,
            expires_at=add_two_months(now),
        )
        quota_doc_id = f"{uid}_{now.strftime('%Y%m%d%H%M%S%f')}"
        quota_dict = self._quota._to_dict(quota)
        pe_ref = self._fs.collection("processed_stripe_events").document(
            event_id
        )
        quota_ref = self._fs.collection("monthly_quota").document(quota_doc_id)

        @fs.async_transactional
        async def txn(tx):  # type: ignore[no-untyped-def]
            pe_snap = await pe_ref.get(transaction=tx)
            if pe_snap.exists:
                return  # exactly-once: already processed (before any write)
            tx.set(quota_ref, quota_dict)
            tx.set(
                pe_ref,
                {"event_type": "invoice.paid", "processed_at": datetime.now(UTC)},
            )

        await txn(self._fs.transaction())
```

- [ ] **Step 4: Run — expect pass**

Run: `cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uv run pytest tests/services/test_stripe_service.py -v -k invoice_paid`
Expected: 3 passed (grant, duplicate-skip exactly-once, any-billing_reason).

- [ ] **Step 5: Ruff + mypy + commit**

```bash
cd backend && uv run ruff check app/services/stripe_service.py tests/services/test_stripe_service.py && uv run mypy app/services
git add backend/app/services/stripe_service.py backend/tests/services/test_stripe_service.py
git commit -m "feat(stripe): invoice.paid atomic exactly-once quota grant (sole path)"
```

---

## Task 9: `subscription.updated` / `subscription.deleted` / `payment_failed` handlers

**Files:**
- Modify: `backend/app/services/stripe_service.py`
- Test: `backend/tests/services/test_stripe_service.py`

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/services/test_stripe_service.py`:

```python
async def test_subscription_updated_changes_plan_no_grant(service, client):
    u = User(uid="su1", email="su1@example.com", name="Su1")
    u.set_plan(Plan.LIGHT)
    await FirestoreUserRepository(client).save(u)
    sub = {
        "metadata": {"firebase_uid": "su1"},
        "items": {"data": [{"price": {"id": "price_standard"}}]},
        "cancel_at_period_end": True,
        "current_period_end": 1782000000,
        "status": "active",
    }
    ev = _event("customer.subscription.updated", sub, "evt_su1")
    with patch("stripe.Webhook.construct_event", return_value=ev):
        await service.handle_webhook(raw_payload=b"{}", sig_header="ok")
    got = await FirestoreUserRepository(client).find_by_uid("su1")
    assert got.plan == Plan.STANDARD
    assert got.subscription_cancel_at_period_end is True
    assert got.current_period_end is not None
    assert got.current_period_end.tzinfo is not None  # tz-aware UTC
    docs = [d async for d in client.collection("monthly_quota").stream()]
    assert docs == []  # Y: subscription.updated never grants


async def test_subscription_deleted_clears_plan(service, client):
    u = User(uid="sd1", email="sd1@example.com", name="Sd1")
    u.set_plan(Plan.STANDARD)
    u.update_subscription(subscription_id="sub_d")
    await FirestoreUserRepository(client).save(u)
    sub = {"metadata": {"firebase_uid": "sd1"}}
    ev = _event("customer.subscription.deleted", sub, "evt_sd1")
    with patch("stripe.Webhook.construct_event", return_value=ev):
        await service.handle_webhook(raw_payload=b"{}", sig_header="ok")
    got = await FirestoreUserRepository(client).find_by_uid("sd1")
    assert got.plan is None
    assert got.subscription_status == "canceled"
    assert got.stripe_subscription_id is None


async def test_payment_failed_sets_past_due_and_emails(service, client):
    await FirestoreUserRepository(client).save(
        User(uid="pf1", email="pf1@example.com", name="Pf1")
    )
    sub_obj = {"metadata": {"firebase_uid": "pf1"}, "items": {"data": [{"price": {"id": "price_light"}}]}}
    ev = _event("invoice.payment_failed", {"id": "in_pf", "subscription": "sub_pf"}, "evt_pf1")
    with (
        patch("stripe.Webhook.construct_event", return_value=ev),
        patch("stripe.Subscription.retrieve", return_value=sub_obj),
    ):
        await service.handle_webhook(raw_payload=b"{}", sig_header="ok")
    got = await FirestoreUserRepository(client).find_by_uid("pf1")
    assert got.subscription_status == "past_due"
    assert any(
        e.get("type") == "payment_failed" for e in service._email.sent_emails
    )
```

> If `MockEmailService` records under a different attr than `sent_emails`, adjust the last assertion (match Task 3's choice).

- [ ] **Step 2: Run — expect failure**

Run: `cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uv run pytest tests/services/test_stripe_service.py -v -k "subscription_updated or subscription_deleted or payment_failed"`
Expected: FAIL — `NotImplementedError`.

- [ ] **Step 3: Implement the three handlers**

Replace the three stubs in `backend/app/services/stripe_service.py`:

```python
    async def _on_subscription_updated(
        self, event_id: str, etype: str, sub: Any
    ) -> None:
        if not await self._processed.claim(event_id, etype):
            return
        uid = (sub.get("metadata") or {}).get("firebase_uid")
        if not uid:
            logger.error("subscription.updated missing firebase_uid")
            return
        user = await self._users.find_by_uid(uid)
        if user is None:
            logger.error("subscription.updated unknown uid %s", uid)
            return
        price_id = sub["items"]["data"][0]["price"]["id"]
        plan = self._plan_for_price.get(price_id)
        if plan is not None:
            user.set_plan(plan)
        cpe = sub.get("current_period_end")
        user.update_subscription(
            status=sub.get("status"),
            cancel_at_period_end=sub.get("cancel_at_period_end"),
            current_period_end=(
                datetime.fromtimestamp(cpe, tz=UTC) if cpe else None
            ),
        )
        await self._users.save(user)

    async def _on_subscription_deleted(
        self, event_id: str, etype: str, sub: Any
    ) -> None:
        if not await self._processed.claim(event_id, etype):
            return
        uid = (sub.get("metadata") or {}).get("firebase_uid")
        if not uid:
            logger.error("subscription.deleted missing firebase_uid")
            return
        user = await self._users.find_by_uid(uid)
        if user is None:
            return
        user.clear_subscription()
        await self._users.save(user)

    async def _on_payment_failed(
        self, event_id: str, etype: str, invoice: Any
    ) -> None:
        if not await self._processed.claim(event_id, etype):
            return
        resolved = await self._resolve_uid_plan(invoice)
        if resolved is None:
            return
        uid, _plan = resolved
        user = await self._users.find_by_uid(uid)
        if user is None:
            return
        user.update_subscription(status="past_due")
        await self._users.save(user)
        await self._email.send_payment_failed(user.email, user.name)
```

- [ ] **Step 4: Run — expect pass**

Run: `cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uv run pytest tests/services/test_stripe_service.py -v`
Expected: all green (checkout/portal/webhook/invoice.paid/the 3 here).

- [ ] **Step 5: Ruff + mypy + commit**

```bash
cd backend && uv run ruff check app/services/stripe_service.py tests/services/test_stripe_service.py && uv run mypy app/services
git add backend/app/services/stripe_service.py backend/tests/services/test_stripe_service.py
git commit -m "feat(stripe): subscription.updated/deleted + payment_failed handlers"
```

---

## Task 10: Billing endpoints + DI + router

**Files:**
- Create: `backend/app/api/schemas/billing.py`
- Create: `backend/app/api/endpoints/billing.py`
- Modify: `backend/app/api/dependencies/repositories.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/api/test_billing_endpoints.py`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/api/test_billing_endpoints.py`:

```python
"""HTTP tests for /api/v1/billing/*."""

from __future__ import annotations

import os
from unittest.mock import MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

if not os.environ.get("FIRESTORE_EMULATOR_HOST"):
    pytest.skip("emulator not configured", allow_module_level=True)

from app.api.dependencies.auth import get_current_user
from app.domain.entities.user import User
from app.main import app


@pytest.fixture
def user():
    return User(uid="b1", email="b1@example.com", name="B1")


@pytest.fixture
def http(user):
    app.dependency_overrides[get_current_user] = lambda: user
    yield AsyncClient(transport=ASGITransport(app=app), base_url="http://t")
    app.dependency_overrides.clear()


async def test_checkout_requires_auth():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://t"
    ) as h:
        r = await h.post("/api/v1/billing/checkout", json={"plan": "light"})
    assert r.status_code in (401, 403)


async def test_checkout_returns_url(http):
    with patch("stripe.checkout.Session.create") as m:
        m.return_value = MagicMock(url="https://checkout/x")
        async with http as h:
            r = await h.post(
                "/api/v1/billing/checkout", json={"plan": "standard"}
            )
    assert r.status_code == 200
    assert r.json()["url"] == "https://checkout/x"


async def test_portal_no_customer_409(http):
    async with http as h:
        r = await h.post("/api/v1/billing/portal", json={})
    assert r.status_code == 409


async def test_webhook_bad_signature_400():
    with patch(
        "stripe.Webhook.construct_event",
        side_effect=__import__("stripe").SignatureVerificationError("x", "s"),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://t"
        ) as h:
            r = await h.post(
                "/api/v1/billing/webhook",
                content=b"{}",
                headers={"stripe-signature": "bad"},
            )
    assert r.status_code == 400


async def test_webhook_ok_200():
    ev = {"id": "e1", "type": "ping", "data": {"object": {}}}
    with patch("stripe.Webhook.construct_event", return_value=ev):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://t"
        ) as h:
            r = await h.post(
                "/api/v1/billing/webhook",
                content=b"{}",
                headers={"stripe-signature": "ok"},
            )
    assert r.status_code == 200
```

- [ ] **Step 2: Run — expect failure**

Run: `cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uv run pytest tests/api/test_billing_endpoints.py -v`
Expected: FAIL — 404 (router not registered).

- [ ] **Step 3: Create schemas**

Create `backend/app/api/schemas/billing.py`:

```python
"""Pydantic models for billing endpoints."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class CheckoutRequest(BaseModel):
    plan: Literal["light", "standard", "intensive"]


class SessionUrlResponse(BaseModel):
    url: str
```

- [ ] **Step 4: Add `get_stripe_service` DI**

Edit `backend/app/api/dependencies/repositories.py` — add imports at top (the module currently imports neither settings nor container):

```python
from app.config import get_settings
from app.infrastructure.di.container import get_container
from app.infrastructure.repositories.firestore_processed_event_repository import (
    FirestoreProcessedEventRepository,
)
from app.services.stripe_service import StripeService
```

Append factory:

```python
def get_stripe_service() -> StripeService:
    client = get_firestore_client()
    return StripeService(
        user_repo=FirestoreUserRepository(client),
        quota_repo=FirestoreMonthlyQuotaRepository(client),
        email_service=get_container().email_service(),
        processed_repo=FirestoreProcessedEventRepository(client),
        fs_client=client,
        settings=get_settings(),
    )
```

- [ ] **Step 5: Create endpoints**

Create `backend/app/api/endpoints/billing.py`:

```python
"""/api/v1/billing/* — checkout / portal / webhook."""

from __future__ import annotations

import logging
from typing import Annotated, Any

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.api.dependencies.auth import get_current_user
from app.api.dependencies.repositories import get_stripe_service
from app.api.schemas.billing import CheckoutRequest, SessionUrlResponse
from app.domain.entities.user import User
from app.domain.enums.plan import Plan
from app.services.stripe_service import StripeService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/billing", tags=["billing"])


@router.post("/checkout", response_model=SessionUrlResponse)
async def checkout(
    payload: CheckoutRequest,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[StripeService, Depends(get_stripe_service)],
) -> SessionUrlResponse:
    url = await service.create_checkout_session(
        user=user, plan=Plan(payload.plan)
    )
    return SessionUrlResponse(url=url)


@router.post("/portal", response_model=SessionUrlResponse)
async def portal(
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[StripeService, Depends(get_stripe_service)],
) -> SessionUrlResponse:
    url = await service.create_portal_session(user=user)
    return SessionUrlResponse(url=url)


@router.post("/webhook")
async def webhook(
    request: Request,
    service: Annotated[StripeService, Depends(get_stripe_service)],
) -> dict[str, Any]:
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        await service.handle_webhook(raw_payload=payload, sig_header=sig)
    except stripe.SignatureVerificationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "invalid_signature"},
        ) from e
    except Exception:
        logger.exception("stripe webhook processing error")
        # 200 to avoid Stripe retry storm; critical grant rolls back in
        # its txn and is safely re-tried on Stripe's redelivery.
    return {}
```

- [ ] **Step 6: Register router**

Edit `backend/app/main.py`: add import after the other endpoint imports:

```python
from .api.endpoints.billing import router as billing_router
```

Add after `app.include_router(admin_router)`:

```python
app.include_router(billing_router)
```

- [ ] **Step 7: Run — expect pass**

Run: `cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uv run pytest tests/api/test_billing_endpoints.py -v`
Expected: 5 passed.

- [ ] **Step 8: Ruff + mypy + commit**

```bash
cd backend && uv run ruff check app/api/endpoints/billing.py app/api/schemas/billing.py app/api/dependencies/repositories.py app/main.py tests/api/test_billing_endpoints.py && uv run mypy app/api app/services
git add backend/app/api/endpoints/billing.py backend/app/api/schemas/billing.py backend/app/api/dependencies/repositories.py backend/app/main.py backend/tests/api/test_billing_endpoints.py
git commit -m "feat(billing): checkout/portal/webhook endpoints + get_stripe_service DI"
```

---

## Task 11: `/users/me` subscription fields

**Files:**
- Modify: `backend/app/api/schemas/user.py`
- Modify: `backend/app/api/endpoints/users.py`
- Test: the `/users/me` test module (`backend/tests/api/test_users.py` if it exists; else where `/users/me` is tested)

- [ ] **Step 1: Write the failing test**

Add to the `/users/me` test module:

```python
async def test_me_includes_subscription_fields(http, client):
    # seed a user with subscription fields, GET /users/me, assert presence
    from app.domain.entities.user import User
    from app.infrastructure.repositories.firestore_user_repository import (
        FirestoreUserRepository,
    )
    u = User(uid="me-sub", email="me@example.com", name="Me")
    u.update_subscription(
        customer_id="cus_me", subscription_id="sub_me", status="active"
    )
    await FirestoreUserRepository(client).save(u)
    # ... call GET /api/v1/users/me as that user (mirror the existing
    # /users/me test's auth-override + client pattern in this file) ...
    body = resp.json()
    assert body["subscription_status"] == "active"
    assert body["stripe_subscription_id"] == "sub_me"
    assert body["subscription_cancel_at_period_end"] is False
    assert "current_period_end" in body
```

> Mirror the exact auth-override + emulator-bound repo dependency pattern already used by the existing `/users/me` test in this file (4c-1 added `quota_summary` tests there — copy that harness).

- [ ] **Step 2: Run — expect failure**

Run: `cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uv run pytest tests/api/ -v -k "me_includes_subscription"`
Expected: FAIL — keys absent from response.

- [ ] **Step 3: Extend `UserResponse`**

Edit `backend/app/api/schemas/user.py` `UserResponse` — add fields (keep existing `quota_summary` from 4c-1):

```python
    stripe_subscription_id: str | None = None
    subscription_status: str | None = None
    subscription_cancel_at_period_end: bool = False
    current_period_end: datetime | None = None
```

(Ensure `datetime` is imported in that file — it is, from 4c-1.)

- [ ] **Step 4: Fill in endpoint**

Edit `backend/app/api/endpoints/users.py` `_user_to_response` — add to the `UserResponse(...)` construction:

```python
        stripe_subscription_id=user.stripe_subscription_id,
        subscription_status=user.subscription_status,
        subscription_cancel_at_period_end=user.subscription_cancel_at_period_end,
        current_period_end=user.current_period_end,
```

- [ ] **Step 5: Run — expect pass**

Run: `cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uv run pytest tests/api/ -v -k "users or me"`
Expected: green.

- [ ] **Step 6: Ruff + mypy + commit**

```bash
cd backend && uv run ruff check app/api/schemas/user.py app/api/endpoints/users.py && uv run mypy app/api
git add backend/app/api/schemas/user.py backend/app/api/endpoints/users.py backend/tests/
git commit -m "feat(users): /me exposes subscription status fields"
```

---

## Task 12: Full verification + PR

- [ ] **Step 1: Full backend suite**

Run: `cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 uv run pytest -q`
Expected: all new green. Only known pre-existing failure that may remain: `tests/infrastructure/repositories/test_firestore_user_repository.py::TestPhoneRoundTrip::test_phone_is_persisted` (phone E.164, reproducible on origin/main, unrelated). Any other failure → fix before pushing.

- [ ] **Step 2: Lint + types**

Run: `cd backend && uv run ruff check . && uv run mypy app/domain app/services app/api`
Expected: clean.

- [ ] **Step 3: Push + PR**

```bash
git push -u origin <branch>
gh pr create --title "feat(stripe): backend StripeService + webhook + billing endpoints (4c-2)" --body "$(cat <<'EOF'
## Summary
sub-project 4c-2: Stripe Checkout サブスク + webhook 駆動 quota 付与 (4c-1 の MonthlyQuota.save 経由)、解約/プラン変更は Customer Portal。Frontend は 4c-3。

## Highlights
- 公式 stripe lib (sync) を asyncio.to_thread でラップ
- invoice.paid が唯一の grant 経路 (全 billing_reason フル grant)。grant + processed_event を単一 Firestore txn → 並行配信でも exactly-once
- network I/O (Subscription.retrieve) は txn 開始前に完了 (contention 最小)
- checkout.session.completed は save→claim 順 (stripe_customer_id lost-write 防止)
- ProcessedEventRepository.claim = Firestore create-if-absent
- EmailService.send_payment_failed、User subscription フィールド、/users/me 拡張

## Test plan
- [x] backend pytest (emulator): StripeService 全 handler / ProcessedEvent / billing endpoints / users — green。既知 phone test 失敗のみ無関係
- [x] ruff + mypy clean
- [ ] **本番投入 (ops, 親 spec 手順)**: Stripe Dashboard で Product/Price/Tax/Portal/Webhook 設定 (test mode 先行) → HCP に STRIPE_* secret 投入 → deploy → webhook secret 投入 → 本番 key 切替

## Depends on
4c-1 (PR #15, merged). 全 additive (User 新フィールドはデフォルト値、MonthlyQuota 無変更)。

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

(Do NOT merge — PR creation only per project rule.)

---

## Spec Coverage Self-Check

| Spec requirement | Task |
|---|---|
| `stripe~=9` dep + Settings | 1 |
| `User` +5 fields + update/clear_subscription | 2 |
| `EmailService.send_payment_failed` (Protocol+SMTP+Mock) | 3 |
| `ProcessedEventRepository.claim` (.create create-if-absent) | 4 |
| `StripeService` checkout/portal (to_thread, automatic_tax, metadata) | 5 |
| webhook signature verify + `_resolve_uid_plan` (network pre-txn) | 6 |
| `checkout.session.completed` save→claim (NEW-5) | 7 |
| `invoice.paid` atomic single-txn exactly-once, sole grant, all billing_reason (C1, Y, I-3) | 8 |
| `subscription.updated` plan-only no grant + tz-aware current_period_end (I-4) | 9 |
| `subscription.deleted` clear, `payment_failed` past_due+email | 9 |
| billing endpoints + 400/200 + CORS-exempt webhook | 10 |
| `get_stripe_service` DI + repositories.py imports (NEW-3) | 10 |
| `/users/me` subscription fields | 11 |
| stripe.SignatureVerificationError + api_version pin (I-1, I-2) | 5, 6 |
| final verify, PR-only | 12 |
