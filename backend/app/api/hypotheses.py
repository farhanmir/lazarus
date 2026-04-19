"""Hypothesis routes."""

from __future__ import annotations

from math import isnan
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app import crud, schemas
from backend.app.db import get_db

router = APIRouter(tags=["hypotheses"])


@router.get("/hypotheses", response_model=list[schemas.HypothesisResponse])
def list_hypotheses(db: Session = Depends(get_db)):
    return crud.list_hypotheses(db)


@router.get("/hypothesis/{hypothesis_id}", response_model=schemas.HypothesisResponse)
def get_hypothesis(hypothesis_id: UUID, db: Session = Depends(get_db)):
    hypothesis = crud.get_hypothesis(db, hypothesis_id)
    if hypothesis is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hypothesis not found.")
    return hypothesis


@router.get("/assets/{asset_id}/hypotheses/compare", response_model=schemas.HypothesisComparisonResponse)
def compare_hypotheses_for_asset(asset_id: UUID, db: Session = Depends(get_db)):
    asset = crud.get_asset(db, asset_id)
    if asset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found.")

    hypotheses = crud.list_hypotheses_by_asset(db, asset_id)
    if not hypotheses:
        return schemas.HypothesisComparisonResponse(
            asset_id=asset.id,
            asset_code=asset.asset_code,
            items=[],
        )

    items: list[schemas.HypothesisComparisonItem] = []
    for hypothesis in hypotheses:
        effort = crud.get_effort_analysis_by_hypothesis(db, hypothesis.id)
        impact = crud.get_impact_analysis_by_hypothesis(db, hypothesis.id)
        readiness = None
        if effort is not None and impact is not None:
            readiness = round(impact.impact_score * (1.0 - effort.effort_score), 3)
            if isinstance(readiness, float) and isnan(readiness):
                readiness = None

        run = crud.get_run(db, hypothesis.run_id)
        items.append(
            schemas.HypothesisComparisonItem(
                hypothesis_id=hypothesis.id,
                run_id=hypothesis.run_id,
                asset_id=hypothesis.asset_id,
                asset_code=asset.asset_code,
                source_disease=hypothesis.source_disease,
                target_disease=hypothesis.target_disease,
                summary=hypothesis.summary,
                final_confidence=hypothesis.final_confidence,
                final_recommendation=run.final_recommendation if run else None,
                recommended_action=hypothesis.recommended_action,
                priority_level=hypothesis.priority_level,
                disagreement_score=hypothesis.disagreement_score,
                evidence_coverage_score=hypothesis.evidence_coverage_score,
                requires_hitl=hypothesis.requires_hitl,
                effort_score=effort.effort_score if effort else None,
                impact_score=impact.impact_score if impact else None,
                investment_readiness_score=readiness,
                created_at=hypothesis.created_at,
            )
        )

    items.sort(
        key=lambda item: (
            item.investment_readiness_score or -1,
            item.final_confidence or -1,
            item.created_at,
        ),
        reverse=True,
    )

    return schemas.HypothesisComparisonResponse(
        asset_id=asset.id,
        asset_code=asset.asset_code,
        items=items,
    )
