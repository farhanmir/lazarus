"""OpenClaw-facing routes for operator-friendly Lazarus actions."""

from __future__ import annotations

import os

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from backend.app import schemas
from backend.app.db import get_db
from backend.app.services.openclaw_service import (
    generate_blueprint_for_openclaw,
    review_asset_by_code,
)

router = APIRouter(prefix="/openclaw", tags=["openclaw"])


def _require_openclaw_token(authorization: str | None = Header(default=None)) -> None:
    expected = os.getenv("OPENCLAW_SHARED_TOKEN")
    if not expected:
        return

    token = ""
    if authorization and authorization.startswith("Bearer "):
        token = authorization.removeprefix("Bearer ").strip()
    if token != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid OpenClaw token.",
        )


@router.get("/health")
def openclaw_health(_: None = Depends(_require_openclaw_token)) -> dict[str, str]:
    return {"status": "ok", "message": "Lazarus OpenClaw bridge is ready."}


@router.post("/review-asset", response_model=schemas.OpenClawReviewResponse)
def openclaw_review_asset(
    payload: schemas.OpenClawReviewRequest,
    db: Session = Depends(get_db),
    _: None = Depends(_require_openclaw_token),
):
    try:
        return review_asset_by_code(
            db,
            asset_code=payload.asset_code,
            run_type=payload.run_type,
            generate_blueprint_artifact=payload.generate_blueprint,
            create_notification=payload.create_notification,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/generate-blueprint", response_model=schemas.OpenClawBlueprintResponse)
def openclaw_generate_blueprint(
    payload: schemas.OpenClawBlueprintRequest,
    db: Session = Depends(get_db),
    _: None = Depends(_require_openclaw_token),
):
    try:
        return generate_blueprint_for_openclaw(
            db,
            hypothesis_id=payload.hypothesis_id,
            asset_code=payload.asset_code,
            create_notification=payload.create_notification,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
