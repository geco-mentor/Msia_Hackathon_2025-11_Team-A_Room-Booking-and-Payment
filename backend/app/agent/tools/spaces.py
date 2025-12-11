"""Agent tools for querying coworking spaces."""
import json
from typing import Optional
from langchain_core.tools import tool

from app.services.supabase import get_supabase_service

# Default virtual tour URLs (embeddable and full Google Maps Street View)
# Location: Regus Singapore One Fullerton indoor view (user-specified link)
DEFAULT_VIRTUAL_TOUR_URL = "https://www.google.com/maps/embed?pb=!4v1702100000000!6m8!1m7!1sCIHM0ogKEICAgIC4s9fTwwE!2m2!1d1.2860713!2d103.8539747!3f257.43!4f76.38!5f0.7820865974627469"
DEFAULT_VIRTUAL_TOUR_FULL_URL = "https://www.google.com/maps/place/Regus+-+Singapore+One+Fullerton/@1.2860713,103.8539747,3a,75y,257.43h,76.38t/data=!3m7!1e1!3m5!1sCIHM0ogKEICAgIC4s9fTwwE!2e10!6shttps:%2F%2Flh3.googleusercontent.com%2Fgpms-cs-s%2FAPRy3c-P0ZKUymI9p4zxpnQEkrFUCOOz9D_nE6oGgKnm0MNNDJzesrRuiAeNFf3Y0coB8e_7SlvkIGBp5-SU4HgFagBY9cGhOfZKVrH_4BymJgkn2ktv3CKAt0XhLyWAcAEsTSJM47p6qg%3Dw900-h600-k-no-pi13.623591235897763-ya267.7302687199337-ro0-fo100!7i13312!8i6656!4m9!3m8!1s0x31da1908e48d020d:0x41d28cd3f47d452f!8m2!3d1.2857163!4d103.8539653!10e5!14m1!1BCgIgARICCAI!16s%2Fg%2F1tglwh4l?entry=ttu&g_ep=EgoyMDI1MTIwMi4wIKXMDSoASAFQAw%3D%3D"
DEFAULT_VIRTUAL_TOUR_LAT = 1.2860713
DEFAULT_VIRTUAL_TOUR_LNG = 103.8539747
DEFAULT_VIRTUAL_TOUR_HEADING = 257.43
DEFAULT_VIRTUAL_TOUR_PITCH = 76.38
DEFAULT_VIRTUAL_TOUR_PANO_ID = "CIHM0ogKEICAgIC4s9fTwwE"


@tool
async def get_spaces_info(
    space_type: Optional[str] = None,
    location: Optional[str] = None
) -> str:
    """
    Get information about available coworking spaces at Infinity8.

    Args:
        space_type: Filter by type - 'hot_desk', 'private_office', or 'meeting_room'.
                   Leave empty to get all types.
        location: Filter by location - 'Kuala Lumpur', 'Petaling Jaya', or 'Johor Bahru'.
                 You can also use abbreviations like 'KL', 'PJ', or 'JB'.
                 Leave empty to get all locations.

    Returns:
        JSON string with list of available spaces including name, type, capacity,
        hourly/daily/monthly rates, location, floor, and amenities.
    """
    supabase = get_supabase_service()

    # Normalize location abbreviations
    location_map = {
        "kl": "Kuala Lumpur",
        "pj": "Petaling Jaya",
        "jb": "Johor Bahru"
    }
    if location:
        location = location_map.get(location.lower(), location)

    spaces = await supabase.get_spaces(
        space_type=space_type,
        location=location
    )

    if not spaces:
        return json.dumps({
            "message": "No spaces found matching your criteria.",
            "spaces": []
        })

    # Format spaces for readable output
    formatted_spaces = []
    for space in spaces:
        formatted = {
            "id": space["id"],
            "name": space["name"],
            "type": space["type"],
            "description": space.get("description", ""),
            "capacity": space["capacity"],
            "location": space["location"],
            "floor": space.get("floor", ""),
            "amenities": space.get("amenities", []),
        }

        # Add relevant pricing based on type
        if space["type"] == "meeting_room":
            formatted["hourly_rate"] = f"RM{space['hourly_rate']}/hour" if space.get("hourly_rate") else None
            formatted["daily_rate"] = f"RM{space['daily_rate']}/day" if space.get("daily_rate") else None
        elif space["type"] == "hot_desk":
            formatted["daily_rate"] = f"RM{space['daily_rate']}/day" if space.get("daily_rate") else None
            formatted["monthly_rate"] = f"RM{space['monthly_rate']}/month" if space.get("monthly_rate") else None
        elif space["type"] == "private_office":
            formatted["monthly_rate"] = f"RM{space['monthly_rate']}/month" if space.get("monthly_rate") else None

        formatted_spaces.append(formatted)

    return json.dumps({
        "total": len(formatted_spaces),
        "spaces": formatted_spaces,
        "virtual_tour": {
            "url": DEFAULT_VIRTUAL_TOUR_URL,
            "full_url": DEFAULT_VIRTUAL_TOUR_FULL_URL,
            "lat": DEFAULT_VIRTUAL_TOUR_LAT,
            "lng": DEFAULT_VIRTUAL_TOUR_LNG,
            "heading": DEFAULT_VIRTUAL_TOUR_HEADING,
            "pitch": DEFAULT_VIRTUAL_TOUR_PITCH,
            "pano_id": DEFAULT_VIRTUAL_TOUR_PANO_ID,
            "space_name": "Our Coworking Spaces"
        },
        "message": "Here are the available spaces. Click the virtual tour button to explore our facilities!"
    }, indent=2)


