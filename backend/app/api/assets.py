"""Asset routes."""

from __future__ import annotations

from uuid import UUID

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
