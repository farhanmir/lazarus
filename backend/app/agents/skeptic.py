"""Skeptic agent implementation."""

from __future__ import annotations

import os

from backend.app.agents.prompts import SKEPTIC_PROMPT
from backend.app.agents.types import AdvocateOutput, AssetContext, SkepticOutput
from backend.app.services.llm_service import dedalus_chat_completion, k2_chat_completion


K2_MODEL_NAME = "k2-think-v2"

TARGET_CONFLICTS = {
    ("JAK1", "Lupus"): [],
    ("CGRP", "Fibromyalgia"): ["Mechanistic translation is indirect compared with inflammatory diseases."],
    ("TNF-alpha", "Rheumatoid Arthritis"): [],
    ("TGF-beta", "Pulmonary Fibrosis"): [],
}


def run_skeptic(context: AssetContext, advocate: AdvocateOutput) -> SkepticOutput:
    """Run the Skeptic agent with deterministic fallback logic."""
    dedalus_api_key = os.getenv("DEDALUS_API_KEY")
    k2_api_key = os.getenv("K2_API_KEY")
    skeptic_model = os.getenv("K2_MODEL", "MBZUAI-IFM/K2-Think-v2")

    response_schema = {
        "type": "object",
        "properties": {
            "risk_level": {"type": "string"},
            "contraindications": {
                "type": "array",
                "items": {"type": "string"},
            },
            "conflict_summary": {"type": "string"},
            "skeptic_score": {"type": "number"},
            "verdict": {"type": "string"},
        },
        "required": [
            "risk_level",
            "contraindications",
            "conflict_summary",
            "skeptic_score",
            "verdict",
        ],
        "additionalProperties": False,
    }
    user_prompt = (
        "Asset context and advocate proposal:\n"
        f"- asset_code: {context.asset_code}\n"
        f"- source_disease: {context.source_disease}\n"
        f"- target: {context.target}\n"
        f"- adverse_events: {', '.join(context.adverse_events)}\n"
        f"- proposed_disease: {advocate.proposed_disease}\n"
        f"- advocate_reasoning: {advocate.reasoning}\n"
        "Return only structured JSON."
    )
    llm_output = k2_chat_completion(
        model=skeptic_model,
        system_prompt=SKEPTIC_PROMPT,
        user_prompt=user_prompt,
        response_schema=response_schema,
    )
    if llm_output:
        try:
            return SkepticOutput(
                risk_level=str(llm_output["risk_level"]),
                contraindications=[str(item) for item in llm_output["contraindications"]],
                conflict_summary=str(llm_output["conflict_summary"]),
                skeptic_score=float(llm_output["skeptic_score"]),
                verdict=str(llm_output["verdict"]),
                model_used=skeptic_model,
                mode="k2_live",
            )
        except (KeyError, TypeError, ValueError):
            pass

    dedalus_model = os.getenv("DEDALUS_SKEPTIC_MODEL", K2_MODEL_NAME)
    llm_output = dedalus_chat_completion(
        model=dedalus_model,
        system_prompt=SKEPTIC_PROMPT,
        user_prompt=user_prompt,
        response_schema=response_schema,
    )
    if llm_output:
        try:
            return SkepticOutput(
                risk_level=str(llm_output["risk_level"]),
                contraindications=[str(item) for item in llm_output["contraindications"]],
                conflict_summary=str(llm_output["conflict_summary"]),
                skeptic_score=float(llm_output["skeptic_score"]),
                verdict=str(llm_output["verdict"]),
                model_used=dedalus_model,
                mode="dedalus_live",
            )
        except (KeyError, TypeError, ValueError):
            pass

    contraindications = list(context.adverse_events)
    target_conflicts = TARGET_CONFLICTS.get((context.target, advocate.proposed_disease), [])
    combined_conflicts = contraindications + target_conflicts

    if len(combined_conflicts) >= 3:
        risk_level = "High"
        skeptic_score = 0.58
        verdict = "Major conflicts identified"
    elif combined_conflicts:
        risk_level = "Medium"
        skeptic_score = 0.76
        verdict = "No major conflicts"
    else:
        risk_level = "Low"
        skeptic_score = 0.83
        verdict = "Context is favorable"

    conflict_summary = (
        "No major disease-level contraindications found in current context."
        if not combined_conflicts
        else " ".join(
            [
                f"Observed concerns include {', '.join(contraindications)}." if contraindications else "",
                f"Target/disease conflicts: {', '.join(target_conflicts)}." if target_conflicts else "",
            ]
        ).strip()
    )

    return SkepticOutput(
        risk_level=risk_level,
        contraindications=combined_conflicts,
        conflict_summary=conflict_summary,
        skeptic_score=skeptic_score,
        verdict=verdict,
        model_used=skeptic_model,
        mode=(
            "deterministic_fallback"
            if not k2_api_key and not dedalus_api_key
            else "k2_fallback"
            if k2_api_key
            else "dedalus_fallback"
        ),
    )
