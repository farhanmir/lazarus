"""Photon notification delivery service."""

from __future__ import annotations

import json
import os
from datetime import timedelta
from datetime import datetime, timezone
from typing import Any
from urllib import error, request

_TOKEN_CACHE: dict[str, Any] = {
    "access_token": None,
    "expires_at": None,
}


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _token_is_valid() -> bool:
    expires_at = _TOKEN_CACHE.get("expires_at")
    access_token = _TOKEN_CACHE.get("access_token")
    return bool(access_token and isinstance(expires_at, datetime) and now_utc() < expires_at)


def _fetch_m2m_access_token() -> str | None:
    auth_url = os.getenv("PHOTON_AUTH_URL", "").rstrip("/")
    client_id = os.getenv("PHOTON_CLIENT_ID")
    client_secret = os.getenv("PHOTON_CLIENT_SECRET")
    audience = os.getenv("PHOTON_AUDIENCE")

    if not auth_url or not client_id or not client_secret or not audience:
        return None

    payload = {
        "client_id": client_id,
        "client_secret": client_secret,
        "audience": audience,
        "grant_type": "client_credentials",
    }
    req = request.Request(
        url=auth_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    with request.urlopen(req, timeout=20) as response:
        body = json.loads(response.read().decode("utf-8") or "{}")
        access_token = body.get("access_token")
        expires_in = int(body.get("expires_in", 3600))
        if not access_token:
            return None

        # Refresh slightly before expiry to avoid edge-of-window request failures.
        _TOKEN_CACHE["access_token"] = access_token
        _TOKEN_CACHE["expires_at"] = now_utc() + timedelta(seconds=max(expires_in - 60, 60))
        return str(access_token)


def _get_photon_access_token() -> str | None:
    if _token_is_valid():
        return _TOKEN_CACHE["access_token"]

    static_token = os.getenv("PHOTON_API_KEY")
    if static_token:
        return static_token

    try:
        return _fetch_m2m_access_token()
    except (error.URLError, error.HTTPError, TimeoutError, json.JSONDecodeError, ValueError):
        return None


def _post_photon_json(path: str, payload: dict[str, Any]) -> dict[str, Any]:
    base_url = os.getenv("PHOTON_BASE_URL", "").rstrip("/")
    access_token = _get_photon_access_token()

    if not base_url or not access_token:
        return {
            "ok": False,
            "status": "skipped",
            "reason": "Photon configuration is incomplete or token exchange failed.",
        }

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {access_token}",
    }

    req = request.Request(
        url=f"{base_url}{path}",
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=20) as response:
            body = json.loads(response.read().decode("utf-8") or "{}")
            external_id = (
                body.get("id")
                or body.get("message_id")
                or body.get("external_message_id")
            )
            return {
                "ok": True,
                "status": "sent",
                "external_message_id": external_id,
                "body": body,
                "sent_at": now_utc(),
            }
    except (error.URLError, error.HTTPError, TimeoutError, json.JSONDecodeError) as exc:
        return {
            "ok": False,
            "status": "failed",
            "reason": str(exc),
        }


def send_photon_notification(
    *,
    recipient: str,
    message_preview: str,
    blueprint_id: str,
    pdf_path: str | None,
) -> dict[str, Any]:
    """Send a Photon notification via a configurable REST endpoint."""
    send_path = os.getenv("PHOTON_SEND_PATH", "/messages")

    if not recipient:
        return {
            "ok": False,
            "status": "skipped",
            "reason": "Photon recipient is missing.",
        }

    payload = {
        "recipient": recipient,
        "message": message_preview,
        "metadata": {
            "blueprint_id": blueprint_id,
            "pdf_path": pdf_path,
        },
    }
    result = _post_photon_json(send_path, payload)
    if result.get("status") == "sent":
        return {
            "ok": True,
            "status": "sent",
            "external_message_id": result.get("external_message_id"),
            "sent_at": result.get("sent_at"),
        }
    return result


def send_photon_spectrum_reply(
    *,
    recipient: str,
    message: str,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Send a reply through a Photon Spectrum-compatible outbound path."""
    send_path = os.getenv("PHOTON_SPECTRUM_SEND_PATH", os.getenv("PHOTON_SEND_PATH", "/messages"))
    if not recipient:
        return {
            "ok": False,
            "status": "skipped",
            "reason": "Photon Spectrum recipient is missing.",
        }

    payload = {
        "recipient": recipient,
        "message": message,
        "metadata": metadata or {},
    }
    return _post_photon_json(send_path, payload)
