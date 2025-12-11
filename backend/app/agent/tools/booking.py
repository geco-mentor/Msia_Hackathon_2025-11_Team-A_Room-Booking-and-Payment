"""Agent tools for creating and managing bookings."""
import json
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID
from langchain_core.tools import tool

from app.services.supabase import get_supabase_service
from app.config import get_settings

settings = get_settings()


def parse_datetime(date_str: str, time_str: str) -> datetime:
    """Parse date and time strings into datetime."""
    # Parse date
    date_formats = ["%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"]
    booking_date = None

    lower = date_str.lower()
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

    if lower == "today":
        booking_date = today
    elif lower == "tomorrow":
        booking_date = today + timedelta(days=1)
    else:
        for fmt in date_formats:
            try:
                booking_date = datetime.strptime(date_str, fmt)
                break
            except ValueError:
                continue

    if not booking_date:
        raise ValueError(f"Could not parse date: {date_str}")

    # Parse time
    time_str = time_str.strip().upper()
    if ":" in time_str:
        parts = time_str.replace("AM", "").replace("PM", "").strip().split(":")
        hour = int(parts[0])
        minute = int(parts[1]) if len(parts) > 1 else 0
        if "PM" in time_str and hour < 12:
            hour += 12
        elif "AM" in time_str and hour == 12:
            hour = 0
    else:
        time_clean = time_str.replace("AM", "").replace("PM", "").strip()
        hour = int(time_clean)
        minute = 0
        if "PM" in time_str and hour < 12:
            hour += 12
        elif "AM" in time_str and hour == 12:
            hour = 0

    return booking_date.replace(hour=hour, minute=minute)


