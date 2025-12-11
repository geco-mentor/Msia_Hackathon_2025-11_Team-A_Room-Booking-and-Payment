"""Agent tools for checking space availability."""
import json
from datetime import datetime, timedelta
from typing import Optional
from langchain_core.tools import tool

from app.services.supabase import get_supabase_service

# Default virtual tour URLs (embeddable and full Google Maps Street View)
# Using user-specified Street View link for Regus Singapore One Fullerton
DEFAULT_VIRTUAL_TOUR_URL = "https://www.google.com/maps/embed?pb=!4v1702100000000!6m8!1m7!1sCIHM0ogKEICAgIC4s9fTwwE!2m2!1d1.2860713!2d103.8539747!3f257.43!4f76.38!5f0.7820865974627469"
DEFAULT_VIRTUAL_TOUR_FULL_URL = "https://www.google.com/maps/place/Regus+-+Singapore+One+Fullerton/@1.2860713,103.8539747,3a,75y,257.43h,76.38t/data=!3m7!1e1!3m5!1sCIHM0ogKEICAgIC4s9fTwwE!2e10!6shttps:%2F%2Flh3.googleusercontent.com%2Fgpms-cs-s%2FAPRy3c-P0ZKUymI9p4zxpnQEkrFUCOOz9D_nE6oGgKnm0MNNDJzesrRuiAeNFf3Y0coB8e_7SlvkIGBp5-SU4HgFagBY9cGhOfZKVrH_4BymJgkn2ktv3CKAt0XhLyWAcAEsTSJM47p6qg%3Dw900-h600-k-no-pi13.623591235897763-ya267.7302687199337-ro0-fo100!7i13312!8i6656!4m9!3m8!1s0x31da1908e48d020d:0x41d28cd3f47d452f!8m2!3d1.2857163!4d103.8539653!10e5!14m1!1BCgIgARICCAI!16s%2Fg%2F1tglwh4l?entry=ttu&g_ep=EgoyMDI1MTIwMi4wIKXMDSoASAFQAw%3D%3D"
DEFAULT_VIRTUAL_TOUR_LAT = 1.2860713
DEFAULT_VIRTUAL_TOUR_LNG = 103.8539747
DEFAULT_VIRTUAL_TOUR_HEADING = 257.43
DEFAULT_VIRTUAL_TOUR_PITCH = 76.38
DEFAULT_VIRTUAL_TOUR_PANO_ID = "CIHM0ogKEICAgIC4s9fTwwE"


def parse_date(date_str: str) -> datetime:
    """Parse date string in various formats."""
    formats = [
        "%Y-%m-%d",
        "%d/%m/%Y",
        "%d-%m-%Y",
        "%B %d, %Y",
        "%b %d, %Y"
    ]
    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            continue

    # Handle relative dates
    lower = date_str.lower()
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

    if lower == "today":
        return today
    elif lower == "tomorrow":
        return today + timedelta(days=1)
    elif lower == "next week":
        return today + timedelta(weeks=1)

    raise ValueError(f"Could not parse date: {date_str}")


def parse_time(time_str: str) -> tuple[int, int]:
    """Parse time string and return (hour, minute)."""
    time_str = time_str.strip().upper()

    # Handle formats like "2pm", "2 pm", "14:00", "2:00 PM"
    if ":" in time_str:
        parts = time_str.replace("AM", "").replace("PM", "").strip().split(":")
        hour = int(parts[0])
        minute = int(parts[1]) if len(parts) > 1 else 0
        if "PM" in time_str.upper() and hour < 12:
            hour += 12
        elif "AM" in time_str.upper() and hour == 12:
            hour = 0
    else:
        # Format like "2pm" or "14"
        time_str_clean = time_str.replace("AM", "").replace("PM", "").strip()
        hour = int(time_str_clean)
        minute = 0
        if "PM" in time_str.upper() and hour < 12:
            hour += 12
        elif "AM" in time_str.upper() and hour == 12:
            hour = 0

    return hour, minute


