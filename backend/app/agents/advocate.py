"""Advocate agent implementation."""

from __future__ import annotations

import os

from backend.app.agents.prompts import ADVOCATE_PROMPT
from backend.app.agents.types import AdvocateOutput, AssetContext
from backend.app.services.llm_service import dedalus_chat_completion, gemini_chat_completion


GEMINI_MODEL_NAME = "gemini-2.5-flash"


def run_advocate(context: AssetContext) -> AdvocateOutput:
    """Run the Advocate agent: tries Gemini direct, then Dedalus, then deterministic fallback."""
    advocate_model = os.getenv("DEDALUS_ADVOCATE_MODEL", "google/gemini-2.5-flash")
    gemini_api_key = os.getenv("GEMINI_API_KEY")
    dedalus_api_key = os.getenv("DEDALUS_API_KEY")

    response_schema = {
        "type": "object",
        "properties": {
            "proposed_disease": {"type": "string"},
            "reasoning": {"type": "string"},
            "confidence": {"type": "number"},
        },
        "required": ["proposed_disease", "reasoning", "confidence"],
        "additionalProperties": False,
    }

    user_prompt = (
        "Asset context:\n"
        f"- asset_code: {context.asset_code}\n"
        f"- source_disease: {context.source_disease}\n"
        f"- target: {context.target}\n"
        f"- linked_diseases: {', '.join(context.linked_diseases)}\n"
        f"- adverse_events: {', '.join(context.adverse_events)}\n"
        "Return one best repurposed disease."
    )

    # --- Try 1: Gemini direct (no Dedalus credits needed) ---
    llm_output = gemini_chat_completion(
        model=GEMINI_MODEL_NAME,
        system_prompt=ADVOCATE_PROMPT,
        user_prompt=user_prompt,
        response_schema=response_schema,
    )
    if llm_output:
        try:
            return AdvocateOutput(
                proposed_disease=str(llm_output["proposed_disease"]),
                reasoning=str(llm_output["reasoning"]),
                confidence=float(llm_output["confidence"]),
                model_used=GEMINI_MODEL_NAME,
                mode="gemini_live",
            )
        except (KeyError, TypeError, ValueError):
            pass

    # --- Try 2: Dedalus SDK/HTTP ---
    llm_output = dedalus_chat_completion(
        model=advocate_model,
        system_prompt=ADVOCATE_PROMPT,
        user_prompt=user_prompt,
        response_schema=response_schema,
        provider=os.getenv("DEDALUS_GEMINI_PROVIDER", "google"),
        provider_key=gemini_api_key,
    )
    if llm_output:
        try:
            return AdvocateOutput(
                proposed_disease=str(llm_output["proposed_disease"]),
                reasoning=str(llm_output["reasoning"]),
                confidence=float(llm_output["confidence"]),
                model_used=advocate_model,
                mode="dedalus_live",
            )
        except (KeyError, TypeError, ValueError):
            pass

    # --- Fallback: deterministic ---
    proposed_disease = context.linked_diseases[0] if context.linked_diseases else context.source_disease
    confidence = 0.84 if proposed_disease != context.source_disease else 0.61
    reasoning = (
        f"{context.target} pathway overlap suggests {context.asset_code} could translate from "
        f"{context.source_disease} into {proposed_disease}, especially given the mock linked disease map."
    )

    return AdvocateOutput(
        proposed_disease=proposed_disease,
        reasoning=reasoning,
        confidence=confidence,
        model_used=advocate_model or GEMINI_MODEL_NAME,
        mode="deterministic_fallback" if not dedalus_api_key else "dedalus_fallback",
    )
