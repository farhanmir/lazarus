"""Spectrum messaging delivery service."""

from __future__ import annotations

import json
import os
from pathlib import Path
from datetime import datetime, timezone
from typing import Any
from urllib import error, request

STATE_PATH = Path("/tmp/lazarus-spectrum-state.json")


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _spectrum_local_mode_enabled() -> bool:
    return os.getenv("IMESSAGE_LOCAL", "").strip().lower() in {"1", "true", "yes", "on"}


def _get_project_credentials() -> tuple[str | None, str | None]:
    project_id = os.getenv("SPECTRUM_PROJECT_ID", "").strip() or None
    secret_key = os.getenv("SPECTRUM_SECRET_KEY", "").strip() or None
    return project_id, secret_key


def remember_active_spectrum_recipient(recipient: str) -> None:
    normalized = recipient.strip()
    if not normalized:
        return

    payload = {
        "last_recipient": normalized,
        "updated_at": now_utc().isoformat(),
    }
    try:
        STATE_PATH.write_text(json.dumps(payload), encoding="utf-8")
    except OSError:
        return


def _load_last_active_recipient() -> str | None:
    try:
        raw = STATE_PATH.read_text(encoding="utf-8")
        payload = json.loads(raw)
    except (OSError, json.JSONDecodeError):
        return None
    return str(payload.get("last_recipient", "")).strip() or None


def resolve_spectrum_recipient(explicit_recipient: str | None = None) -> str | None:
    normalized = (explicit_recipient or "").strip() or None
    if normalized and not normalized.startswith("+"):
        return normalized

    cached = _load_last_active_recipient()
    if cached:
        return cached

    return normalized or (os.getenv("SPECTRUM_RECIPIENT", "").strip() or None)


def _format_confidence_percent(final_confidence: float) -> float:
    if final_confidence <= 1:
        return round(final_confidence * 100, 1)
    return round(final_confidence, 1)


def _post_spectrum_json(path: str, payload: dict[str, Any]) -> dict[str, Any]:
    base_url = os.getenv("SPECTRUM_BASE_URL", "").rstrip("/")
    project_id, secret_key = _get_project_credentials()

    if _spectrum_local_mode_enabled():
        if not base_url:
            return {
                "ok": False,
                "status": "skipped",
                "reason": "Spectrum local iMessage mode is enabled, but no local bridge base URL is configured.",
            }

        headers = {
            "Content-Type": "application/json",
        }
    else:
        if not base_url or not project_id or not secret_key:
            return {
                "ok": False,
                "status": "skipped",
                "reason": "Spectrum configuration is incomplete for hosted outbound sends.",
            }

        headers = {
            "Content-Type": "application/json",
            # Inference: hosted Spectrum integrations commonly use project-scoped secrets.
            "Authorization": f"Bearer {secret_key}",
            "X-Spectrum-Project-ID": project_id,
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


def send_spectrum_notification(
    *,
    recipient: str,
    message_preview: str,
    blueprint_id: str,
    pdf_path: str | None,
) -> dict[str, Any]:
    send_path = os.getenv("SPECTRUM_SEND_PATH", "/messages")
    recipient = resolve_spectrum_recipient(recipient) or ""
    if not recipient:
        return {
            "ok": False,
            "status": "skipped",
            "reason": "Spectrum recipient is missing.",
        }

    payload = {
        "recipient": recipient,
        "message": message_preview,
        "metadata": {
            "blueprint_id": blueprint_id,
            "pdf_path": pdf_path,
        },
    }
    result = _post_spectrum_json(send_path, payload)
    if result.get("status") == "sent":
        return {
            "ok": True,
            "status": "sent",
            "external_message_id": result.get("external_message_id"),
            "sent_at": result.get("sent_at"),
        }
    return result


def send_spectrum_reply(
    *,
    recipient: str,
    message: str,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    send_path = os.getenv("SPECTRUM_REPLY_PATH", os.getenv("SPECTRUM_SEND_PATH", "/messages"))
    recipient = resolve_spectrum_recipient(recipient) or ""
    if not recipient:
        return {
            "ok": False,
            "status": "skipped",
            "reason": "Spectrum recipient is missing.",
        }

    payload = {
        "recipient": recipient,
        "message": message,
        "metadata": metadata or {},
    }
    return _post_spectrum_json(send_path, payload)


def send_spectrum_run_summary(
    *,
    recipient: str,
    asset_code: str,
    target_disease: str,
    final_decision: str,
    final_confidence: float,
    recommended_action: str,
) -> dict[str, Any]:
    confidence_percent = _format_confidence_percent(final_confidence)
    message = (
        f"Lazarus update: {asset_code}\n"
        f"Decision: {final_decision}\n"
        f"Target: {target_disease}\n"
        f"Confidence: {confidence_percent}%\n"
        f"Next: {recommended_action}"
    )
    return send_spectrum_reply(
        recipient=recipient,
        message=message,
        metadata={
            "source": "dashboard-run",
            "asset_code": asset_code,
            "target_disease": target_disease,
        },
    )
