"""Unit tests for generate_daily_slots — Firestore client is mocked."""

from __future__ import annotations

from datetime import datetime, timedelta

from main import JST, build_target_slots


def test_build_target_slots_emits_14_slots_for_a_day() -> None:
    target = datetime(2026, 6, 15, tzinfo=JST).date()
    slots = build_target_slots(target)
    assert len(slots) == 14  # 9:00, 9:30, ... 15:30


def test_build_target_slots_first_slot_is_09_00_jst() -> None:
    target = datetime(2026, 6, 15, tzinfo=JST).date()
    slots = build_target_slots(target)
    first = slots[0]
    assert first["start_at"].hour == 9
    assert first["start_at"].minute == 0
    assert first["start_at"].tzinfo == JST


def test_build_target_slots_last_slot_is_15_30_jst() -> None:
    target = datetime(2026, 6, 15, tzinfo=JST).date()
    slots = build_target_slots(target)
    last = slots[-1]
    assert last["start_at"].hour == 15
    assert last["start_at"].minute == 30


def test_build_target_slots_each_slot_is_30_min() -> None:
    target = datetime(2026, 6, 15, tzinfo=JST).date()
    for slot in build_target_slots(target):
        assert slot["end_at"] - slot["start_at"] == timedelta(minutes=30)


def test_build_target_slots_defaults() -> None:
    target = datetime(2026, 6, 15, tzinfo=JST).date()
    slot = build_target_slots(target)[0]
    assert slot["lesson_type"] == "private"
    assert slot["capacity"] == 1
    assert slot["booked_count"] == 0
    assert slot["price_yen"] is None
    assert slot["teacher_id"] is None
    assert slot["notes"] is None
    assert slot["status"] == "open"