@tool
async def check_availability(
    space_type: str,
    date: str,
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
    duration_hours: Optional[int] = None,
    attendees: Optional[int] = None,
    location: Optional[str] = None
) -> str:
    """
    Check availability of spaces for a specific date and time.

    Args:
        space_type: Type of space - 'hot_desk', 'private_office', or 'meeting_room'
        date: Date in YYYY-MM-DD format, or natural language like 'today', 'tomorrow'
        start_time: Start time in HH:MM format (24-hour) or '2pm' format. Required for meeting rooms.
        end_time: End time in HH:MM format (24-hour) or '4pm' format. Optional if duration_hours provided.
        duration_hours: Duration in hours. Alternative to end_time.
        attendees: Number of attendees (used to filter by capacity)
        location: Preferred location - 'KL', 'PJ', 'JB' or full name. Optional.

    Returns:
        JSON string with available spaces and time slots for the requested criteria.
    """
    supabase = get_supabase_service()

    # Parse date
    try:
        booking_date = parse_date(date)
    except ValueError as e:
        return json.dumps({"error": str(e)})

    # Normalize location
    location_map = {
        "kl": "Kuala Lumpur",
        "pj": "Petaling Jaya",
        "jb": "Johor Bahru"
    }
    if location:
        location = location_map.get(location.lower(), location)

    # Get spaces matching criteria
    spaces = await supabase.get_spaces(
        space_type=space_type,
        location=location
    )

    if not spaces:
        return json.dumps({
            "available": False,
            "message": f"No {space_type.replace('_', ' ')}s found" +
                      (f" in {location}" if location else "") + "."
        })

    # Filter by capacity if attendees specified
    if attendees:
        spaces = [s for s in spaces if s["capacity"] >= attendees]
        if not spaces:
            return json.dumps({
                "available": False,
                "message": f"No spaces found with capacity for {attendees} attendees."
            })

    # For meeting rooms, check specific time slot availability
    if space_type == "meeting_room" and start_time:
        start_hour, start_minute = parse_time(start_time)
        start_datetime = booking_date.replace(hour=start_hour, minute=start_minute)

        if end_time:
            end_hour, end_minute = parse_time(end_time)
            end_datetime = booking_date.replace(hour=end_hour, minute=end_minute)
        elif duration_hours:
            end_datetime = start_datetime + timedelta(hours=duration_hours)
        else:
            # Default to 1 hour
            end_datetime = start_datetime + timedelta(hours=1)

        available_spaces = []
        for space in spaces:
            is_available = await supabase.check_space_availability(
                space["id"],
                start_datetime,
                end_datetime
            )
            if is_available:
                # Calculate price
                hours = (end_datetime - start_datetime).total_seconds() / 3600
                price = float(space["hourly_rate"]) * hours if space.get("hourly_rate") else 0

                available_spaces.append({
                    "id": space["id"],
                    "name": space["name"],
                    "capacity": space["capacity"],
                    "location": space["location"],
                    "floor": space.get("floor", ""),
                    "hourly_rate": float(space["hourly_rate"]) if space.get("hourly_rate") else None,
                    "estimated_total": f"RM{price:.2f}",
                    "amenities": space.get("amenities", [])
                })

        if not available_spaces:
            return json.dumps({
                "available": False,
                "message": f"No meeting rooms available on {booking_date.strftime('%B %d, %Y')} "
                          f"from {start_datetime.strftime('%I:%M %p')} to {end_datetime.strftime('%I:%M %p')}.",
                "suggestion": "Try a different time or check another location."
            })

        return json.dumps({
            "available": True,
            "date": booking_date.strftime("%Y-%m-%d"),
            "time_slot": {
                "start": start_datetime.strftime("%I:%M %p"),
                "end": end_datetime.strftime("%I:%M %p"),
                "duration_hours": hours
            },
            "spaces": available_spaces,
            "virtual_tour": {
                "url": DEFAULT_VIRTUAL_TOUR_URL,
                "full_url": DEFAULT_VIRTUAL_TOUR_FULL_URL,
                "lat": DEFAULT_VIRTUAL_TOUR_LAT,
                "lng": DEFAULT_VIRTUAL_TOUR_LNG,
                "heading": DEFAULT_VIRTUAL_TOUR_HEADING,
                "pitch": DEFAULT_VIRTUAL_TOUR_PITCH,
                "pano_id": DEFAULT_VIRTUAL_TOUR_PANO_ID,
                "space_name": "Our Meeting Rooms"
            }
        }, indent=2)

    # For hot desks and private offices, just return available spaces
    available_spaces = []
    for space in spaces:
        formatted = {
            "id": space["id"],
            "name": space["name"],
            "capacity": space["capacity"],
            "location": space["location"],
            "floor": space.get("floor", ""),
            "amenities": space.get("amenities", [])
        }

        if space_type == "hot_desk":
            formatted["daily_rate"] = f"RM{space['daily_rate']}" if space.get("daily_rate") else None
            formatted["monthly_rate"] = f"RM{space['monthly_rate']}" if space.get("monthly_rate") else None
        elif space_type == "private_office":
            formatted["monthly_rate"] = f"RM{space['monthly_rate']}" if space.get("monthly_rate") else None

        available_spaces.append(formatted)

    return json.dumps({
        "available": True,
        "date": booking_date.strftime("%Y-%m-%d"),
        "spaces": available_spaces,
        "note": "Hot desks and private offices are generally available. "
               "Book now to secure your spot.",
        "virtual_tour": {
            "url": DEFAULT_VIRTUAL_TOUR_URL,
            "full_url": DEFAULT_VIRTUAL_TOUR_FULL_URL,
            "lat": DEFAULT_VIRTUAL_TOUR_LAT,
            "lng": DEFAULT_VIRTUAL_TOUR_LNG,
            "heading": DEFAULT_VIRTUAL_TOUR_HEADING,
            "pitch": DEFAULT_VIRTUAL_TOUR_PITCH,
            "pano_id": DEFAULT_VIRTUAL_TOUR_PANO_ID,
            "space_name": "Our Coworking Spaces"
        }
    }, indent=2)


