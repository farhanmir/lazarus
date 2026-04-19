"""Human review queue routes."""

from __future__ import annotations

from collections import Counter
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app import crud, schemas
from backend.app.db import get_db

router = APIRouter(prefix="/human-reviews", tags=["human-reviews"])


@router.get("", response_model=list[schemas.HumanReviewResponse])
def list_human_reviews(status_filter: str | None = None, db: Session = Depends(get_db)):
    return crud.list_human_reviews(db, status=status_filter)


@router.get("/dashboard", response_model=schemas.HumanReviewDashboardSummary)
def get_human_review_dashboard(status_filter: str | None = None, db: Session = Depends(get_db)):
    reviews = crud.list_human_reviews_with_context(db, status=status_filter)
    type_counts = Counter(review.review_type for review in reviews)

    items = [
        schemas.HumanReviewDashboardItem(
            id=review.id,
            run_id=review.run_id,
            asset_id=review.asset_id,
            asset_code=review.asset.asset_code,
            asset_name=review.asset.internal_name,
            original_indication=review.asset.original_indication,
            review_type=review.review_type,
            status=review.status,
            reason=review.reason,
            recommended_reviewer=review.recommended_reviewer,
            run_status=review.run.status if review.run else None,
            created_at=review.created_at,
            resolved_at=review.resolved_at,
        )
        for review in reviews
    ]

    return schemas.HumanReviewDashboardSummary(
        total=len(items),
        pending=sum(1 for review in items if review.status == "pending"),
        resolved=sum(1 for review in items if review.status != "pending"),
        safety_board=type_counts.get("safety_board", 0),
        portfolio_committee=type_counts.get("portfolio_committee", 0),
        items=items,
    )


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
