"""Effort & Impact analysis API routes."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app import crud, schemas
from backend.app.db import get_db

router = APIRouter(tags=["strategy"])


@router.get("/runs/{run_id}/effort", response_model=schemas.EffortAnalysisResponse)
def get_effort_by_run(run_id: UUID, db: Session = Depends(get_db)):
    record = crud.get_effort_analysis_by_run(db, run_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Effort analysis not found for this run.")
    return record


@router.get("/runs/{run_id}/impact", response_model=schemas.ImpactAnalysisResponse)
def get_impact_by_run(run_id: UUID, db: Session = Depends(get_db)):
    record = crud.get_impact_analysis_by_run(db, run_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Impact analysis not found for this run.")
    return record


@router.get("/runs/{run_id}/effort-impact", response_model=schemas.EffortImpactSummary)
def get_effort_impact_summary(run_id: UUID, db: Session = Depends(get_db)):
    effort = crud.get_effort_analysis_by_run(db, run_id)
    impact = crud.get_impact_analysis_by_run(db, run_id)
    if effort is None or impact is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Effort/Impact analysis not found.")

    # Investment Readiness = high impact + low effort is ideal
    investment_readiness = round(impact.impact_score * (1.0 - effort.effort_score), 3)

    return schemas.EffortImpactSummary(
        effort=schemas.EffortAnalysisResponse.model_validate(effort),
        impact=schemas.ImpactAnalysisResponse.model_validate(impact),
        investment_readiness_score=investment_readiness,
    )


@router.get("/hypotheses/{hypothesis_id}/effort", response_model=schemas.EffortAnalysisResponse)
def get_effort_by_hypothesis(hypothesis_id: UUID, db: Session = Depends(get_db)):
    record = crud.get_effort_analysis_by_hypothesis(db, hypothesis_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Effort analysis not found.")
    return record


@router.get("/hypotheses/{hypothesis_id}/impact", response_model=schemas.ImpactAnalysisResponse)
def get_impact_by_hypothesis(hypothesis_id: UUID, db: Session = Depends(get_db)):
    record = crud.get_impact_analysis_by_hypothesis(db, hypothesis_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Impact analysis not found.")
    return record
