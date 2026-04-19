"""Unified iMessage delivery helpers for Lazarus notifications."""

from __future__ import annotations

import os
from typing import Any

from backend.app.services.bluebubbles_service import send_bluebubbles_notification
from backend.app.services.spectrum_service import send_spectrum_notification, send_spectrum_reply


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


def send_watchlist_alert_message(
    *,
    drug_name: str,
    asset_code: str,
    original_indication: str,
    matched_disease: str,
    confidence: float,
    risk_level: str,
    reason: str,
) -> dict[str, Any]:
    """Send a formatted watchlist alert via iMessage (Photon/Spectrum/BlueBubbles)."""
    confidence_pct = round(confidence * 100) if confidence <= 1 else round(confidence)

    risk_emoji = {"low": "🟢", "medium": "🟡", "high": "🔴"}.get(risk_level.lower(), "⚪")

    message = (
        f"🔔 Lazarus Watchlist Alert\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"💊 {drug_name} ({asset_code})\n"
        f"📋 Original: {original_indication}\n"
        f"🎯 Match: {matched_disease}\n"
        f"📊 Confidence: {confidence_pct}%\n"
        f"{risk_emoji} Risk: {risk_level.capitalize()}\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"📝 {reason}\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"Open Lazarus dashboard to review."
    )

    channel = resolve_imessage_channel()
    if channel == "bluebubbles":
        return send_bluebubbles_notification(
            chat_guid=os.getenv("BLUEBUBBLES_CHAT_GUID", ""),
            message_preview=message,
            blueprint_id=f"alert-{asset_code}",
            pdf_path=None,
        )
    if channel == "spectrum":
        return send_spectrum_reply(
            recipient=os.getenv("SPECTRUM_RECIPIENT", ""),
            message=message,
            metadata={
                "source": "lazarus-watchlist",
                "asset_code": asset_code,
                "matched_disease": matched_disease,
            },
        )
    return {
        "ok": False,
        "status": "skipped",
        "reason": "No iMessage delivery adapter is configured.",
    }


def send_watchlist_scan_summary(
    *,
    disease_query: str,
    total_assets: int,
    alert_count: int,
    cache_hits: int,
) -> dict[str, Any]:
    """Send a summary message when a watchlist scan completes."""
    if alert_count > 0:
        status_line = f"✅ Found {alert_count} potential match{'es' if alert_count != 1 else ''}!"
    else:
        status_line = "❌ No matching drugs found."

    message = (
        f"📋 Watchlist Scan Complete\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"🔍 Disease: {disease_query}\n"
        f"💊 Scanned: {total_assets} drugs\n"
        f"⚡ Cached: {cache_hits}/{total_assets}\n"
        f"{status_line}\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"Check individual alerts for details."
    )

    channel = resolve_imessage_channel()
    if channel == "bluebubbles":
        return send_bluebubbles_notification(
            chat_guid=os.getenv("BLUEBUBBLES_CHAT_GUID", ""),
            message_preview=message,
            blueprint_id="watchlist-summary",
            pdf_path=None,
        )
    if channel == "spectrum":
        return send_spectrum_reply(
            recipient=os.getenv("SPECTRUM_RECIPIENT", ""),
            message=message,
            metadata={
                "source": "lazarus-watchlist-summary",
                "disease_query": disease_query,
                "alert_count": alert_count,
            },
        )
    return {
        "ok": False,
        "status": "skipped",
        "reason": "No iMessage delivery adapter is configured.",
    }
