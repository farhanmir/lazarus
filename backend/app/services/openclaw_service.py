"""Thin OpenClaw-facing service adapters for Lazarus."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from backend.app import crud, schemas
from backend.app.services.blueprint_service import generate_blueprint
from backend.app.services.reasoning_service import run_reasoning_pipeline


def _build_blueprint_download_url(blueprint_id: UUID) -> str:
    return f"/blueprints/{blueprint_id}/download"


def review_asset_by_code(
    db: Session,
    *,
    asset_code: str,
    run_type: str = "manual",
    generate_blueprint_artifact: bool = False,
    create_notification: bool = False,
) -> schemas.OpenClawReviewResponse:
    asset = crud.get_asset_by_code(db, asset_code)
    if asset is None:
        raise ValueError(f"Asset with code '{asset_code}' was not found.")

    analysis = run_reasoning_pipeline(db, asset.id, run_type)

    blueprint_id: UUID | None = None
    blueprint_download_url: str | None = None
    if generate_blueprint_artifact:
        blueprint = generate_blueprint(
            db,
            analysis.final_hypothesis_id,
            create_notification=create_notification,
        )
        blueprint_id = blueprint.blueprint.id
        blueprint_download_url = _build_blueprint_download_url(blueprint.blueprint.id)

    confidence_value = analysis.final_confidence * 100 if analysis.final_confidence <= 1 else analysis.final_confidence
    response_text = (
        f"{analysis.asset_code}: {analysis.final_decision}. "
        f"Target indication: {analysis.reasoning.target_disease}. "
        f"Confidence: {confidence_value:.1f}%. "
        f"Next action: {analysis.reasoning.trial_strategist.recommended_action}."
    )
    if blueprint_download_url:
        response_text += f" Blueprint: {blueprint_download_url}."

    return schemas.OpenClawReviewResponse(
        asset_code=analysis.asset_code,
        run_id=analysis.run.id,
        hypothesis_id=analysis.final_hypothesis_id,
        final_decision=analysis.final_decision,
        final_confidence=analysis.final_confidence,
        target_disease=analysis.reasoning.target_disease,
        summary=analysis.reasoning.judge.summary,
        blueprint_id=blueprint_id,
        blueprint_download_url=blueprint_download_url,
        response_text=response_text,
    )


def generate_blueprint_for_openclaw(
    db: Session,
    *,
    hypothesis_id: UUID | None = None,
    asset_code: str | None = None,
    create_notification: bool = False,
) -> schemas.OpenClawBlueprintResponse:
    resolved_hypothesis_id = hypothesis_id
    resolved_asset_code = asset_code

    if resolved_hypothesis_id is None:
        if not asset_code:
            raise ValueError("Either hypothesis_id or asset_code is required.")
        asset = crud.get_asset_by_code(db, asset_code)
        if asset is None:
            raise ValueError(f"Asset with code '{asset_code}' was not found.")
        hypotheses = [
            hypothesis
            for hypothesis in crud.list_hypotheses(db)
            if hypothesis.asset_id == asset.id
        ]
        if not hypotheses:
            raise ValueError(f"No hypotheses found for asset '{asset_code}'.")
        latest_hypothesis = hypotheses[0]
        resolved_hypothesis_id = latest_hypothesis.id
        resolved_asset_code = asset.asset_code

    assert resolved_hypothesis_id is not None
    blueprint = generate_blueprint(
        db,
        resolved_hypothesis_id,
        create_notification=create_notification,
    )

    hypothesis = crud.get_hypothesis(db, resolved_hypothesis_id)
    if hypothesis is None:
        raise ValueError("Hypothesis not found after blueprint generation.")

    asset = crud.get_asset(db, hypothesis.asset_id)
    asset_code_value = resolved_asset_code or (asset.asset_code if asset is not None else "unknown")
    download_url = _build_blueprint_download_url(blueprint.blueprint.id)

    return schemas.OpenClawBlueprintResponse(
        blueprint_id=blueprint.blueprint.id,
        hypothesis_id=resolved_hypothesis_id,
        asset_code=asset_code_value,
        title=blueprint.blueprint.title,
        pdf_path=blueprint.blueprint.pdf_path,
        download_url=download_url,
        response_text=(
            f"Blueprint ready for {asset_code_value}. Download: {download_url}."
        ),
    )
