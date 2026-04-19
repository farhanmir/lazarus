"""Portfolio ranking routes."""

from __future__ import annotations

import json
from collections import Counter
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.app import crud, schemas
from backend.app.db import get_db

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


def _safe_json(payload: str | None) -> dict:
    if not payload:
        return {}
    try:
        value = json.loads(payload)
    except (TypeError, ValueError):
        return {}
    return value if isinstance(value, dict) else {}


def _get_latest_hypothesis(asset_id, db: Session):
    hypotheses = crud.list_hypotheses_by_asset(db, asset_id)
    return hypotheses[0] if hypotheses else None


def _risk_weight(risk_level: str | None) -> float:
    normalized = (risk_level or "").strip().lower()
    if normalized == "low":
        return 1.0
    if normalized == "medium":
        return 0.72
    if normalized == "high":
        return 0.38
    return 0.55


@router.get("/ranking", response_model=schemas.PortfolioRankingResponse)
def get_portfolio_ranking(db: Session = Depends(get_db)):
    assets = crud.list_assets(db)
    reviews = crud.list_human_reviews_with_context(db)
    pending_review_counts = Counter(
        review.asset_id for review in reviews if review.status == "pending"
    )

    items: list[schemas.PortfolioAssetSummary] = []
    for asset in assets:
        hypothesis = _get_latest_hypothesis(asset.id, db)
        run = crud.get_run(db, hypothesis.run_id) if hypothesis else None
        effort = crud.get_latest_effort_analysis_by_asset(db, asset.id)
        impact = crud.get_latest_impact_analysis_by_asset(db, asset.id)
        skeptic_step = None
        if run is not None:
            steps = crud.list_steps_by_run(db, run.id)
            skeptic_step = next((step for step in steps if "skeptic" in step.agent_name), None)
        skeptic_payload = _safe_json(skeptic_step.output_summary if skeptic_step else None)
        risk_level = skeptic_payload.get("risk_level")

        readiness = None
        if effort is not None and impact is not None:
            readiness = round(impact.impact_score * (1.0 - effort.effort_score), 3)

        confidence = hypothesis.final_confidence if hypothesis else None
        confidence_score = confidence if isinstance(confidence, (int, float)) else 0.0
        impact_score = impact.impact_score if impact is not None else 0.0
        effort_score = effort.effort_score if effort is not None else 0.5
        hitl_penalty = 0.18 if hypothesis and hypothesis.requires_hitl else 0.0
        review_penalty = min(0.18, pending_review_counts.get(asset.id, 0) * 0.06)

        rank_score = (
            (confidence_score * 0.35)
            + (impact_score * 0.30)
            + (((1.0 - effort_score) if effort is not None else 0.4) * 0.20)
            + (_risk_weight(risk_level) * 0.15)
            - hitl_penalty
            - review_penalty
        )

        items.append(
            schemas.PortfolioAssetSummary(
                asset_id=asset.id,
                asset_code=asset.asset_code,
                internal_name=asset.internal_name,
                original_indication=asset.original_indication,
                portfolio_status=asset.portfolio_status,
                owner_company=asset.owner_company,
                latest_run_id=run.id if run else None,
                latest_run_status=run.status if run else None,
                latest_hypothesis_id=hypothesis.id if hypothesis else None,
                proposed_indication=hypothesis.target_disease if hypothesis else None,
                final_confidence=confidence,
                final_recommendation=run.final_recommendation if run else None,
                risk_level=risk_level,
                priority_level=hypothesis.priority_level if hypothesis else None,
                requires_hitl=hypothesis.requires_hitl if hypothesis else False,
                open_review_count=pending_review_counts.get(asset.id, 0),
                effort_score=effort.effort_score if effort else None,
                impact_score=impact.impact_score if impact else None,
                investment_readiness_score=readiness,
                portfolio_rank_score=round(max(rank_score, 0.0), 3),
            )
        )

    items.sort(
        key=lambda item: (
            item.portfolio_rank_score,
            item.investment_readiness_score or -1,
            item.final_confidence or -1,
        ),
        reverse=True,
    )

    return schemas.PortfolioRankingResponse(
        generated_at=datetime.now(timezone.utc),
        items=items,
    )
