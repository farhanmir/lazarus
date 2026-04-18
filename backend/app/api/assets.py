"""Asset routes."""

from __future__ import annotations

from uuid import UUID

import scipy.stats as stats
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app import crud, schemas
from backend.app.db import get_db

router = APIRouter(tags=["assets"])


@router.get("/assets", response_model=list[schemas.AssetResponse])
def list_assets(db: Session = Depends(get_db)):
    return crud.list_assets(db)


@router.get("/assets/{asset_id}", response_model=schemas.AssetResponse)
def get_asset(asset_id: UUID, db: Session = Depends(get_db)):
    asset = crud.get_asset(db, asset_id)
    if asset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found.")
    return asset


@router.post("/assets", response_model=schemas.AssetResponse, status_code=status.HTTP_201_CREATED)
def create_asset(payload: schemas.AssetCreate, db: Session = Depends(get_db)):
    existing = crud.get_asset_by_code(db, payload.asset_code)
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Asset code already exists.")
    return crud.create_asset(db, payload)


@router.get("/assets/{asset_id}/patient-data")
def get_patient_data(asset_id: UUID, db: Session = Depends(get_db)):
    asset = crud.get_asset(db, asset_id)
    if asset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found.")

    # Synthetic Subgroup: 65+ Female / CRP > 3.0
    # Treatment: 42 successes, 8 failures (84% efficacy)
    # Control: 10 successes, 40 failures (20% efficacy)
    treatment_success, treatment_fail = 42, 8
    control_success, control_fail = 10, 40
    
    # Calculate synthetic deterministic P-Value via SciPy Fisher's Exact Test
    table = [[treatment_success, treatment_fail], [control_success, control_fail]]
    res = stats.fisher_exact(table, alternative='greater')
    p_value = float(res.pvalue)

    return {
        "asset_code": asset.asset_code,
        "cohort_size": 100,
        "target_subgroup": "65+ Female / CRP > 3.0",
        "treatment_efficacy": 0.84,
        "control_efficacy": 0.20,
        "p_value": p_value,
        "is_significant": p_value < 0.001,
        "method": "Fisher's Exact Test (scipy.stats)"
    }
