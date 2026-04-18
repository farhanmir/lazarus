"""Effort Estimator agent — deterministic cost/time/complexity estimation."""

from __future__ import annotations

from backend.app.agents.types import EffortEstimatorInput, EffortEstimatorOutput


# Base costs by risk level
_COST_BY_RISK = {
    "High": 12_000_000,
    "Medium": 6_000_000,
    "Low": 3_000_000,
}

# Time (months) by risk level
_TIME_BY_RISK = {
    "High": 36,
    "Medium": 24,
    "Low": 12,
}


def _trial_complexity(risk_level: str, evidence_count: int) -> str:
    if risk_level == "High":
        return "High"
    if evidence_count < 3:
        return "High"
    if risk_level == "Medium" and evidence_count < 6:
        return "Medium"
    if risk_level == "Low" and evidence_count >= 6:
        return "Low"
    return "Medium"


def _effort_score(risk_level: str, evidence_count: int, confidence: float) -> float:
    """0 = trivial, 1 = extremely hard. Higher risk / fewer evidence = harder."""
    risk_weight = {"High": 0.45, "Medium": 0.25, "Low": 0.10}.get(risk_level, 0.3)
    evidence_penalty = max(0.0, 0.35 - evidence_count * 0.03)
    confidence_bonus = (1.0 - confidence) * 0.2
    return round(min(1.0, risk_weight + evidence_penalty + confidence_bonus), 3)


def run_effort_estimator(inp: EffortEstimatorInput) -> EffortEstimatorOutput:
    risk = inp.risk_level if inp.risk_level in _COST_BY_RISK else "Medium"

    base_cost = _COST_BY_RISK[risk]
    # Adjust cost by evidence (more evidence → slightly cheaper)
    evidence_discount = min(inp.evidence_count * 0.02, 0.20)
    estimated_cost = int(base_cost * (1.0 - evidence_discount))

    base_time = _TIME_BY_RISK[risk]
    # High confidence shaves time
    if inp.confidence >= 0.8:
        base_time = int(base_time * 0.85)

    complexity = _trial_complexity(risk, inp.evidence_count)
    score = _effort_score(risk, inp.evidence_count, inp.confidence)

    return EffortEstimatorOutput(
        estimated_cost_usd=estimated_cost,
        estimated_time_months=base_time,
        trial_complexity=complexity,
        effort_score=score,
    )