@tool
async def create_booking(
    user_id: str,
    space_id: str,
    date: str,
    start_time: str,
    end_time: str,
    duration_type: str = "hourly",
    attendees_count: int = 1,
    notes: Optional[str] = None
) -> str:
    """
    Create a new booking for a space. The booking will be in 'pending' status until payment is completed.

    Args:
        user_id: The UUID of the user making the booking
        space_id: The UUID of the space to book
        date: The date of the booking (YYYY-MM-DD or 'today', 'tomorrow')
        start_time: Start time (e.g., '2pm', '14:00', '2:00 PM')
        end_time: End time (e.g., '4pm', '16:00', '4:00 PM')
        duration_type: Type of booking - 'hourly', 'daily', or 'monthly'
        attendees_count: Number of people who will use the space
        notes: Optional notes for the booking

    Returns:
        JSON string with booking details including booking ID and total amount.
    """
    supabase = get_supabase_service()

    # Validate UUID inputs early so we don't send bad values to the DB
    try:
        UUID(space_id)
    except Exception:
        return json.dumps({
            "error": "Invalid space_id format; expected a UUID.",
            "hint": "Use the space id from availability results (e.g., 123e4567-e89b-12d3-a456-426614174000).",
            "received": space_id
        })

    try:
        UUID(user_id)
    except Exception:
        return json.dumps({
            "error": "Invalid user_id format; expected a UUID.",
            "received": user_id
        })

    # Parse datetimes
    try:
        start_datetime = parse_datetime(date, start_time)
        end_datetime = parse_datetime(date, end_time)
    except ValueError as e:
        return json.dumps({"error": str(e)})

    # Validate that booking is not in the past
    now = datetime.now()
    if start_datetime < now:
        return json.dumps({
            "error": "Cannot book in the past",
            "requested_time": start_datetime.strftime("%B %d, %Y at %I:%M %p"),
            "current_time": now.strftime("%B %d, %Y at %I:%M %p"),
            "suggestion": "Please choose a date and time in the future. Use 'today' or 'tomorrow' for quick booking."
        })

    # Validate times
    if end_datetime <= start_datetime:
        return json.dumps({
            "error": "End time must be after start time",
            "start": start_datetime.isoformat(),
            "end": end_datetime.isoformat()
        })

    # Get space details for pricing
    space = await supabase.get_space_by_id(space_id)
    if not space:
        return json.dumps({
            "error": f"Space not found: {space_id}",
            "hint": "Use the space id returned from the availability check."
        })

    # Check availability
    is_available = await supabase.check_space_availability(
        space_id, start_datetime, end_datetime
    )
    if not is_available:
        return json.dumps({
            "error": "Space is not available for the requested time slot",
            "space": space["name"],
            "requested_time": {
                "start": start_datetime.strftime("%Y-%m-%d %I:%M %p"),
                "end": end_datetime.strftime("%Y-%m-%d %I:%M %p")
            },
            "suggestion": "Please try a different time or choose another space."
        })

    # Calculate total amount
    duration_hours = (end_datetime - start_datetime).total_seconds() / 3600

    if duration_type == "hourly" and space.get("hourly_rate"):
        total_amount = float(space["hourly_rate"]) * duration_hours
    elif duration_type == "daily" and space.get("daily_rate"):
        total_amount = float(space["daily_rate"])
    elif duration_type == "monthly" and space.get("monthly_rate"):
        total_amount = float(space["monthly_rate"])
    else:
        # Default to hourly calculation
        if space.get("hourly_rate"):
            total_amount = float(space["hourly_rate"]) * duration_hours
        elif space.get("daily_rate"):
            total_amount = float(space["daily_rate"])
        else:
            return json.dumps({
                "error": "Could not determine pricing for this space and duration type",
                "space": space["name"],
                "duration_type": duration_type
            })

    # Create the booking
    try:
        booking = await supabase.create_booking(
            user_id=user_id,
            space_id=space_id,
            start_time=start_datetime,
            end_time=end_datetime,
            duration_type=duration_type,
            total_amount=total_amount,
            attendees_count=attendees_count,
            notes=notes
        )
    except Exception as exc:
        # Surface Supabase errors clearly to aid debugging (e.g., RLS/permission issues)
        return json.dumps({
            "error": "Failed to create booking",
            "details": str(exc),
            "hint": "Ensure SUPABASE_SERVICE_KEY is a service_role key and RLS allows inserts into bookings."
        })

    if not booking:
        return json.dumps({"error": "Failed to create booking"})

    payment_link = None
    payment_error = None
    payment_metadata = None

    def _create_payment_link_sync():
        """Create the Stripe price + payment link synchronously (run in a thread)."""
        import stripe  # type: ignore

        stripe.api_key = settings.STRIPE_SECRET_KEY
        amount_cents = int(round(total_amount * 100))

        price = stripe.Price.create(
            currency="myr",
            unit_amount=amount_cents,
            product_data={
                "name": f"{space['name']} booking"
            },
            metadata={
                "space_id": space_id,
                "booking_id": booking["id"]
            }
        )

        link = stripe.PaymentLink.create(
            line_items=[{"price": price.id, "quantity": 1}],
            metadata={
                "booking_id": booking["id"],
                "user_id": user_id
            },
            payment_intent_data={
                # Ensure the webhook receives booking/user context
                "metadata": {
                    "booking_id": booking["id"],
                    "user_id": user_id,
                    "space_id": space_id,
                }
            },
            after_completion={
                "type": "redirect",
                "redirect": {
                    # Return with a success hint for the UI to show the assistant state
                    "url": f"{settings.FRONTEND_URL}/?payment_status=success&booking_id={booking['id']}"
                }
            }
        )

        return price, link

    # Create a Stripe payment link in a background thread with a hard timeout to avoid hanging the agent
    if settings.STRIPE_SECRET_KEY:
        try:
            import asyncio
            import stripe  # type: ignore

            async def _run_with_timeout():
                return await asyncio.wait_for(
                    asyncio.to_thread(_create_payment_link_sync),
                    timeout=12  # seconds
                )

            price, link = await _run_with_timeout()

            payment_link = link.url
            payment_metadata = {
                "payment_link_id": link.id,
                "price_id": price.id,
                "product_id": price.product,
                "amount_cents": int(round(total_amount * 100)),
                "currency": "myr"
            }

            # Record the pending payment in Supabase (best-effort, non-blocking)
            try:
                await supabase.create_payment_record(
                    user_id=user_id,
                    booking_id=booking["id"],
                    amount=total_amount,
                    payment_status="pending",
                    payment_provider="stripe",
                    transaction_id=link.id
                )
            except Exception as exc:
                print(f"Warning: Failed to create payment record: {exc}")

        except Exception as exc:
            payment_error = f"Failed to create payment link: {exc}"
            print(f"Warning: {payment_error}")

    response_payload = {
        "success": True,
        "booking": {
            "id": booking["id"],
            "space_name": space["name"],
            "space_type": space["type"],
            "location": space["location"],
            "date": start_datetime.strftime("%B %d, %Y"),
            "start_time": start_datetime.strftime("%I:%M %p"),
            "end_time": end_datetime.strftime("%I:%M %p"),
            "duration_hours": duration_hours,
            "attendees": attendees_count,
            "total_amount": total_amount,
            "currency": "MYR",
            "status": "pending"
        },
        "message": "Booking created successfully. Please complete payment to confirm.",
        "next_step": "payment_required",
        "payment_link": payment_link,
        "payment_provider": "stripe" if payment_link else None,
        "payment_details": payment_metadata
    }

    if payment_error:
        response_payload["payment_error"] = payment_error
        response_payload["message"] = (
            "Booking created successfully, but payment link could not be generated automatically. "
            "Please contact support or try again."
        )

    return json.dumps(response_payload, indent=2)


