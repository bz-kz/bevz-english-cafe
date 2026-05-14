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
