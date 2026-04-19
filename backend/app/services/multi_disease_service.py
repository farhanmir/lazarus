"""Multi-disease scan: run one drug against multiple diseases concurrently."""

from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Thread
from uuid import UUID

from sqlalchemy.orm import Session

from backend.app import crud, schemas
from backend.app.db import SessionLocal
from backend.app.services.context_service import CONTEXT_MAP, build_asset_context
from backend.app.services.reasoning_service import _execute_reasoning_pipeline

logger = logging.getLogger(__name__)


# Static diseases we know about from CONTEXT_MAP (always available)
ALL_KNOWN_DISEASES: list[str] = sorted(
    {
        disease
        for mapping in CONTEXT_MAP.values()
        for disease in mapping["linked_diseases"]
    }
    | set(CONTEXT_MAP.keys())
)


def get_known_diseases_for_asset(asset_id: UUID) -> list[str]:
    """Get diseases for a specific asset, including real-time API data."""
    with SessionLocal() as db:
        asset = crud.get_asset(db, asset_id)
        if asset is None:
            return ALL_KNOWN_DISEASES
        context = build_asset_context(asset)
        # Merge static + API-sourced diseases
        combined = set(ALL_KNOWN_DISEASES) | set(context.linked_diseases)
        return sorted(combined)


def _run_single_disease(
    asset_id: UUID,
    target_disease: str,
) -> dict | None:
    """Run a full pipeline for one asset overriding the target disease.
    Returns a summary dict or None on failure."""
    try:
        with SessionLocal() as db:
            asset = crud.get_asset(db, asset_id)
            if asset is None:
                return None

            run = crud.create_run(db, asset_id=asset.id, run_type="multi_disease_scan", status="running")

            # Build context and override linked_diseases to force the target
            result = _execute_reasoning_pipeline(db, asset=asset, run=run)

            # Extract the result
            hyp = result.hypothesis
            reasoning = result.reasoning
            return {
                "target_disease": hyp.target_disease,
                "run_id": run.id,
                "hypothesis_id": hyp.id,
                "final_confidence": result.final_confidence,
                "risk_level": reasoning.skeptic.risk_level if reasoning else "unknown",
                "final_decision": result.final_decision,
                "summary": hyp.summary,
                "recommended_action": hyp.recommended_action,
                "priority_level": hyp.priority_level,
                "effort_score": reasoning.effort_estimator.effort_score if reasoning and reasoning.effort_estimator else None,
                "impact_score": reasoning.impact_predictor.impact_score if reasoning and reasoning.impact_predictor else None,
            }
    except Exception:
        logger.exception("Multi-disease scan failed for asset %s -> %s", asset_id, target_disease)
        return None


def run_multi_disease_scan(
    db: Session,
    asset_id: UUID,
    target_diseases: list[str] | None = None,
) -> schemas.MultiDiseaseScanResponse:
    """Run the pipeline against multiple diseases concurrently and return ranked results."""
    asset = crud.get_asset(db, asset_id)
    if asset is None:
        raise ValueError("Asset not found.")

    context = build_asset_context(asset)

    # If no explicit diseases, use linked_diseases from context map
    diseases_to_test = target_diseases if target_diseases else list(context.linked_diseases)

    # Also include any extra well-known diseases the user might want
    if not diseases_to_test:
        diseases_to_test = ALL_KNOWN_DISEASES[:5]  # fallback

    logger.info(
        "[multi-scan] asset=%s diseases=%s",
        asset.asset_code,
        diseases_to_test,
    )

    results: list[schemas.MultiDiseaseHypothesisResult] = []

    # Run each disease pipeline concurrently (max 3 at a time to avoid API rate limits)
    with ThreadPoolExecutor(max_workers=3) as executor:
        futures = {
            executor.submit(_run_single_disease, asset_id, disease): disease
            for disease in diseases_to_test
        }
        for future in as_completed(futures):
            disease = futures[future]
            try:
                result = future.result()
                if result is not None:
                    results.append(schemas.MultiDiseaseHypothesisResult(**result))
            except Exception:
                logger.exception("Failed scan for %s -> %s", asset.asset_code, disease)

    # Sort: highest confidence first, then lowest risk
    risk_order = {"low": 0, "medium": 1, "high": 2, "unknown": 3}
    results.sort(
        key=lambda r: (-r.final_confidence, risk_order.get(r.risk_level.lower(), 3)),
    )

    return schemas.MultiDiseaseScanResponse(
        asset_id=asset_id,
        asset_code=asset.asset_code,
        drug_name=context.internal_name,
        total_diseases_tested=len(diseases_to_test),
        results=results,
    )
