"""Compatibility service wrappers for blueprint generation and Step 3 reasoning."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from backend.app import schemas
from backend.app.services.blueprint_service import generate_blueprint
from backend.app.services.reasoning_service import run_reasoning_pipeline


def build_blueprint_for_hypothesis(
    db: Session,
    hypothesis_id: UUID,
    *,
    create_notification: bool = True,
) -> schemas.BlueprintGenerationResponse:
    return generate_blueprint(db, hypothesis_id, create_notification=create_notification)


def run_mock_analysis(db: Session, asset_id: UUID, run_type: str) -> schemas.RunAnalysisResponse:
    """Compatibility wrapper so existing callers use the Step 3 reasoning flow."""
    return run_reasoning_pipeline(db, asset_id, run_type)
