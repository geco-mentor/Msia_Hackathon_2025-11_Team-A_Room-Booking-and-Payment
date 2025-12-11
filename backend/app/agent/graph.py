"""LangGraph agent definition for the booking assistant."""
import os
import json
import asyncio
from typing import Literal
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode

from app.config import get_settings
from app.agent.state import AgentState
from app.agent.prompts import SYSTEM_PROMPT
from app.agent.tools import (
    get_spaces_info,
    get_space_details,
    check_availability,
    create_booking,
    get_user_bookings,
    cancel_booking,
    get_user_profile,
    get_virtual_tour,
    list_available_tours,
)

settings = get_settings()

# Initialize LLM
llm = ChatOpenAI(
    model=settings.OPENAI_MODEL,
    temperature=0.7,
    api_key=settings.OPENAI_API_KEY,
    # Each LLM call is bounded, but the flow can make multiple calls (tools + follow-up)
    timeout=20,
    max_retries=1,
)

# Custom tools for Supabase operations
custom_tools = [
    get_spaces_info,
    get_space_details,
    check_availability,
    create_booking,
    get_user_bookings,
    cancel_booking,
    get_user_profile,
    get_virtual_tour,
    list_available_tours,
]

# Stripe Agent Toolkit intentionally disabled to keep payment prices grounded in DB rates
stripe_tools = []

# Combine all tools (only Supabase-backed tools)
all_tools = custom_tools

# Bind tools to LLM
llm_with_tools = llm.bind_tools(all_tools)


def should_continue(state: AgentState) -> Literal["tools", "respond"]:
    """Determine if we should continue to tools or respond to user."""
    messages = state["messages"]
    last_message = messages[-1]

    # If the LLM made tool calls, execute them
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        return "tools"

    return "respond"


async def agent_node(state: AgentState) -> dict:
    """Main agent node that processes messages and decides actions."""
    messages = state["messages"]

    # Build the message list with system prompt
    system_message = SystemMessage(content=SYSTEM_PROMPT)

    # Add current date/time context (critical for date-based bookings)
    from datetime import datetime
    now = datetime.now()
    time_context = f"\n\n**Current Date & Time**: {now.strftime('%B %d, %Y at %I:%M %p')}"
    time_context += f"\n**Current Day**: {now.strftime('%A')}"
    time_context += "\n**Important**: When suggesting dates, always start from TODAY or later. Never suggest past dates."

    # Add user context to system message if available
    user_context = time_context
    if state.get("user_id"):
        user_context += f"\n\nCurrent user ID: {state['user_id']}"
    if state.get("user_name"):
        user_context += f"\nUser name: {state['user_name']}"
    if state.get("user_email"):
        user_context += f"\nUser email: {state['user_email']}"

    if user_context:
        system_message = SystemMessage(content=SYSTEM_PROMPT + user_context)

    # Add booking context if exists
    if state.get("booking_context"):
        ctx = state["booking_context"]
        booking_info = "\n\nCurrent booking context:"
        if ctx.get("space_name"):
            booking_info += f"\n- Space: {ctx['space_name']}"
        if ctx.get("date"):
            booking_info += f"\n- Date: {ctx['date']}"
        if ctx.get("start_time"):
            booking_info += f"\n- Time: {ctx['start_time']} - {ctx.get('end_time', 'TBD')}"
        if ctx.get("total_amount"):
            booking_info += f"\n- Amount: RM{ctx['total_amount']:.2f}"
        system_message = SystemMessage(content=system_message.content + booking_info)

    full_messages = [system_message] + list(messages)

    # Call the LLM
    # Use async call so we don't block the event loop during LLM/tool routing
    response = await llm_with_tools.ainvoke(full_messages)

    return {"messages": [response]}


