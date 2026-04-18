"""Hypothesis routes."""

from __future__ import annotations

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