@tool
async def get_user_bookings(
    user_id: str,
    status: Optional[str] = None,
    upcoming_only: bool = True
) -> str:
    """
    Get a user's bookings.

    Args:
        user_id: The UUID of the user
        status: Filter by status - 'pending', 'confirmed', 'cancelled', or 'completed'.
               Leave empty to get all statuses.
        upcoming_only: If True (default), only return future bookings.

    Returns:
        JSON string with list of user's bookings including space details.
    """
    supabase = get_supabase_service()

    bookings = await supabase.get_user_bookings(
        user_id=user_id,
        status=status,
        upcoming_only=upcoming_only
    )

    if not bookings:
        return json.dumps({
            "message": "No bookings found.",
            "bookings": []
        })

    formatted_bookings = []
    for booking in bookings:
        space = booking.get("spaces", {})
        start = datetime.fromisoformat(booking["start_time"].replace("Z", "+00:00"))
        end = datetime.fromisoformat(booking["end_time"].replace("Z", "+00:00"))

        formatted_bookings.append({
            "id": booking["id"],
            "space_name": space.get("name", "Unknown"),
            "space_type": space.get("type", "Unknown"),
            "location": space.get("location", "Unknown"),
            "date": start.strftime("%B %d, %Y"),
            "start_time": start.strftime("%I:%M %p"),
            "end_time": end.strftime("%I:%M %p"),
            "status": booking["status"],
            "total_amount": f"RM{booking['total_amount']:.2f}",
            "attendees": booking["attendees_count"]
        })

    return json.dumps({
        "total": len(formatted_bookings),
        "bookings": formatted_bookings
    }, indent=2)


@tool
async def cancel_booking(
    booking_id: str,
    user_id: str
) -> str:
    """
    Cancel a booking. Only the user who created the booking can cancel it.

    Args:
        booking_id: The UUID of the booking to cancel
        user_id: The UUID of the user (for authorization)

    Returns:
        JSON string with cancellation confirmation or error message.
    """
    supabase = get_supabase_service()

    # Get booking details first
    booking = await supabase.get_booking_by_id(booking_id)
    if not booking:
        return json.dumps({
            "success": False,
            "error": f"Booking not found: {booking_id}"
        })

    # Check if booking belongs to user
    if booking["user_id"] != user_id:
        return json.dumps({
            "success": False,
            "error": "You can only cancel your own bookings."
        })

    # Check if booking can be cancelled
    if booking["status"] == "cancelled":
        return json.dumps({
            "success": False,
            "error": "This booking is already cancelled."
        })

    if booking["status"] == "completed":
        return json.dumps({
            "success": False,
            "error": "Cannot cancel a completed booking."
        })

    # Cancel the booking
    success = await supabase.cancel_booking(booking_id, user_id)

    if success:
        space = booking.get("spaces", {})
        start = datetime.fromisoformat(booking["start_time"].replace("Z", "+00:00"))

        return json.dumps({
            "success": True,
            "message": "Booking cancelled successfully.",
            "cancelled_booking": {
                "id": booking_id,
                "space": space.get("name", "Unknown"),
                "date": start.strftime("%B %d, %Y"),
                "time": start.strftime("%I:%M %p")
            },
            "note": "If you made a payment, a refund will be processed within 5-7 business days."
        })
    else:
        return json.dumps({
            "success": False,
            "error": "Failed to cancel booking. Please try again or contact support."
        })
