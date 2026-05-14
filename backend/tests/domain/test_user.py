"""Unit tests for the User domain entity."""

from __future__ import annotations

from datetime import datetime

import pytest

from app.domain.entities.user import User
from app.domain.value_objects.phone import Phone


class TestUserConstruction:
    def test_minimal_user_has_required_fields(self) -> None:
        user = User(uid="abc123", email="a@b.com", name="Alice")
        assert user.uid == "abc123"
        assert user.email == "a@b.com"
        assert user.name == "Alice"
        assert user.phone is None
        assert isinstance(user.created_at, datetime)
        assert isinstance(user.updated_at, datetime)

    def test_phone_value_object_is_preserved(self) -> None:
        user = User(
            uid="u", email="a@b.com", name="Alice", phone=Phone("+819012345678")
        )
        assert user.phone is not None
        # Phone normalizes +81... → 0... (Japanese domestic format)
        assert user.phone.value == "09012345678"

    def test_empty_name_is_rejected(self) -> None:
        with pytest.raises(ValueError):
            User(uid="u", email="a@b.com", name="")


class TestUserUpdate:
    def test_update_changes_fields_and_bumps_updated_at(self) -> None:
        user = User(uid="u", email="a@b.com", name="Alice")
        original_updated = user.updated_at
        import time

        time.sleep(0.001)
        user.update(name="Alicia", phone=Phone("+819011112222"))
        assert user.name == "Alicia"
        assert user.phone is not None
        assert user.phone.value == "09011112222"
        assert user.updated_at > original_updated

    def test_update_with_no_args_is_noop(self) -> None:
        user = User(uid="u", email="a@b.com", name="Alice")
        original_updated = user.updated_at
        user.update()
        assert user.updated_at == original_updated


def test_user_default_plan_is_none():
    u = User(uid="u1", email="a@b.c", name="x")
    assert u.plan is None
    assert u.plan_started_at is None
    assert u.trial_used is False


def test_user_can_be_assigned_a_plan():
    from app.domain.enums.plan import Plan

    u = User(uid="u1", email="a@b.c", name="x")
    u.set_plan(Plan.STANDARD)
    assert u.plan == Plan.STANDARD
    assert u.plan_started_at is not None


def test_user_set_plan_to_none_clears_started_at():
    from app.domain.enums.plan import Plan

    u = User(uid="u1", email="a@b.c", name="x")
    u.set_plan(Plan.LIGHT)
    u.set_plan(None)
    assert u.plan is None
    assert u.plan_started_at is None
