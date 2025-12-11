"""Chat API endpoint for the booking agent."""
from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from app.agent.graph import run_booking_agent
from app.services.supabase import get_supabase_service

router = APIRouter(tags=["chat"])


class ChatRequest(BaseModel):
    """Request body for chat endpoint."""
    message: str
    conversation_id: Optional[str] = None
    user_id: str  # Required - user must be authenticated
    language: Optional[str] = "english"
    history: Optional[list] = None


class VirtualTour(BaseModel):
    """Virtual tour information."""
    url: str
    full_url: Optional[str] = None
    space_name: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    heading: Optional[float] = None
    pitch: Optional[float] = None


class ChatResponse(BaseModel):
    """Response body for chat endpoint."""
    response: str
    conversation_id: str
    payment_link: Optional[str] = None
    booking_summary: Optional[dict] = None
    virtual_tour: Optional[VirtualTour] = None
    timestamp: str


class HistoryMessage(BaseModel):
    """Message in conversation history."""
    role: str
    content: str


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    authorization: Optional[str] = Header(None)
):
    """
    Chat with the booking agent.

    This endpoint requires authentication. The user_id must match the
    authenticated user's ID from the authorization token.
    """
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    if not request.user_id:
        raise HTTPException(status_code=401, detail="User ID is required. Please log in.")

    # Get user profile for context
    supabase = get_supabase_service()
    try:
        user_profile = await supabase.get_user_profile(request.user_id)
        user_name = user_profile.get("full_name") if user_profile else None
        user_email = user_profile.get("email") if user_profile else None
    except Exception as e:
        print(f"Warning: Could not fetch user profile: {e}")
        user_name = None
        user_email = None

    # Run the booking agent
    try:
        result = await run_booking_agent(
            message=request.message,
            user_id=request.user_id,
            user_name=user_name,
            user_email=user_email,
            conversation_id=request.conversation_id,
            history=request.history,
            language=request.language or "english"
        )
    except Exception as e:
        print(f"Agent error: {e}")
        raise HTTPException(
            status_code=500,
            detail="I encountered an error processing your request. Please try again."
        )

    virtual_tour_data = result.get("virtual_tour")
    virtual_tour = VirtualTour(**virtual_tour_data) if virtual_tour_data else None

    return ChatResponse(
        response=result["response"],
        conversation_id=result["conversation_id"],
        payment_link=result.get("payment_link"),
        booking_summary=result.get("booking_summary"),
        virtual_tour=virtual_tour,
        timestamp=datetime.now().isoformat()
    )


@router.get("/chat/health")
async def chat_health():
    """Health check for chat endpoint."""
    return {"status": "healthy", "service": "booking-agent"}
