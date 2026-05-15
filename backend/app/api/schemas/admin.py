"""Pydantic models for admin endpoints."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ForceBookRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    consume_quota: bool = False
    consume_trial: bool = False


class ForceCancelRequest(BaseModel):
    refund_quota: bool = False
    refund_trial: bool = False


class UserSummaryResponse(BaseModel):
    uid: str
    email: str
    name: str
