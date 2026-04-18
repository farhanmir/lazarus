"""Memory inspection routes."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.app import crud, schemas
from backend.app.db import get_db

router = APIRouter(tags=["memories"])


@router.get("/runs/{run_id}/memories", response_model=list[schemas.RunMemoryResponse])
def list_run_memories(run_id: UUID, db: Session = Depends(get_db)):
    return crud.list_run_memories(db, run_id)


@router.get("/assets/{asset_id}/memories", response_model=list[schemas.AssetMemoryResponse])
def list_asset_memories(asset_id: UUID, db: Session = Depends(get_db)):
    return crud.list_asset_memories(db, asset_id, limit=20)
