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
    url = await service.create_checkout_session(user=user, plan=Plan(payload.plan))
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
