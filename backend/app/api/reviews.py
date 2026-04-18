"""Human review queue routes."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app import crud, schemas
from backend.app.db import get_db

router = APIRouter(prefix="/human-reviews", tags=["human-reviews"])


@router.get("", response_model=list[schemas.HumanReviewResponse])
def list_human_reviews(status_filter: str | None = None, db: Session = Depends(get_db)):
    return crud.list_human_reviews(db, status=status_filter)


@router.post("/{review_id}/resolve", response_model=schemas.HumanReviewResponse)
def resolve_human_review(
    review_id: UUID,
    payload: schemas.HumanReviewResolveRequest,
    db: Session = Depends(get_db),
):
    review = crud.get_human_review(db, review_id)
    if review is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Human review not found.")
    return crud.resolve_human_review(db, review, resolution_notes=payload.resolution_notes)
