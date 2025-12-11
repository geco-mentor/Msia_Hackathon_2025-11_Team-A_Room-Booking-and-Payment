"""Supabase service for database operations."""
import asyncio
from typing import Optional
from datetime import datetime, timedelta
import base64
import json
from supabase import create_client, Client

from app.config import get_settings

settings = get_settings()


class SupabaseService:
    """Service class for Supabase operations."""

    def __init__(self):
        self.client: Client = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_SERVICE_KEY
        )
        self._warn_if_not_service_role()

    def _warn_if_not_service_role(self) -> None:
        """
        Decode the Supabase key payload and warn if it is not a service_role key.
        This helps surface RLS/permission issues early.
        """
        try:
            segments = settings.SUPABASE_SERVICE_KEY.split(".")
            if len(segments) < 2:
                return
            payload_b64 = segments[1] + "=" * (-len(segments[1]) % 4)
            payload = json.loads(base64.urlsafe_b64decode(payload_b64).decode("utf-8"))
            role = payload.get("role")
            if role != "service_role":
                print("Warning: SUPABASE_SERVICE_KEY is not a service_role key. "
                      "Database writes may be blocked by RLS. Replace with the service role key.")
        except Exception:
            # Don't break startup if we cannot decode
            pass

    async def _execute(self, query, max_retries=2):
        """Run blocking Supabase calls in a worker thread with a timeout to avoid agent hangs."""
        for attempt in range(max_retries):
            try:
                return await asyncio.wait_for(
                    asyncio.to_thread(query.execute),
                    timeout=settings.DB_TIMEOUT_SECONDS
                )
            except asyncio.TimeoutError as exc:
                raise TimeoutError("Supabase request timed out") from exc
            except Exception as exc:
                # Retry on connection errors
                if attempt < max_retries - 1 and "RemoteProtocolError" in str(type(exc).__name__):
                    await asyncio.sleep(0.5)  # Brief delay before retry
                    continue
                raise

    # ==================== SPACES ====================

    async def get_spaces(
        self,
        space_type: Optional[str] = None,
        location: Optional[str] = None,
        is_active: bool = True
    ) -> list[dict]:
        """Get spaces with optional filtering."""
        query = self.client.table("spaces").select("*")

        if is_active:
            query = query.eq("is_active", True)
        if space_type:
            query = query.eq("type", space_type)
        if location:
            query = query.ilike("location", f"%{location}%")

        response = await self._execute(query)
        return response.data

    async def get_space_by_id(self, space_id: str) -> Optional[dict]:
        """Get a single space by ID."""
        response = await self._execute(
            self.client.table("spaces")
            .select("*")
            .eq("id", space_id)
            .single()
        )
        return response.data

    # ==================== BOOKINGS ====================

    async def get_bookings_for_space(
        self,
        space_id: str,
        start_date: datetime,
        end_date: datetime
    ) -> list[dict]:
        """Get bookings for a space within a date range."""
        response = await self._execute(
            self.client.table("bookings")
            .select("*")
            .eq("space_id", space_id)
            .neq("status", "cancelled")
            .gte("start_time", start_date.isoformat())
            .lte("end_time", end_date.isoformat())
        )
        return response.data

    async def check_space_availability(
        self,
        space_id: str,
        start_time: datetime,
        end_time: datetime
    ) -> bool:
        """Check if a space is available for the given time slot."""
        # Find any overlapping bookings
        response = await self._execute(
            self.client.table("bookings")
            .select("id")
            .eq("space_id", space_id)
            .neq("status", "cancelled")
            .lt("start_time", end_time.isoformat())
            .gt("end_time", start_time.isoformat())
        )
        return len(response.data) == 0

    async def create_booking(
        self,
        user_id: str,
        space_id: str,
        start_time: datetime,
        end_time: datetime,
        duration_type: str,
        total_amount: float,
        attendees_count: int = 1,
        notes: Optional[str] = None,
        special_requirements: Optional[str] = None
    ) -> dict:
        """Create a new booking."""
        booking_data = {
            "user_id": user_id,
            "space_id": space_id,
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "duration_type": duration_type,
            "status": "pending",
            "total_amount": total_amount,
            "attendees_count": attendees_count,
            "notes": notes,
            "special_requirements": special_requirements
        }
        response = await self._execute(
            self.client.table("bookings")
            .insert(booking_data)
        )
        return response.data[0] if response.data else None

    async def update_booking_status(
        self,
        booking_id: str,
        status: str
    ) -> dict:
        """Update booking status."""
        response = await self._execute(
            self.client.table("bookings")
            .update({"status": status})
            .eq("id", booking_id)
        )
        return response.data[0] if response.data else None

    async def get_user_bookings(
        self,
        user_id: str,
        status: Optional[str] = None,
        upcoming_only: bool = True
    ) -> list[dict]:
        """Get bookings for a user."""
        query = (
            self.client.table("bookings")
            .select("*, spaces(*)")
            .eq("user_id", user_id)
        )

        if status:
            query = query.eq("status", status)

        if upcoming_only:
            query = query.gte("start_time", datetime.now().isoformat())

        query = query.order("start_time", desc=False)
        response = await self._execute(query)
        return response.data

    async def get_booking_by_id(self, booking_id: str) -> Optional[dict]:
        """Get a booking by ID with space details."""
        response = await self._execute(
            self.client.table("bookings")
            .select("*, spaces(*)")
            .eq("id", booking_id)
            .single()
        )
        return response.data

    async def cancel_booking(self, booking_id: str, user_id: str) -> bool:
        """Cancel a booking (only if user owns it)."""
        response = await self._execute(
            self.client.table("bookings")
            .update({"status": "cancelled"})
            .eq("id", booking_id)
            .eq("user_id", user_id)
        )
        return len(response.data) > 0

    # ==================== USERS / PROFILES ====================

    async def get_user_profile(self, user_id: str) -> Optional[dict]:
        """Get user profile."""
        try:
            response = await self._execute(
                self.client.table("profiles")
                .select("*")
                .eq("id", user_id)
                .single()
            )
            return response.data
        except Exception:
            # If no profile exists, return None instead of raising/logging noise
            return None

    async def update_stripe_customer_id(
        self,
        user_id: str,
        stripe_customer_id: str
    ) -> dict:
        """Update user's Stripe customer ID."""
        response = await self._execute(
            self.client.table("profiles")
            .update({"stripe_customer_id": stripe_customer_id})
            .eq("id", user_id)
        )
        return response.data[0] if response.data else None

    # ==================== MEMBERSHIPS ====================

    async def get_active_membership(self, user_id: str) -> Optional[dict]:
        """Get user's active membership."""
        response = await self._execute(
            self.client.table("memberships")
            .select("*")
            .eq("user_id", user_id)
            .eq("status", "active")
            .single()
        )
        return response.data

    # ==================== PAYMENTS ====================

    async def create_payment_record(
        self,
        user_id: str,
        booking_id: str,
        amount: float,
        payment_status: str = "pending",
        payment_provider: str = "stripe",
        transaction_id: Optional[str] = None
    ) -> dict:
        """Create a payment record."""
        payment_data = {
            "user_id": user_id,
            "booking_id": booking_id,
            "amount": amount,
            "currency": "MYR",
            "payment_status": payment_status,
            "payment_provider": payment_provider,
            "transaction_id": transaction_id
        }
        response = await self._execute(
            self.client.table("payments")
            .insert(payment_data)
        )
        return response.data[0] if response.data else None

    async def update_payment_status(
        self,
        booking_id: str,
        payment_status: str,
        transaction_id: Optional[str] = None,
        paid_at: Optional[datetime] = None,
        receipt_url: Optional[str] = None
    ) -> dict:
        """Update payment status for a booking."""
        update_data = {"payment_status": payment_status}
        if transaction_id:
            update_data["transaction_id"] = transaction_id
        if paid_at:
            update_data["paid_at"] = paid_at.isoformat()
        if receipt_url:
            update_data["receipt_url"] = receipt_url

        response = await self._execute(
            self.client.table("payments")
            .update(update_data)
            .eq("booking_id", booking_id)
        )
        return response.data[0] if response.data else None

    async def get_payment_by_booking(
        self,
        booking_id: str
    ) -> Optional[dict]:
        """Get a payment record for a booking."""
        response = await self._execute(
            self.client.table("payments")
            .select("*")
            .eq("booking_id", booking_id)
            .limit(1)
        )
        return response.data[0] if response.data else None


# Singleton instance
_supabase_service: Optional[SupabaseService] = None


def get_supabase_service() -> SupabaseService:
    """Get Supabase service singleton."""
    global _supabase_service
    if _supabase_service is None:
        _supabase_service = SupabaseService()
    return _supabase_service
