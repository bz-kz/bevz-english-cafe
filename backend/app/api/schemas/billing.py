"""Pydantic models for billing endpoints."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class CheckoutRequest(BaseModel):
    plan: Literal["light", "standard", "intensive"]


class SessionUrlResponse(BaseModel):
    url: str
