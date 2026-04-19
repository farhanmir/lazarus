"""Judge agent: synthesises the final verdict.

Consumes the Advocate proposal, Skeptic critique, and curated evidence, then
emits a ``final_confidence`` score and ``final_recommendation`` that the rest
of the product (blueprints, portfolio ranking, HITL gate) keys off.
"""

from __future__ import annotations

import logging
import os

from backend.app.agents.prompts import JUDGE_PROMPT
from backend.app.agents.types import (
    AdvocateOutput,
    AssetContext,
    EvidenceCuratorOutput,
    JudgeOutput,
    SkepticOutput,
)
from backend.app.services.llm_service import gemini_chat_completion, openai_chat_completion


OPENAI_JUDGE_MODEL_NAME = "gpt-4o"
GEMINI_JUDGE_MODEL_NAME = "gemini-2.5-flash"
logger = logging.getLogger(__name__)


def _env_flag(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def run_judge(
    context: AssetContext,
    advocate: AdvocateOutput,
    skeptic: SkepticOutput,
    evidence: EvidenceCuratorOutput,
) -> JudgeOutput:
    """Synthesize the final decision: tries OpenAI direct, optional Gemini second, then deterministic."""
    judge_model = os.getenv("OPENAI_JUDGE_MODEL", OPENAI_JUDGE_MODEL_NAME)
    gemini_model = os.getenv("GEMINI_JUDGE_MODEL", GEMINI_JUDGE_MODEL_NAME)
    enable_gemini_fallback = _env_flag("ENABLE_GEMINI_JUDGE", default=False)

    logger.info("[agent:judge] start asset=%s proposal=%s", context.asset_code, advocate.proposed_disease)
    response_schema = {
        "type": "object",
        "properties": {
            "final_decision": {"type": "string"},
            "summary": {"type": "string"},
            "judge_score": {"type": "number"},
            "final_confidence": {"type": "number"},
            "recommended_next_step": {"type": "string"},
        },
        "required": [
            "final_decision",
            "summary",
            "judge_score",
            "final_confidence",
            "recommended_next_step",
        ],
        "additionalProperties": False,
    }

    user_prompt = (
        "Synthesize the following outputs into a final decision.\n"
        f"asset_code: {context.asset_code}\n"
        f"source_disease: {context.source_disease}\n"
        f"target: {context.target}\n"
        f"advocate: {advocate.model_dump_json()}\n"
        f"skeptic: {skeptic.model_dump_json()}\n"
        f"evidence: {evidence.model_dump_json()}\n"
    )

    # --- Try 1: OpenAI direct ---
    llm_output = openai_chat_completion(
        model=judge_model,
        system_prompt=JUDGE_PROMPT,
        user_prompt=user_prompt,
        response_schema=response_schema,
    )
    if llm_output:
        try:
            logger.info("[agent:judge] resolved via openai_live asset=%s model=%s", context.asset_code, judge_model)
            return JudgeOutput(
                final_decision=str(llm_output["final_decision"]),
                summary=str(llm_output["summary"]),
                judge_score=float(llm_output["judge_score"]),
                final_confidence=float(llm_output["final_confidence"]),
                recommended_next_step=str(llm_output["recommended_next_step"]),
                model_used=judge_model,
                mode="openai_live",
            )
        except (KeyError, TypeError, ValueError):
            pass

    if enable_gemini_fallback:
        llm_output = gemini_chat_completion(
            model=gemini_model,
            system_prompt=JUDGE_PROMPT,
            user_prompt=user_prompt,
            response_schema=response_schema,
        )
        if llm_output:
            try:
                logger.info("[agent:judge] resolved via gemini_fallback asset=%s model=%s", context.asset_code, gemini_model)
                return JudgeOutput(
                    final_decision=str(llm_output["final_decision"]),
                    summary=str(llm_output["summary"]),
                    judge_score=float(llm_output["judge_score"]),
                    final_confidence=float(llm_output["final_confidence"]),
                    recommended_next_step=str(llm_output["recommended_next_step"]),
                    model_used=gemini_model,
                    mode="gemini_fallback",
                )
            except (KeyError, TypeError, ValueError):
                pass

    # --- Fallback: deterministic ---
    final_confidence = round(
        (advocate.confidence * 0.4) + (skeptic.skeptic_score * 0.3) + (evidence.evidence_score * 0.3),
        2,
    )

    if final_confidence >= 0.8:
        final_decision = "Recommend Further Study"
        recommended_next_step = "Proceed to exploratory validation"
    elif final_confidence >= 0.65:
        final_decision = "Review with Caution"
        recommended_next_step = "Perform focused mechanism and safety review"
    else:
        final_decision = "Do Not Prioritize"
        recommended_next_step = "Archive and revisit only if stronger evidence emerges"

    risk_phrase = {
        "Low": "low observed risk",
        "Medium": "moderate observed risk",
        "High": "high observed risk",
    }.get(skeptic.risk_level, "moderate observed risk")

    summary = (
        f"{context.asset_code} shows plausible repurposing potential for {advocate.proposed_disease} "
        f"due to {context.target}-linked pathway overlap, with {risk_phrase} in the current mock evidence set."
    )
    logger.info(
        "[agent:judge] fallback asset=%s mode=%s final_confidence=%.2f",
        context.asset_code,
        "deterministic",
        final_confidence,
    )

    return JudgeOutput(
        final_decision=final_decision,
        summary=summary,
        judge_score=final_confidence,
        final_confidence=final_confidence,
        recommended_next_step=recommended_next_step,
        model_used=gemini_model if enable_gemini_fallback else judge_model,
        mode="deterministic",
    )
