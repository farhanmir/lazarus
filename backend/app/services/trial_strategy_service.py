"""Deterministic Trial Strategist service for post-judge action planning."""

from __future__ import annotations

from backend.app.agents.types import TrialStrategyInput, TrialStrategyOutput

COHORT_MAP = {
    "lupus": "Adults with moderate Lupus",
    "rheumatoid arthritis": "Adults with active Rheumatoid Arthritis",
    "fibromyalgia": "Adults with moderate Fibromyalgia",
    "pulmonary fibrosis": "Adults with progressive Pulmonary Fibrosis",
}


def _priority_level(confidence: float, risk_level: str) -> str:
    if risk_level == "High":
        return "Low"
    if confidence >= 0.8:
        return "High"
    if confidence >= 0.6:
        return "Medium"
    return "Low"


def _recommended_action(confidence: float, risk_level: str, phase: str | None) -> str:
    normalized_phase = (phase or "").lower()
    if risk_level == "High":
        return "Defer repurposing program and archive pending additional safety evidence"
    if confidence >= 0.8 and "phase 2" in normalized_phase:
        return "Design exploratory Phase 2a repurposing review"
    if confidence >= 0.8:
        return "Proceed to exploratory validation"
    if confidence >= 0.6:
        return "Run focused diligence review before clinical commitment"
    return "Archive and revisit only if stronger evidence emerges"


def _patient_cohort(proposed_indication: str) -> str:
    return COHORT_MAP.get(
        proposed_indication.lower(),
        "Adults with target-related disease markers",
    )


def _trial_focus(confidence: float, risk_level: str, evidence_summary: list[str], phase: str | None) -> str:
    normalized_phase = (phase or "").lower()
    evidence_text = " ".join(evidence_summary).lower()
    if risk_level == "High":
        return "Safety validation and no-go criteria review"
    if "biomarker" in evidence_text:
        return "Biomarker validation and target engagement"
    if "phase 1" in normalized_phase:
        return "Dose optimization and early signal detection"
    if confidence >= 0.8:
        return "Safety validation and biomarker response"
    return "Target engagement and cohort refinement"


def _business_rationale(payload: TrialStrategyInput, priority_level: str) -> str:
    failure_reason = payload.business_failure_reason or "non-scientific program pressure"
    evidence_strength = "supportive evidence" if payload.evidence_summary else "limited evidence"
    if priority_level == "Low":
        return (
            f"Asset history shows {failure_reason} with elevated execution risk. "
            f"Current confidence is insufficient to justify near-term investment."
        )
    return (
        f"Asset failed due to {failure_reason} and still shows reusable safety or mechanism potential. "
        f"{evidence_strength.capitalize()} supports a focused next-stage review."
    )


def generate_trial_strategy(payload: TrialStrategyInput) -> TrialStrategyOutput:
    """Generate deterministic post-judge next-step guidance."""
    priority_level = _priority_level(payload.final_confidence, payload.risk_level)
    return TrialStrategyOutput(
        recommended_action=_recommended_action(
            payload.final_confidence,
            payload.risk_level,
            payload.phase,
        ),
        suggested_patient_cohort=_patient_cohort(payload.proposed_indication),
        trial_focus=_trial_focus(
            payload.final_confidence,
            payload.risk_level,
            payload.evidence_summary,
            payload.phase,
        ),
        business_rationale=_business_rationale(payload, priority_level),
        priority_level=priority_level,
        model_used="deterministic-trial-strategist",
        mode="deterministic",
    )
