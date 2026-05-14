"""Plan enum — monthly coma quota tier."""

from __future__ import annotations

from enum import Enum


class Plan(str, Enum):
    LIGHT = "light"
    STANDARD = "standard"
    INTENSIVE = "intensive"


PLAN_QUOTA: dict[Plan, int] = {
    Plan.LIGHT: 4,
    Plan.STANDARD: 8,
    Plan.INTENSIVE: 16,
}