@tool
async def get_space_details(space_id: str) -> str:
    """
    Get detailed information about a specific space.

    Args:
        space_id: The UUID of the space to get details for.

    Returns:
        JSON string with full space details including all rates and amenities.
    """
    supabase = get_supabase_service()
    space = await supabase.get_space_by_id(space_id)

    if not space:
        return json.dumps({
            "error": "Space not found",
            "message": f"No space found with ID: {space_id}"
        })

    return json.dumps({
        "id": space["id"],
        "name": space["name"],
        "type": space["type"],
        "description": space.get("description", ""),
        "capacity": space["capacity"],
        "hourly_rate": float(space["hourly_rate"]) if space.get("hourly_rate") else None,
        "daily_rate": float(space["daily_rate"]) if space.get("daily_rate") else None,
        "monthly_rate": float(space["monthly_rate"]) if space.get("monthly_rate") else None,
        "location": space["location"],
        "floor": space.get("floor", ""),
        "amenities": space.get("amenities", []),
        "is_active": space["is_active"],
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


@tool
async def get_pricing_info() -> str:
    """
    Get pricing information for all space types at Infinity8.

    Returns:
        JSON string with pricing details for hot desks, meeting rooms,
        and private offices across all locations.
    """
    pricing_info = {
        "hot_desk": {
            "description": "Flexible workspace in our open area with ergonomic seating",
            "pricing": {
                "daily": "RM45-50/day (depending on location)",
                "monthly": "RM700-800/month (depending on location)"
            },
            "includes": ["WiFi", "Power outlets", "Locker", "Coffee/Tea"]
        },
        "meeting_room": {
            "description": "Professional meeting rooms with AV equipment",
            "pricing": {
                "hourly": "RM40-120/hour (depending on size)",
                "daily": "RM250-750/day (depending on size)"
            },
            "capacity_options": "4-16 people",
            "includes": ["WiFi", "TV/Projector", "Whiteboard", "Video conferencing"]
        },
        "private_office": {
            "description": "Fully furnished private offices for teams",
            "pricing": {
                "monthly": "RM1,800-4,500/month (depending on size and location)"
            },
            "capacity_options": "3-8 people",
            "includes": ["WiFi", "AC", "24/7 Access", "Lockable door", "Mail handling"]
        },
        "locations": [
            {"name": "Kuala Lumpur", "abbreviation": "KL"},
            {"name": "Petaling Jaya", "abbreviation": "PJ"},
            {"name": "Johor Bahru", "abbreviation": "JB"}
        ],
        "operating_hours": "Monday-Friday: 8:00 AM - 10:00 PM, Saturday: 9:00 AM - 6:00 PM",
        "contact": {
            "email": "hello@infinity8.my",
            "phone": "+60 3-1234-5678"
        }
    }

    return json.dumps(pricing_info, indent=2)
