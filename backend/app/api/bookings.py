"""Booking-related API endpoints."""
import asyncio
from datetime import datetime
from fastapi import APIRouter, HTTPException

from app.config import get_settings
from app.services.supabase import get_supabase_service
from app.services.notifications import send_booking_confirmation_email

settings = get_settings()
router = APIRouter(tags=["bookings"])

# Stripe availability flag
try:
    import stripe  # type: ignore

    stripe.api_key = settings.STRIPE_SECRET_KEY
    STRIPE_AVAILABLE = True
except Exception:
    stripe = None  # type: ignore
    STRIPE_AVAILABLE = False


@router.get("/bookings/{booking_id}")
async def get_booking(booking_id: str):
    """Fetch a single booking by ID."""
    supabase = get_supabase_service()
    booking = await supabase.get_booking_by_id(booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return {"booking": booking}


@router.post("/bookings/{booking_id}/reconcile")
async def reconcile_booking_payment(booking_id: str):
    """
    Fallback reconciliation to confirm a booking if a webhook was missed.
    Searches Stripe PaymentIntents by metadata.booking_id and, if succeeded, marks booking as confirmed.
    """
    supabase = get_supabase_service()

    booking = await supabase.get_booking_by_id(booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.get("status") == "confirmed":
        return {"status": "confirmed", "booking": booking}

    if not STRIPE_AVAILABLE:
        raise HTTPException(status_code=503, detail="Stripe SDK not available for reconciliation")

    # First try to reconcile via the Payment Link the booking used (most reliable for Payment Links)
    payment_record = await supabase.get_payment_by_booking(booking_id)
    payment_link_id = payment_record.get("transaction_id") if payment_record else None
    payment_intent_id = None

    if payment_link_id:
        try:
            sessions = stripe.checkout.Session.list(
                payment_link=payment_link_id,
                limit=5,
            )
            paid_session = next(
                (
                    session
                    for session in sessions.data
                    if getattr(session, "payment_status", "") == "paid"
                    and session.payment_intent
                ),
                None,
            )
            if paid_session:
                payment_intent_id = paid_session.payment_intent
        except Exception as exc:
            print(f"Stripe checkout session lookup failed for booking {booking_id}: {exc}")

    confirmed_intent = None

    # If we already have the PaymentIntent id from a paid session, fetch it to verify status
    if payment_intent_id:
        try:
            confirmed_intent = stripe.PaymentIntent.retrieve(payment_intent_id)
        except Exception as exc:
            print(f"Failed to retrieve payment intent {payment_intent_id} for booking {booking_id}: {exc}")

    # Fallback: search by metadata (older payments or if payment link lookup failed)
    if not confirmed_intent:
        try:
            results = stripe.PaymentIntent.search(
                query=f"metadata['booking_id']:'{booking_id}'",
                limit=5,
            )
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Stripe search failed: {e}")

        confirmed_intent = next((pi for pi in results.data if pi.status == "succeeded"), None)

    if not confirmed_intent:
        return {"status": "pending", "message": "No successful payment found yet for this booking."}

    # Update booking and payment record
    try:
        await supabase.update_booking_status(booking_id, "confirmed")
        await supabase.update_payment_status(
            booking_id=booking_id,
            payment_status="completed",
            transaction_id=confirmed_intent.id,
            paid_at=datetime.now(),
        )
        booking = await supabase.get_booking_by_id(booking_id)

        # Fire-and-forget email confirmation in case webhook was missed.
        # Try to pass an email extracted from the PaymentIntent if we have one.
        fallback_email = (
            getattr(confirmed_intent, "receipt_email", None)
            or getattr(getattr(confirmed_intent, "charges", None), "data", [{}])[0]
            .get("billing_details", {})
            .get("email")
        )
        asyncio.create_task(
            send_booking_confirmation_email(
                booking_id=booking_id,
                fallback_email=fallback_email,
            )
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update booking/payment: {e}")

    return {
        "status": "confirmed",
        "booking": booking,
        "payment_intent_id": confirmed_intent.id,
    }
