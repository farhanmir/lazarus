"""Evidence engine for blueprint generation."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from backend.app import crud, schemas
from backend.app.models import AgentStep


def _safe_load_json(value: str | None) -> dict | list | None:
    if not value:
        return None
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return None


def _extract_evidence_from_steps(steps: list[AgentStep]) -> list[schemas.BlueprintEvidenceItem]:
    evidence_items: list[schemas.BlueprintEvidenceItem] = []
    for step in steps:
        if step.agent_name != "evidence_curator":
            continue

        if isinstance(step.citations_json, list):
            for item in step.citations_json:
                if isinstance(item, dict) and {"source_ref", "title", "snippet", "evidence_type"} <= item.keys():
                    evidence_items.append(schemas.BlueprintEvidenceItem(**item))
            continue

        parsed = _safe_load_json(step.output_summary)
        if isinstance(parsed, dict):
            for item in parsed.get("evidence", []):
                if isinstance(item, dict):
                    evidence_items.append(schemas.BlueprintEvidenceItem(**item))

    return evidence_items


def _extract_risk_summary(steps: list[AgentStep]) -> str:
    details = _extract_risk_details(steps)
    contraindications = details["contraindications"]
    if contraindications:
        return (
            f"Risk level: {details['risk_level']}. {details['conflict_summary']} "
            f"Observed concerns: {', '.join(contraindications)}."
        )
    return f"Risk level: {details['risk_level']}. {details['conflict_summary']}"


def _extract_risk_details(steps: list[AgentStep]) -> dict[str, str | list[str]]:
    for step in steps:
        if step.agent_name != "skeptic":
            continue
        parsed = _safe_load_json(step.output_summary)
        if isinstance(parsed, dict):
            risk_level = parsed.get("risk_level", "Unknown")
            conflict_summary = parsed.get("conflict_summary", "No explicit skeptic summary available.")
            contraindications = parsed.get("contraindications", [])
            return {
                "risk_level": str(risk_level),
                "conflict_summary": str(conflict_summary),
                "contraindications": [str(item) for item in contraindications],
            }
    return {
        "risk_level": "Unknown",
        "conflict_summary": "No skeptic output was found for this hypothesis.",
        "contraindications": [],
    }


def _extract_trial_strategy(steps: list[AgentStep]) -> dict[str, str]:
    for step in steps:
        if step.agent_name != "trial_strategist":
            continue
        parsed = _safe_load_json(step.output_summary)
        if isinstance(parsed, dict):
            return {
                "recommended_action": str(parsed.get("recommended_action", "Review strategy not available.")),
                "suggested_patient_cohort": str(
                    parsed.get("suggested_patient_cohort", "Adults with target-related disease markers")
                ),
                "trial_focus": str(parsed.get("trial_focus", "Safety validation")),
                "priority_level": str(parsed.get("priority_level", "Medium")),
                "business_rationale": str(
                    parsed.get("business_rationale", "Further business review is required.")
                ),
            }
    return {
        "recommended_action": "Review strategy not available.",
        "suggested_patient_cohort": "Adults with target-related disease markers",
        "trial_focus": "Safety validation",
        "priority_level": "Medium",
        "business_rationale": "Further business review is required.",
    }


def build_blueprint_payload(db: Session, hypothesis_id: UUID) -> schemas.BlueprintPayload:
    """Assemble the executive blueprint payload from a final hypothesis and run trace."""
    hypothesis = crud.get_hypothesis(db, hypothesis_id)
    if hypothesis is None:
        raise ValueError("Hypothesis not found.")

    asset = crud.get_asset(db, hypothesis.asset_id)
    if asset is None:
        raise ValueError("Asset not found for hypothesis.")

    run = crud.get_run(db, hypothesis.run_id)
    if run is None:
        raise ValueError("Run not found for hypothesis.")

    evidence_items = _extract_evidence_from_steps(run.steps)
    risk_details = _extract_risk_details(run.steps)
    risk_summary = _extract_risk_summary(run.steps)
    trial_strategy = _extract_trial_strategy(run.steps)
    recommendation = run.final_recommendation or "Review"
    confidence = hypothesis.final_confidence or 0.0
    confidence_display = confidence * 100 if confidence <= 1 else confidence
    technical_summary = (
        f"The Advocate scored {hypothesis.advocate_score or 0:.2f}, "
        f"the Skeptic scored {hypothesis.skeptic_score or 0:.2f}, and the Judge scored {hypothesis.judge_score or 0:.2f}. "
        f"Final confidence was normalized to {confidence_display:.1f}% for executive review."
    )

    return schemas.BlueprintPayload(
        drug_name=asset.internal_name,
        asset_code=asset.asset_code,
        owner_company=asset.owner_company,
        phase=asset.phase,
        business_failure_reason=asset.business_failure_reason,
        original_indication=hypothesis.source_disease,
        proposed_indication=hypothesis.target_disease,
        executive_summary=hypothesis.summary,
        supporting_evidence=evidence_items,
        risk_level=str(risk_details["risk_level"]),
        risk_summary=risk_summary,
        confidence_score=confidence,
        recommendation=recommendation,
        generated_at=datetime.now(timezone.utc),
        technical_summary=technical_summary,
        advocate_score=hypothesis.advocate_score,
        skeptic_score=hypothesis.skeptic_score,
        judge_score=hypothesis.judge_score,
        recommended_action=trial_strategy["recommended_action"],
        suggested_patient_cohort=trial_strategy["suggested_patient_cohort"],
        trial_focus=trial_strategy["trial_focus"],
        priority_level=trial_strategy["priority_level"],
        business_rationale=trial_strategy["business_rationale"],
    )
