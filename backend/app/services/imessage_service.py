"""Unified iMessage delivery helpers for Lazarus notifications."""

from __future__ import annotations

import os
from typing import Any

from backend.app.services.bluebubbles_service import send_bluebubbles_notification
from backend.app.services.spectrum_service import send_spectrum_notification


def resolve_imessage_channel() -> str:
    """Resolve the preferred iMessage delivery channel from environment config."""
    if os.getenv("BLUEBUBBLES_SERVER_URL") and os.getenv("BLUEBUBBLES_CHAT_GUID"):
        return "bluebubbles"
    if os.getenv("IMESSAGE_LOCAL", "").strip().lower() in {"1", "true", "yes", "on"} and os.getenv("SPECTRUM_PROJECT_ID"):
        return "spectrum"
    if os.getenv("SPECTRUM_PROJECT_ID") and os.getenv("SPECTRUM_SECRET_KEY") and os.getenv("SPECTRUM_RECIPIENT"):
        return "spectrum"
    return "dashboard"


def send_imessage_notification(
    *,
    message_preview: str,
    blueprint_id: str,
    pdf_path: str | None,
) -> dict[str, Any]:
    """Send a notification using the best configured iMessage adapter."""
    channel = resolve_imessage_channel()
    if channel == "bluebubbles":
        return send_bluebubbles_notification(
            chat_guid=os.getenv("BLUEBUBBLES_CHAT_GUID", ""),
            message_preview=message_preview,
            blueprint_id=blueprint_id,
            pdf_path=pdf_path,
        )
    if channel == "spectrum":
        return send_spectrum_notification(
            recipient=os.getenv("SPECTRUM_RECIPIENT", ""),
            message_preview=message_preview,
            blueprint_id=blueprint_id,
            pdf_path=pdf_path,
        )
    return {
        "ok": False,
        "status": "skipped",
        "reason": "No iMessage delivery adapter is configured.",
    }
