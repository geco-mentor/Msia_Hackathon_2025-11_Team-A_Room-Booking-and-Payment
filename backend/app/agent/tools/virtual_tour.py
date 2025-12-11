"""Agent tool for virtual tours of coworking spaces."""
import json
from typing import Optional
from langchain_core.tools import tool


# Virtual tour mapping - maps space names/locations to their 360° tour URLs
# Location: Regus Singapore One Fullerton indoor view (user-provided)
VIRTUAL_TOURS = {
    "one_fullerton": {
        "url": "https://www.google.com/maps/embed?pb=!4v1702100000000!6m8!1m7!1sCIHM0ogKEICAgIC4s9fTwwE!2m2!1d1.2860713!2d103.8539747!3f257.43!4f76.38!5f0.7820865974627469",
        "full_url": "https://www.google.com/maps/place/Regus+-+Singapore+One+Fullerton/@1.2860713,103.8539747,3a,75y,257.43h,76.38t/data=!3m7!1e1!3m5!1sCIHM0ogKEICAgIC4s9fTwwE!2e10!6shttps:%2F%2Flh3.googleusercontent.com%2Fgpms-cs-s%2FAPRy3c-P0ZKUymI9p4zxpnQEkrFUCOOz9D_nE6oGgKnm0MNNDJzesrRuiAeNFf3Y0coB8e_7SlvkIGBp5-SU4HgFagBY9cGhOfZKVrH_4BymJgkn2ktv3CKAt0XhLyWAcAEsTSJM47p6qg%3Dw900-h600-k-no-pi13.623591235897763-ya267.7302687199337-ro0-fo100!7i13312!8i6656!4m9!3m8!1s0x31da1908e48d020d:0x41d28cd3f47d452f!8m2!3d1.2857163!4d103.8539653!10e5!14m1!1BCgIgARICCAI!16s%2Fg%2F1tglwh4l?entry=ttu&g_ep=EgoyMDI1MTIwMi4wIKXMDSoASAFQAw%3D%3D",
        "space_name": "One Fullerton Premium Office",
        "location": "Singapore",
        "description": "Premium coworking space with stunning Marina Bay views",
        "lat": 1.2860713,
        "lng": 103.8539747,
        "heading": 257.43,
        "pitch": 76.38,
        "pano_id": "CIHM0ogKEICAgIC4s9fTwwE",
    },
    # Default tour for all locations - can be customized per space later
    "default": {
        "url": "https://www.google.com/maps/embed?pb=!4v1702100000000!6m8!1m7!1sCIHM0ogKEICAgIC4s9fTwwE!2m2!1d1.2860713!2d103.8539747!3f257.43!4f76.38!5f0.7820865974627469",
        "full_url": "https://www.google.com/maps/place/Regus+-+Singapore+One+Fullerton/@1.2860713,103.8539747,3a,75y,257.43h,76.38t/data=!3m7!1e1!3m5!1sCIHM0ogKEICAgIC4s9fTwwE!2e10!6shttps:%2F%2Flh3.googleusercontent.com%2Fgpms-cs-s%2FAPRy3c-P0ZKUymI9p4zxpnQEkrFUCOOz9D_nE6oGgKnm0MNNDJzesrRuiAeNFf3Y0coB8e_7SlvkIGBp5-SU4HgFagBY9cGhOfZKVrH_4BymJgkn2ktv3CKAt0XhLyWAcAEsTSJM47p6qg%3Dw900-h600-k-no-pi13.623591235897763-ya267.7302687199337-ro0-fo100!7i13312!8i6656!4m9!3m8!1s0x31da1908e48d020d:0x41d28cd3f47d452f!8m2!3d1.2857163!4d103.8539653!10e5!14m1!1BCgIgARICCAI!16s%2Fg%2F1tglwh4l?entry=ttu&g_ep=EgoyMDI1MTIwMi4wIKXMDSoASAFQAw%3D%3D",
        "space_name": "Infinity8 Coworking Space",
        "location": "Various",
        "description": "Modern coworking space with premium amenities",
        "lat": 1.2860713,
        "lng": 103.8539747,
        "heading": 257.43,
        "pitch": 76.38,
        "pano_id": "CIHM0ogKEICAgIC4s9fTwwE",
    },
}


@tool
async def get_virtual_tour(
    space_name: Optional[str] = None,
    location: Optional[str] = None
) -> str:
    """
    Get a 360° virtual tour link for a coworking space.

    Use this tool when a user:
    - Asks to see a space or take a virtual tour
    - Wants to preview a room before booking
    - Asks "what does the space look like?"
    - Requests to "see" or "view" a meeting room or office

    Args:
        space_name: Optional name of the specific space to tour.
        location: Optional location to filter by (e.g., 'Kuala Lumpur', 'Singapore').

    Returns:
        JSON string with virtual tour URL and space details.
        The frontend will render this as an interactive 360° tour button.
    """
    tour_key = "default"

    # Check if we have a specific tour for the requested space/location
    if space_name:
        normalized_name = space_name.lower().replace(" ", "_").replace("-", "_")
        if normalized_name in VIRTUAL_TOURS:
            tour_key = normalized_name

    tour_data = VIRTUAL_TOURS[tour_key]

    # If a specific space name was provided, use that in the response
    display_name = space_name if space_name else tour_data["space_name"]

    return json.dumps({
        "virtual_tour": {
            "url": tour_data["url"],
            "full_url": tour_data.get("full_url", tour_data["url"]),
            "space_name": display_name,
            "lat": tour_data.get("lat"),
            "lng": tour_data.get("lng"),
            "heading": tour_data.get("heading"),
            "pitch": tour_data.get("pitch"),
            "pano_id": tour_data.get("pano_id"),
        },
        "message": f"Here's a 360° virtual tour of {display_name}. Click the button to explore the space interactively!",
        "description": tour_data["description"]
    }, indent=2)


@tool
async def list_available_tours() -> str:
    """
    List all available virtual tours for coworking spaces.

    Use this tool when a user asks:
    - "What tours are available?"
    - "Which spaces can I tour virtually?"
    - "Show me all virtual tours"

    Returns:
        JSON string with list of available virtual tours.
    """
    tours = []
    for key, tour in VIRTUAL_TOURS.items():
        if key != "default":
            tours.append({
                "space_name": tour["space_name"],
                "location": tour["location"],
                "description": tour["description"]
            })

    # Always include the default option
    default = VIRTUAL_TOURS["default"]
    if not tours:
        tours.append({
            "space_name": default["space_name"],
            "location": default["location"],
            "description": default["description"]
        })

    return json.dumps({
        "available_tours": tours,
        "message": "Here are the spaces with virtual tours available. Ask me to show you a specific tour!"
    }, indent=2)
