"""Provider-backed LLM helpers with deterministic fallback support."""

from __future__ import annotations

import json
import logging
import os
import time
from typing import Any
from urllib import error, request

K2_CHAT_PATH = "/chat/completions"
OPENAI_CHAT_PATH = "/v1/chat/completions"

logger = logging.getLogger(__name__)


def gemini_chat_completion(
    *,
    model: str = "gemini-2.5-flash",
    system_prompt: str,
    user_prompt: str,
    response_schema: dict[str, Any],
) -> dict[str, Any] | None:
    """Call the Gemini REST API directly."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        logger.debug("[llm] gemini skipped because GEMINI_API_KEY is not set")
        return None

    started = time.monotonic()
    base_url = "https://generativelanguage.googleapis.com/v1beta"
    url = f"{base_url}/models/{model}:generateContent?key={api_key}"

    payload: dict[str, Any] = {
        "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
        "systemInstruction": {"parts": [{"text": system_prompt}]},
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": response_schema,
        },
    }

    headers = {
        "Content-Type": "application/json",
    }

    req = request.Request(
        url=url,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )

    try:
        logger.info("[llm] gemini start model=%s", model)
        with request.urlopen(req, timeout=60) as response:
            body = json.loads(response.read().decode("utf-8"))
    except (error.URLError, error.HTTPError, TimeoutError, json.JSONDecodeError):
        logger.exception("[llm] gemini failed model=%s after %.2fs", model, time.monotonic() - started)
        return None
    finally:
        logger.info("[llm] gemini end model=%s duration=%.2fs", model, time.monotonic() - started)

    try:
        content = body["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError):
        return None

    try:
        return json.loads(content)
    except json.JSONDecodeError:
        return None


def k2_chat_completion(
    *,
    model: str,
    system_prompt: str,
    user_prompt: str,
    response_schema: dict[str, Any],
) -> dict[str, Any] | None:
    """Call K2 Think directly through its OpenAI-compatible API."""
    api_key = os.getenv("K2_API_KEY")
    base_url = os.getenv("K2_API_BASE_URL", "https://api.k2think.ai/v1").rstrip("/")
    if not api_key:
        logger.debug("[llm] k2 skipped because K2_API_KEY is not set")
        return None

    started = time.monotonic()
    payload: dict[str, Any] = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "lazarus_skeptic_output",
                "schema": response_schema,
                "strict": True,
            },
        },
    }

    headers = {
        "accept": "application/json",
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "User-Agent": "curl/8.7.1",
    }

    req = request.Request(
        url=f"{base_url}{K2_CHAT_PATH}",
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )

    try:
        logger.info("[llm] k2 start model=%s", model)
        with request.urlopen(req, timeout=40) as response:
            body = json.loads(response.read().decode("utf-8"))
    except (error.URLError, error.HTTPError, TimeoutError, json.JSONDecodeError):
        logger.exception("[llm] k2 failed model=%s after %.2fs", model, time.monotonic() - started)
        return None
    finally:
        logger.info("[llm] k2 end model=%s duration=%.2fs", model, time.monotonic() - started)

    content = body.get("choices", [{}])[0].get("message", {}).get("content")
    if not content:
        return None

    try:
        return json.loads(content)
    except json.JSONDecodeError:
        return None


def openai_chat_completion(
    *,
    model: str,
    system_prompt: str,
    user_prompt: str,
    response_schema: dict[str, Any],
) -> dict[str, Any] | None:
    """Call OpenAI directly through the Chat Completions API."""
    api_key = os.getenv("OPENAI_API_KEY")
    base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com").rstrip("/")
    if not api_key:
        logger.debug("[llm] openai skipped because OPENAI_API_KEY is not set")
        return None

    started = time.monotonic()
    payload: dict[str, Any] = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "lazarus_openai_output",
                "schema": response_schema,
                "strict": True,
            },
        },
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    req = request.Request(
        url=f"{base_url}{OPENAI_CHAT_PATH}",
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )

    try:
        logger.info("[llm] openai start model=%s", model)
        with request.urlopen(req, timeout=60) as response:
            body = json.loads(response.read().decode("utf-8"))
    except (error.URLError, error.HTTPError, TimeoutError, json.JSONDecodeError):
        logger.exception("[llm] openai failed model=%s after %.2fs", model, time.monotonic() - started)
        return None
    finally:
        logger.info("[llm] openai end model=%s duration=%.2fs", model, time.monotonic() - started)

    content = body.get("choices", [{}])[0].get("message", {}).get("content")
    if not content:
        return None

    try:
        return json.loads(content)
    except json.JSONDecodeError:
        return None
