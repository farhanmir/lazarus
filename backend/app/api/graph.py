"""Graph routes for the Step 5 visualization layer."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app import schemas
from backend.app.db import get_db
from backend.app.services.graph_service import build_graph_payload

router = APIRouter(tags=["graph"])


@router.get("/graph/{asset_id}", response_model=schemas.GraphResponse)
def get_graph(asset_id: UUID, db: Session = Depends(get_db)):
    try:
        return build_graph_payload(db, asset_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
