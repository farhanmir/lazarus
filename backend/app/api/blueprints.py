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
from backend.app.services.gmail_service import send_blueprint_email

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


@router.post("/blueprints/{blueprint_id}/email")
def email_blueprint(blueprint_id: UUID, body: schemas.BlueprintEmailRequest, db: Session = Depends(get_db)):
    blueprint = crud.get_blueprint(db, blueprint_id)
    if blueprint is None or not blueprint.pdf_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Blueprint file not found.")

    payload = build_blueprint_payload(db, blueprint.hypothesis_id)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Blueprint payload not found.")

    result = send_blueprint_email(
        recipient_email=body.recipient_email,
        drug_name=payload.drug_name,
        asset_code=payload.asset_code,
        proposed_indication=payload.proposed_indication,
        confidence_score=payload.confidence_score,
        recommendation=payload.recommendation,
        pdf_path=blueprint.pdf_path,
    )
    if not result.get("ok"):
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=result.get("reason", "Email send failed."))
    return result


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
