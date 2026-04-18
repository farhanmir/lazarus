"""Candidate discovery and heavy evaluation routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.app import crud, schemas
from backend.app.db import get_db
from backend.app.services.candidate_service import search_candidates
from backend.app.services.reasoning_service import create_analysis_run, start_analysis_run

router = APIRouter(prefix="/api", tags=["discovery"])


@router.get("/candidates", response_model=schemas.CandidateSearchResponse)
def get_candidates(
    disease: str = Query(..., min_length=2),
    limit: int = Query(5, ge=1, le=10),
    db: Session = Depends(get_db),
):
    return search_candidates(db, disease, limit=limit)


@router.post("/evaluate", response_model=schemas.EvaluateResponse, status_code=status.HTTP_202_ACCEPTED)
def evaluate_candidate(payload: schemas.EvaluateRequest, db: Session = Depends(get_db)):
    asset = None

    if payload.asset_code:
      asset = crud.get_asset_by_code(db, payload.asset_code)

    if asset is None:
      asset = crud.get_asset_by_internal_name(db, payload.drug)

    if asset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Drug candidate not found.")

    run = create_analysis_run(db, asset.id, run_type="zillow_evaluate")
    start_analysis_run(run.id)

    return schemas.EvaluateResponse(
        run=run,
        asset_id=asset.id,
        asset_code=asset.asset_code,
        drug_name=asset.internal_name,
        disease=payload.disease,
        status_url=f"/runs/{run.id}",
        trace_url=f"/runs/{run.id}/trace",
    )
