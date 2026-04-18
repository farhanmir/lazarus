"""Blueprint assembly and persistence service."""

from __future__ import annotations

from pathlib import Path
from threading import Thread
from uuid import UUID

from jinja2 import Environment, FileSystemLoader, select_autoescape
from sqlalchemy.orm import Session

from backend.app import crud, schemas
from backend.app.db import SessionLocal
from backend.app.services.evidence_service import build_blueprint_payload
from backend.app.services.imessage_service import resolve_imessage_channel, send_imessage_notification
from backend.app.services.pdf_service import render_pdf_from_html


TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates"
ARTIFACTS_DIR = Path(__file__).resolve().parent.parent.parent.parent / "artifacts" / "blueprints"
CSS_PATH = TEMPLATES_DIR / "blueprint.css"


def _template_env() -> Environment:
    return Environment(
        loader=FileSystemLoader(str(TEMPLATES_DIR)),
        autoescape=select_autoescape(["html", "xml"]),
        trim_blocks=True,
        lstrip_blocks=True,
    )


def render_blueprint_html(payload: schemas.BlueprintPayload) -> str:
    """Render the executive blueprint HTML."""
    template = _template_env().get_template("blueprint.html")
    return template.render(payload=payload)


def _artifact_paths(asset_code: str, blueprint_id: UUID) -> tuple[Path, Path]:
    stem = f"{asset_code.lower()}-{blueprint_id}"
    return ARTIFACTS_DIR / f"{stem}.html", ARTIFACTS_DIR / f"{stem}.pdf"


def _deliver_notification(
    db: Session,
    *,
    blueprint,
    payload: schemas.BlueprintPayload,
):
    channel = resolve_imessage_channel()
    notification = crud.create_notification(
        db,
        blueprint_id=blueprint.id,
        channel=channel,
        message_preview=(
            f"Blueprint ready: {payload.asset_code} -> {payload.proposed_indication}. "
            f"Priority {payload.priority_level}."
        ),
        delivery_status="queued",
        sent_at=None,
    )
    delivery_result = send_imessage_notification(
        message_preview=notification.message_preview or "",
        blueprint_id=str(blueprint.id),
        pdf_path=blueprint.pdf_path,
    )
    if delivery_result.get("status") == "sent":
        return crud.update_notification(
            db,
            notification,
            delivery_status="sent",
            external_message_id=delivery_result.get("external_message_id"),
            sent_at=delivery_result.get("sent_at"),
        )
    if delivery_result.get("status") == "failed":
        return crud.update_notification(
            db,
            notification,
            delivery_status="failed",
        )
    return notification


def _generate_blueprint_from_record(
    db: Session,
    *,
    blueprint,
    create_notification: bool,
) -> schemas.BlueprintGenerationResponse:
    payload = build_blueprint_payload(db, blueprint.hypothesis_id)

    try:
        html = render_blueprint_html(payload)
        html_path, pdf_path = _artifact_paths(payload.asset_code, blueprint.id)
        html_path.parent.mkdir(parents=True, exist_ok=True)
        html_path.write_text(html, encoding="utf-8")
        render_pdf_from_html(html, pdf_path, CSS_PATH if CSS_PATH.exists() else None)

        blueprint = crud.update_blueprint(
            db,
            blueprint,
            pdf_path=str(pdf_path),
            generation_status="generated",
            title=f"Lazarus Blueprint: {payload.asset_code} -> {payload.proposed_indication}",
            executive_summary=payload.executive_summary,
            technical_summary=payload.technical_summary,
        )
    except Exception:
        blueprint = crud.update_blueprint(
            db,
            blueprint,
            generation_status="failed",
        )
        raise

    notification = None
    if create_notification:
        notification = _deliver_notification(db, blueprint=blueprint, payload=payload)

    return schemas.BlueprintGenerationResponse(
        blueprint=schemas.BlueprintResponse.model_validate(blueprint),
        payload=payload,
        notification=(
            schemas.NotificationResponse.model_validate(notification)
            if notification is not None
            else None
        ),
    )


def generate_blueprint(
    db: Session,
    hypothesis_id: UUID,
    *,
    create_notification: bool = True,
) -> schemas.BlueprintGenerationResponse:
    """Create a blueprint payload, render it, convert it to PDF, and persist metadata."""
    payload = build_blueprint_payload(db, hypothesis_id)
    blueprint = crud.create_blueprint(
        db,
        hypothesis_id=hypothesis_id,
        title=f"Lazarus Blueprint: {payload.asset_code} -> {payload.proposed_indication}",
        executive_summary=payload.executive_summary,
        technical_summary=payload.technical_summary,
        generation_status="pending",
    )
    return _generate_blueprint_from_record(
        db,
        blueprint=blueprint,
        create_notification=create_notification,
    )


def create_blueprint_job(
    db: Session,
    hypothesis_id: UUID,
) -> schemas.BlueprintResponse:
    """Create a pending blueprint record for async generation."""
    hypothesis = crud.get_hypothesis(db, hypothesis_id)
    if hypothesis is None:
        raise ValueError("Hypothesis not found.")

    blueprint = crud.create_blueprint(
        db,
        hypothesis_id=hypothesis_id,
        title="Lazarus Blueprint: Pending",
        executive_summary=None,
        technical_summary=None,
        generation_status="pending",
    )
    return schemas.BlueprintResponse.model_validate(blueprint)


def execute_blueprint_job(blueprint_id: UUID, *, create_notification: bool) -> None:
    """Generate a previously created blueprint record in a standalone session."""
    with SessionLocal() as db:
        blueprint = crud.get_blueprint(db, blueprint_id)
        if blueprint is None:
            return
        _generate_blueprint_from_record(
            db,
            blueprint=blueprint,
            create_notification=create_notification,
        )


def start_blueprint_job(blueprint_id: UUID, *, create_notification: bool) -> None:
    """Launch blueprint generation in the background."""
    Thread(
        target=execute_blueprint_job,
        args=(blueprint_id,),
        kwargs={"create_notification": create_notification},
        daemon=True,
    ).start()
