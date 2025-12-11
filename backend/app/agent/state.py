"""Agent state definitions for the booking agent."""
from typing import TypedDict, Annotated, Sequence, Optional, Literal
from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages


class BookingContext(TypedDict, total=False):
    """Context for an ongoing booking conversation."""
    space_id: Optional[str]
    space_name: Optional[str]
    space_type: Optional[str]
    location: Optional[str]
    date: Optional[str]
    start_time: Optional[str]
    end_time: Optional[str]
    duration_hours: Optional[float]
    duration_type: Optional[str]
    attendees_count: Optional[int]
    total_amount: Optional[float]
    notes: Optional[str]


class PaymentContext(TypedDict, total=False):
    """Context for payment processing."""
    booking_id: Optional[str]
    payment_link: Optional[str]
    stripe_customer_id: Optional[str]
    product_id: Optional[str]
    price_id: Optional[str]


class VirtualTourContext(TypedDict, total=False):
    """Context for virtual tour."""
    url: str
    full_url: Optional[str]
    space_name: str


class AgentState(TypedDict):
    """State schema for the booking agent."""
    # Conversation messages
    messages: Annotated[Sequence[BaseMessage], add_messages]

    # User context
    user_id: str
    user_name: Optional[str]
    user_email: Optional[str]

    # Booking flow context
    booking_context: Optional[BookingContext]
    payment_context: Optional[PaymentContext]

    # Session info
    conversation_id: str
    language: str

    # Control flow
    current_intent: Optional[str]
    awaiting_confirmation: bool
    requires_payment: bool

    # Response
    response: Optional[str]
    payment_link: Optional[str]
    virtual_tour: Optional[VirtualTourContext]


# Intent types
IntentType = Literal[
    "greeting",
    "inquiry",
    "check_availability",
    "virtual_tour",
    "create_booking",
    "confirm_booking",
    "view_bookings",
    "cancel_booking",
    "payment",
    "help",
    "unknown"
]