@tool
async def get_available_time_slots(
    space_id: str,
    date: str
) -> str:
    """
    Get all available time slots for a specific space on a given date.

    Args:
        space_id: UUID of the space
        date: Date in YYYY-MM-DD format or natural language like 'today', 'tomorrow'

    Returns:
        JSON string with all available time slots (1-hour increments) for that space.
    """
    supabase = get_supabase_service()

    # Parse date
    try:
        booking_date = parse_date(date)
    except ValueError as e:
        return json.dumps({"error": str(e)})

    # Get space details
    space = await supabase.get_space_by_id(space_id)
    if not space:
        return json.dumps({"error": f"Space not found: {space_id}"})

    # Business hours: 8 AM to 10 PM
    business_start = 8
    business_end = 22

    # Get existing bookings for the day
    day_start = booking_date.replace(hour=0, minute=0, second=0)
    day_end = booking_date.replace(hour=23, minute=59, second=59)
    bookings = await supabase.get_bookings_for_space(space_id, day_start, day_end)

    # Build list of booked hours
    booked_hours = set()
    for booking in bookings:
        start = datetime.fromisoformat(booking["start_time"].replace("Z", "+00:00"))
        end = datetime.fromisoformat(booking["end_time"].replace("Z", "+00:00"))
        current = start
        while current < end:
            booked_hours.add(current.hour)
            current += timedelta(hours=1)

    # Generate available slots
    available_slots = []
    for hour in range(business_start, business_end):
        if hour not in booked_hours:
            slot_start = booking_date.replace(hour=hour, minute=0)
            slot_end = booking_date.replace(hour=hour + 1, minute=0)
            available_slots.append({
                "start_time": slot_start.strftime("%I:%M %p"),
                "end_time": slot_end.strftime("%I:%M %p"),
                "available": True
            })

    return json.dumps({
        "space_id": space_id,
        "space_name": space["name"],
        "date": booking_date.strftime("%Y-%m-%d"),
        "business_hours": f"{business_start}:00 AM - {business_end % 12 or 12}:00 PM",
        "available_slots": available_slots,
        "total_available": len(available_slots),
        "virtual_tour": {
            "url": DEFAULT_VIRTUAL_TOUR_URL,
            "full_url": DEFAULT_VIRTUAL_TOUR_FULL_URL,
            "lat": DEFAULT_VIRTUAL_TOUR_LAT,
            "lng": DEFAULT_VIRTUAL_TOUR_LNG,
            "heading": DEFAULT_VIRTUAL_TOUR_HEADING,
            "pitch": DEFAULT_VIRTUAL_TOUR_PITCH,
            "pano_id": DEFAULT_VIRTUAL_TOUR_PANO_ID,
            "space_name": space["name"]
        }
    }, indent=2)
