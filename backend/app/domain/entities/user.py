"""User domain entity."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime

from app.domain.enums.plan import Plan
from app.domain.value_objects.phone import Phone


def _utc_now() -> datetime:
    return datetime.now(UTC)


@dataclass
class User:
    uid: str
    email: str
    name: str
    phone: Phone | None = None
    plan: Plan | None = None
    plan_started_at: datetime | None = None
    trial_used: bool = False
    # is_admin は Firebase Auth の custom claim から hydrate される runtime 値。
    # Firestore には永続化しない (auth.py の get_current_user 参照)。
    is_admin: bool = False
    created_at: datetime = field(default_factory=_utc_now)
    updated_at: datetime = field(default_factory=_utc_now)
    stripe_customer_id: str | None = None
    stripe_subscription_id: str | None = None
    subscription_status: str | None = None
    subscription_cancel_at_period_end: bool = False
    current_period_end: datetime | None = None

    def __post_init__(self) -> None:
        if not self.uid:
            raise ValueError("uid is required")
        if not self.email:
            raise ValueError("email is required")
        if not self.name.strip():
            raise ValueError("name must be non-empty")

    def update(self, *, name: str | None = None, phone: Phone | None = None) -> None:
        """編集可能フィールドを更新する。None は「変更なし」を意味する。"""
        changed = False
        if name is not None and name != self.name:
            if not name.strip():
                raise ValueError("name must be non-empty")
            self.name = name
            changed = True
        if phone is not None and (
            self.phone is None or phone.value != self.phone.value
        ):
            self.phone = phone
            changed = True
        if changed:
            self.updated_at = _utc_now()

    def set_plan(self, plan: Plan | None) -> None:
        self.plan = plan
        self.plan_started_at = _utc_now() if plan is not None else None
        self.updated_at = _utc_now()

    def mark_trial_used(self) -> None:
        if self.trial_used:
            return
        self.trial_used = True
        self.updated_at = _utc_now()

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
