"""Backward-compatible Photon-named alias for the Spectrum webhook bridge."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app import schemas
from backend.app.db import get_db
from backend.app.services.openclaw_service import (
    generate_blueprint_for_openclaw,
    review_asset_by_code,
)
from backend.app.services.spectrum_service import send_spectrum_reply

router = APIRouter(prefix="/photon", tags=["photon"])


def _extract_action(payload: schemas.SpectrumWebhookRequest) -> tuple[str, str | None]:
    explicit_action = (payload.action or "").strip().lower()
    explicit_asset = (payload.asset_code or "").strip() or None
    text = (payload.text or "").strip()
    lowered = text.lower()

    if explicit_action in {"review", "analyze"}:
        return "review", explicit_asset
    if explicit_action == "blueprint":
        return "blueprint", explicit_asset

    if lowered.startswith("review ") or lowered.startswith("analyze "):
        asset_code = text.split(maxsplit=1)[1].strip() if len(text.split(maxsplit=1)) == 2 else None
        return "review", asset_code or explicit_asset
    if lowered.startswith("blueprint "):
        asset_code = text.split(maxsplit=1)[1].strip() if len(text.split(maxsplit=1)) == 2 else None
        return "blueprint", asset_code or explicit_asset

    if payload.generate_blueprint and explicit_asset:
        return "review", explicit_asset
    if explicit_asset:
        return "review", explicit_asset
    return "unknown", explicit_asset


def _maybe_reply_to_sender(payload: schemas.SpectrumWebhookRequest, response_text: str) -> None:
    sender_id = (payload.sender_id or "").strip()
    if not sender_id:
        return
    send_spectrum_reply(
        recipient=sender_id,
        message=response_text,
        metadata={"source": "lazarus-spectrum"},
    )


@router.get("/health")
def photon_health() -> dict[str, str]:
    return {"status": "ok", "message": "Lazarus Photon Spectrum bridge is ready."}


@router.post("/spectrum/webhook", response_model=schemas.PhotonSpectrumWebhookResponse)
def photon_spectrum_webhook(
    payload: schemas.SpectrumWebhookRequest,
    db: Session = Depends(get_db),
):
    action, asset_code = _extract_action(payload)
    try:
        if action == "review":
            if not asset_code:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Asset code is required for review actions.",
                )
            result = review_asset_by_code(
                db,
                asset_code=asset_code,
                run_type="photon_spectrum",
                generate_blueprint_artifact=payload.generate_blueprint,
                create_notification=payload.create_notification,
            )
            _maybe_reply_to_sender(payload, result.response_text)
            return schemas.SpectrumWebhookResponse(
                status="ok",
                action="review",
                response_text=result.response_text,
                asset_code=result.asset_code,
                run_id=result.run_id,
                hypothesis_id=result.hypothesis_id,
                blueprint_id=result.blueprint_id,
                blueprint_download_url=result.blueprint_download_url,
            )

        if action == "blueprint":
            result = generate_blueprint_for_openclaw(
                db,
                hypothesis_id=payload.hypothesis_id,
                asset_code=asset_code,
                create_notification=payload.create_notification,
            )
            _maybe_reply_to_sender(payload, result.response_text)
            return schemas.SpectrumWebhookResponse(
                status="ok",
                action="blueprint",
                response_text=result.response_text,
                asset_code=result.asset_code,
                hypothesis_id=result.hypothesis_id,
                blueprint_id=result.blueprint_id,
                blueprint_download_url=result.download_url,
            )

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Unsupported Photon Spectrum action. Use action='review' or 'blueprint', "
                "or text like 'review RX-782'."
            ),
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
