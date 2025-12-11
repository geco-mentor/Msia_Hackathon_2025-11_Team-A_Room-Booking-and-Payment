"""Agent tools for user profile and membership operations."""
import json
from typing import Optional
from langchain_core.tools import tool

from app.services.supabase import get_supabase_service


@tool
async def get_user_profile(user_id: str) -> str:
    """
    Get user profile information including membership status.

    Args:
        user_id: The UUID of the user

    Returns:
        JSON string with user profile, active membership, and Stripe customer status.
    """
    supabase = get_supabase_service()

    # Get profile
    profile = await supabase.get_user_profile(user_id)
    if not profile:
        return json.dumps({
            "error": "User profile not found",
            "user_id": user_id
        })

    # Get active membership
    membership = await supabase.get_active_membership(user_id)

    response = {
        "user_id": user_id,
        "full_name": profile.get("full_name", ""),
        "email": profile.get("email", ""),
        "phone": profile.get("phone", ""),
        "company": profile.get("company", ""),
        "has_stripe_customer": bool(profile.get("stripe_customer_id")),
        "stripe_customer_id": profile.get("stripe_customer_id"),
    }

    if membership:
        response["membership"] = {
            "plan_type": membership["plan_type"],
            "status": membership["status"],
            "start_date": membership["start_date"],
            "end_date": membership["end_date"],
            "meeting_room_hours_included": membership.get("meeting_room_hours_included", 0),
            "meeting_room_hours_used": membership.get("meeting_room_hours_used", 0),
            "meeting_room_hours_remaining": (
                membership.get("meeting_room_hours_included", 0) -
                membership.get("meeting_room_hours_used", 0)
            )
        }
    else:
        response["membership"] = None
        response["membership_message"] = "No active membership. Consider getting a membership plan for better rates!"

    return json.dumps(response, indent=2)


@tool
async def check_user_payment_setup(user_id: str) -> str:
    """
    Check if a user has their Stripe payment method set up.

    Args:
        user_id: The UUID of the user

    Returns:
        JSON string indicating if payment is set up and next steps if not.
    """
    supabase = get_supabase_service()

    profile = await supabase.get_user_profile(user_id)
    if not profile:
        return json.dumps({
            "error": "User profile not found",
            "user_id": user_id
        })

    has_stripe = bool(profile.get("stripe_customer_id"))

    if has_stripe:
        return json.dumps({
            "payment_setup": True,
            "message": "Your payment method is set up. You can proceed with bookings."
        })
    else:
        return json.dumps({
            "payment_setup": False,
            "message": "You need to set up your payment method before making bookings.",
            "next_step": "create_stripe_customer",
            "instructions": "I will help you set up your payment method. This is a one-time process."
        })
