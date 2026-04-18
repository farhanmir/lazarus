"""Blueprint routes."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from backend.app import crud, schemas
from backend.app.db import get_db
from backend.app.services.blueprint_service import (
    create_blueprint_job,
    generate_blueprint as generate_blueprint_artifact,
    start_blueprint_job,
)
from backend.app.services.evidence_service import build_blueprint_payload

router = APIRouter(tags=["blueprints"])


@router.post("/generate-blueprint", response_model=schemas.BlueprintGenerationResponse, status_code=status.HTTP_201_CREATED)
def generate_blueprint(payload: schemas.BlueprintCreate, db: Session = Depends(get_db)):
    try:
        return generate_blueprint_artifact(db, payload.hypothesis_id, create_notification=True)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/blueprints/{blueprint_id}", response_model=schemas.BlueprintResponse)
def get_blueprint(blueprint_id: UUID, db: Session = Depends(get_db)):
    blueprint = crud.get_blueprint(db, blueprint_id)
    if blueprint is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Blueprint not found.")
    return blueprint


@router.get("/blueprints/{blueprint_id}/detail", response_model=schemas.BlueprintDetailResponse)
def get_blueprint_detail(blueprint_id: UUID, db: Session = Depends(get_db)):
    blueprint = crud.get_blueprint(db, blueprint_id)
    if blueprint is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Blueprint not found.")

    payload = None
    if blueprint.generation_status == "generated":
        payload = build_blueprint_payload(db, blueprint.hypothesis_id)

    return schemas.BlueprintDetailResponse(
        blueprint=schemas.BlueprintResponse.model_validate(blueprint),
        payload=payload,
    )


@router.get("/blueprints/{blueprint_id}/download")
def download_blueprint(blueprint_id: UUID, db: Session = Depends(get_db)):
    blueprint = crud.get_blueprint(db, blueprint_id)
    if blueprint is None or not blueprint.pdf_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Blueprint file not found.")
    return FileResponse(
        blueprint.pdf_path,
        media_type="application/pdf",
        filename=f"lazarus-blueprint-{blueprint_id}.pdf",
    )


@router.post("/generate-blueprint/async", response_model=schemas.BlueprintJobResponse, status_code=status.HTTP_202_ACCEPTED)
def generate_blueprint_async(payload: schemas.BlueprintCreate, db: Session = Depends(get_db)):
    try:
        blueprint = create_blueprint_job(db, payload.hypothesis_id)
        start_blueprint_job(blueprint.id, create_notification=True)
        return schemas.BlueprintJobResponse(
            blueprint=blueprint,
            status_url=f"/blueprints/{blueprint.id}/detail",
            download_url=f"/blueprints/{blueprint.id}/download",
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
