"""BlueBubbles notification delivery service."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Any
from urllib import error, parse, request
from uuid import uuid4


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def send_bluebubbles_notification(
    *,
    chat_guid: str,
    message_preview: str,
    blueprint_id: str,
    pdf_path: str | None,
) -> dict[str, Any]:
    """Send a BlueBubbles text message through the BlueBubbles REST API."""
    base_url = os.getenv("BLUEBUBBLES_SERVER_URL", "").rstrip("/")
    password = os.getenv("BLUEBUBBLES_PASSWORD", "")
    api_path = os.getenv("BLUEBUBBLES_API_PATH", "/api/v1").rstrip("/")

    if not base_url or not password or not chat_guid:
        return {
            "ok": False,
            "status": "skipped",
            "reason": "BlueBubbles configuration is incomplete.",
        }

    message = message_preview
    if pdf_path:
        message += f"\nBlueprint: {pdf_path}"

    payload = {
        "chatGuid": chat_guid,
        "tempGuid": f"temp-{uuid4()}",
        "message": message,
        "metadata": {
            "blueprint_id": blueprint_id,
        },
    }

    query = parse.urlencode({"password": password})
    req = request.Request(
        url=f"{base_url}{api_path}/message/text?{query}",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=20) as response:
            body = json.loads(response.read().decode("utf-8") or "{}")
    except (error.URLError, error.HTTPError, TimeoutError, json.JSONDecodeError) as exc:
        return {
            "ok": False,
            "status": "failed",
            "reason": str(exc),
        }

    data = body.get("data") if isinstance(body, dict) else None
    external_id = None
    if isinstance(data, dict):
        external_id = data.get("guid") or data.get("id")

    return {
        "ok": True,
        "status": "sent",
        "external_message_id": external_id,
        "sent_at": now_utc(),
    }