def response_node(state: AgentState) -> dict:
    """Format the final response to return to the user."""
    messages = state["messages"]
    last_message = messages[-1]

    response_text = last_message.content if hasattr(last_message, "content") else str(last_message)

    # Check if we need to extract payment link or virtual tour from tool results
    payment_link = None
    virtual_tour = None

    for msg in reversed(messages):
        if hasattr(msg, "content") and isinstance(msg.content, str):
            try:
                data = json.loads(msg.content)

                # Extract payment link
                if not payment_link:
                    if "url" in data and "pay.stripe.com" in str(data.get("url", "")):
                        payment_link = data["url"]
                    elif "payment_link" in data:
                        payment_link = data["payment_link"]

                # Extract virtual tour
                if not virtual_tour and "virtual_tour" in data:
                    virtual_tour = data["virtual_tour"]

            except:
                pass

    return {
        "response": response_text,
        "payment_link": payment_link,
        "virtual_tour": virtual_tour
    }


def build_booking_agent():
    """Build and compile the booking agent graph."""
    # Create the graph
    workflow = StateGraph(AgentState)

    # Add nodes
    workflow.add_node("agent", agent_node)
    workflow.add_node("tools", ToolNode(all_tools))
    workflow.add_node("respond", response_node)

    # Set entry point
    workflow.set_entry_point("agent")

    # Add conditional edges
    workflow.add_conditional_edges(
        "agent",
        should_continue,
        {
            "tools": "tools",
            "respond": "respond"
        }
    )

    # Tools always go back to agent
    workflow.add_edge("tools", "agent")

    # Respond is the end
    workflow.add_edge("respond", END)

    # Compile and return
    return workflow.compile()


# Create the agent instance
booking_agent = build_booking_agent()


async def run_booking_agent(
    message: str,
    user_id: str,
    user_name: str = None,
    user_email: str = None,
    conversation_id: str = None,
    history: list = None,
    language: str = "english"
) -> dict:
    """
    Run the booking agent with a user message.

    Args:
        message: The user's message
        user_id: The user's ID (required for bookings)
        user_name: The user's name (optional)
        user_email: The user's email (optional)
        conversation_id: Session ID for conversation continuity
        history: Previous messages in the conversation
        language: Preferred language

    Returns:
        Dict with response, payment_link (if any), and updated state
    """
    import uuid

    # Build initial messages from history
    messages = []
    if history:
        for msg in history[-10:]:  # Last 10 messages
            if msg.get("role") == "user":
                messages.append(HumanMessage(content=msg["content"]))
            elif msg.get("role") == "assistant":
                messages.append(AIMessage(content=msg["content"]))

    # Add current message
    messages.append(HumanMessage(content=message))

    # Initial state
    initial_state: AgentState = {
        "messages": messages,
        "user_id": user_id,
        "user_name": user_name,
        "user_email": user_email,
        "conversation_id": conversation_id or str(uuid.uuid4()),
        "language": language,
        "booking_context": None,
        "payment_context": None,
        "current_intent": None,
        "awaiting_confirmation": False,
        "requires_payment": False,
        "response": None,
        "payment_link": None,
        "virtual_tour": None,
    }

    # Run the agent with a hard timeout to avoid hanging the UI
    try:
        # Allow enough headroom for multi-turn tool use (LLM -> tool -> LLM)
        final_state = await asyncio.wait_for(
            booking_agent.ainvoke(initial_state),
            timeout=60,
        )
    except asyncio.TimeoutError:
        return {
            "response": "Sorry, the assistant is taking too long to respond. Please try again in a moment.",
            "payment_link": None,
            "conversation_id": initial_state["conversation_id"],
        }
    except Exception as exc:
        # Catch tool/runtime errors (e.g., Stripe price issues) and return a graceful response
        print(f"Agent execution error: {exc}")
        return {
            "response": "I hit a snag while processing that booking. Please try again in a moment.",
            "payment_link": None,
            "conversation_id": initial_state["conversation_id"],
        }

    return {
        "response": final_state.get("response", "I apologize, but I encountered an issue. Please try again."),
        "payment_link": final_state.get("payment_link"),
        "virtual_tour": final_state.get("virtual_tour"),
        "conversation_id": final_state.get("conversation_id"),
    }
