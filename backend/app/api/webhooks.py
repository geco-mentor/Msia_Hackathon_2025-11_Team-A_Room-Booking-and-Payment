"""Stripe webhook handlers."""
import asyncio
from datetime import datetime
from fastapi import APIRouter, Request, HTTPException, Header

from app.config import get_settings
from app.services.notifications import send_booking_confirmation_email
from app.services.supabase import get_supabase_service

router = APIRouter(tags=["webhooks"])
settings = get_settings()

# Initialize Stripe if available
try:
    import stripe  # type: ignore

    stripe.api_key = settings.STRIPE_SECRET_KEY
    STRIPE_AVAILABLE = True
except ImportError:
    stripe = None  # type: ignore
    STRIPE_AVAILABLE = False
    print("Warning: stripe not installed. Stripe webhooks are disabled.")


@router.post("/webhooks/stripe")
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(None, alias="Stripe-Signature")
):
    """
    Handle Stripe webhook events.

    Events handled:
    - checkout.session.completed: Payment successful, confirm booking
    - payment_intent.succeeded: Payment confirmed
    - payment_intent.failed: Payment failed
    """
    if not STRIPE_AVAILABLE:
        raise HTTPException(status_code=503, detail="Stripe integration not available")

    if not stripe_signature:
        raise HTTPException(status_code=400, detail="Missing Stripe signature")

    # Get raw body
    payload = await request.body()

    # Verify webhook signature
    try:
        event = stripe.Webhook.construct_event(
            payload,
            stripe_signature,
            settings.STRIPE_WEBHOOK_SECRET
        )
    except ValueError as e:
        print(f"Invalid payload: {e}")
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError as e:
        print(f"Invalid signature: {e}")
        raise HTTPException(status_code=400, detail="Invalid signature")

    # Handle the event
    event_type = event["type"]
    event_data = event["data"]["object"]

    print(f"Received Stripe event: {event_type}")

    supabase = get_supabase_service()

    if event_type == "checkout.session.completed":
        # Payment was successful via Checkout/Payment Link
        session = event_data
        booking_id = session.get("metadata", {}).get("booking_id")
        customer_email = session.get("customer_email")
        payment_intent_id = session.get("payment_intent")
        amount_total = session.get("amount_total", 0) / 100  # Convert from cents

        # Payment Link sessions may not carry metadata on the session; fall back to the payment intent
        if not booking_id and payment_intent_id:
            try:
                pi = stripe.PaymentIntent.retrieve(payment_intent_id)
                booking_id = pi.get("metadata", {}).get("booking_id")
            except Exception as e:
                print(f"Error retrieving payment intent {payment_intent_id}: {e}")

        if booking_id:
            try:
                # Update booking status to confirmed
                await supabase.update_booking_status(booking_id, "confirmed")

                # Update payment record
                await supabase.update_payment_status(
                    booking_id=booking_id,
                    payment_status="completed",
                    transaction_id=payment_intent_id,
                    paid_at=datetime.now()
                )

                print(f"Booking {booking_id} confirmed after payment")

                # Fire-and-forget: email confirmation with PDF receipt
                asyncio.create_task(
                    send_booking_confirmation_email(
                        booking_id=booking_id,
                        fallback_email=customer_email
                    )
                )

            except Exception as e:
                print(f"Error updating booking {booking_id}: {e}")
                # Don't raise - we don't want Stripe to retry for our internal errors

        return {"status": "success", "booking_id": booking_id}

    elif event_type == "payment_intent.succeeded":
        # Additional confirmation
        payment_intent = event_data
        booking_id = payment_intent.get("metadata", {}).get("booking_id")

        if booking_id:
            try:
                await supabase.update_booking_status(booking_id, "confirmed")
                print(f"Booking {booking_id} confirmed via payment_intent.succeeded")
            except Exception as e:
                print(f"Error updating booking: {e}")

        return {"status": "success"}

    elif event_type == "payment_intent.payment_failed":
        # Payment failed
        payment_intent = event_data
        booking_id = payment_intent.get("metadata", {}).get("booking_id")
        failure_message = payment_intent.get("last_payment_error", {}).get("message", "Unknown error")

        if booking_id:
            try:
                # Keep booking as pending, update payment record
                await supabase.update_payment_status(
                    booking_id=booking_id,
                    payment_status="failed"
                )
                print(f"Payment failed for booking {booking_id}: {failure_message}")
            except Exception as e:
                print(f"Error updating payment status: {e}")

        return {"status": "failed", "message": failure_message}

    elif event_type == "customer.created":
        # New Stripe customer created
        customer = event_data
        customer_id = customer.get("id")
        customer_email = customer.get("email")

        # We might want to link this to a user profile
        print(f"New Stripe customer created: {customer_id} ({customer_email})")

        return {"status": "success", "customer_id": customer_id}

    else:
        # Unhandled event type
        print(f"Unhandled event type: {event_type}")
        return {"status": "ignored", "event_type": event_type}


@router.get("/webhooks/stripe/test")
async def test_webhook():
    """Test endpoint for webhook configuration."""
    if not STRIPE_AVAILABLE:
        return {
            "status": "disabled",
            "message": "Stripe SDK not installed. Webhook handling is disabled."
        }

    return {
        "status": "ready",
        "message": "Stripe webhook endpoint is configured",
        "events_handled": [
            "checkout.session.completed",
            "payment_intent.succeeded",
            "payment_intent.payment_failed",
            "customer.created"
        ]
    }
