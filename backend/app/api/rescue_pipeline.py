"""Rescue home orchestration: one POST runs the full judge-facing pipeline."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import FileResponse

from backend.app import schemas
from backend.app.services.rescue_pipeline_service import RESCUE_ARTIFACTS_DIR, run_rescue_pipeline

router = APIRouter(prefix="/api", tags=["rescue-pipeline"])


@router.post(
    "/rescue-pipeline",
    response_model=schemas.RescuePipelineResponse,
    status_code=status.HTTP_200_OK,
)
def post_rescue_pipeline(payload: schemas.RescuePipelineRequest) -> schemas.RescuePipelineResponse:
    """Run discovery → Gemini autopsy → K2 strategy → PDF → optional Photon."""
    return run_rescue_pipeline(payload.disease, recipient=payload.recipient)


@router.get("/rescue-artifacts/{artifact_id}/pdf")
def get_rescue_artifact_pdf(artifact_id: UUID) -> FileResponse:
    path = RESCUE_ARTIFACTS_DIR / f"{artifact_id}.pdf"
    if not path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rescue blueprint artifact not found or expired.",
        )
    return FileResponse(
        path,
        media_type="application/pdf",
        filename=f"lazarus-rescue-{artifact_id}.pdf",
    )
