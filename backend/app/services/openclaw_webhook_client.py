"""Lazarus → OpenClaw webhook client.

Sends events to the local OpenClaw gateway so OpenClaw can
react to pipeline completions, new assets, etc.
"""

from __future__ import annotations

import logging
import os

import httpx

logger = logging.getLogger(__name__)

OPENCLAW_GATEWAY = os.getenv("OPENCLAW_GATEWAY_URL", "http://127.0.0.1:18789")
OPENCLAW_HOOK_TOKEN = os.getenv("OPENCLAW_HOOK_TOKEN", "lazarus-openclaw-hook-token")


async def _post_hook(path: str, payload: dict) -> dict | None:
    """POST to an OpenClaw hook endpoint. Returns response JSON or None on failure."""
    url = f"{OPENCLAW_GATEWAY}{path}"
    headers = {
        "Authorization": f"Bearer {OPENCLAW_HOOK_TOKEN}",
        "Content-Type": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            return resp.json()
    except httpx.ConnectError:
        logger.debug("OpenClaw gateway not reachable at %s — skipping hook.", url)
        return None
    except httpx.HTTPStatusError as exc:
        logger.warning("OpenClaw hook %s returned %s: %s", path, exc.response.status_code, exc.response.text)
        return None
    except Exception:
        logger.exception("Unexpected error posting to OpenClaw hook %s", path)
        return None


async def notify_pipeline_complete(
    asset_code: str,
    decision: str,
    confidence: float,
    target_disease: str,
) -> dict | None:
    """Wake OpenClaw when a pipeline run finishes."""
    text = (
        f"Lazarus pipeline complete for {asset_code}: "
        f"{decision} (confidence {confidence:.0%}) — {target_disease}"
    )
    return await _post_hook("/hooks/wake", {"text": text, "mode": "now"})


async def trigger_review(
    asset_code: str,
    generate_blueprint: bool = False,
) -> dict | None:
    """Ask OpenClaw to review an asset via mapped hook."""
    return await _post_hook(
        "/hooks/lazarus-review",
        {"asset_code": asset_code, "generate_blueprint": str(generate_blueprint).lower()},
    )


async def trigger_drug_search(query: str) -> dict | None:
    """Ask OpenClaw to search for a drug via mapped hook."""
    return await _post_hook("/hooks/lazarus-search", {"query": query})
