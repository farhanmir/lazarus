"""CRUD helpers for the Step 2 backend."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from backend.app import models, schemas


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def create_asset(db: Session, payload: schemas.AssetCreate) -> models.CompanyAsset:
    asset = models.CompanyAsset(**payload.model_dump())
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


def list_assets(db: Session) -> list[models.CompanyAsset]:
    stmt = select(models.CompanyAsset).order_by(models.CompanyAsset.asset_code.asc())
    return list(db.scalars(stmt).all())


def get_asset(db: Session, asset_id: UUID) -> models.CompanyAsset | None:
    return db.get(models.CompanyAsset, asset_id)


def get_asset_by_code(db: Session, asset_code: str) -> models.CompanyAsset | None:
    stmt = select(models.CompanyAsset).where(models.CompanyAsset.asset_code == asset_code)
    return db.scalar(stmt)


def create_run(db: Session, asset_id: UUID, run_type: str, status: str) -> models.AgentRun:
    run = models.AgentRun(
        asset_id=asset_id,
        run_type=run_type,
        status=status,
        started_at=now_utc() if status == "running" else None,
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


def list_runs(db: Session) -> list[models.AgentRun]:
    stmt = (
        select(models.AgentRun)
        .options(selectinload(models.AgentRun.steps))
        .order_by(models.AgentRun.created_at.desc())
    )
    return list(db.scalars(stmt).all())


def get_run(db: Session, run_id: UUID) -> models.AgentRun | None:
    stmt = (
        select(models.AgentRun)
        .options(
            selectinload(models.AgentRun.steps),
            selectinload(models.AgentRun.hypotheses),
        )
        .where(models.AgentRun.id == run_id)
    )
    return db.scalar(stmt)


def update_run_status(
    db: Session,
    run: models.AgentRun,
    *,
    status: str,
    final_confidence: float | None = None,
    final_recommendation: str | None = None,
    error_message: str | None = None,
) -> models.AgentRun:
    run.status = status
    run.error_message = error_message
    if status == "running" and run.started_at is None:
        run.started_at = now_utc()
    if status in {"completed", "failed"}:
        run.completed_at = now_utc()
    if final_confidence is not None:
        run.final_confidence = final_confidence
    if final_recommendation is not None:
        run.final_recommendation = final_recommendation
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


def create_agent_step(
    db: Session,
    *,
    run_id: UUID,
    agent_name: str,
    step_order: int,
    input_summary: str | None,
    output_summary: str | None,
    status: str,
    score: float | None,
    citations_json: dict | list | None,
    started_at: datetime | None,
    completed_at: datetime | None,
) -> models.AgentStep:
    step = models.AgentStep(
        run_id=run_id,
        agent_name=agent_name,
        step_order=step_order,
        input_summary=input_summary,
        output_summary=output_summary,
        status=status,
        score=score,
        citations_json=citations_json,
        started_at=started_at,
        completed_at=completed_at,
    )
    db.add(step)
    db.commit()
    db.refresh(step)
    return step


def list_steps_by_run(db: Session, run_id: UUID) -> list[models.AgentStep]:
    stmt = (
        select(models.AgentStep)
        .where(models.AgentStep.run_id == run_id)
        .order_by(models.AgentStep.step_order.asc())
    )
    return list(db.scalars(stmt).all())


def create_hypothesis(db: Session, payload: schemas.HypothesisCreate) -> models.Hypothesis:
    hypothesis = models.Hypothesis(**payload.model_dump())
    db.add(hypothesis)
    db.commit()
    db.refresh(hypothesis)
    return hypothesis


def get_hypothesis(db: Session, hypothesis_id: UUID) -> models.Hypothesis | None:
    return db.get(models.Hypothesis, hypothesis_id)


def list_hypotheses(db: Session) -> list[models.Hypothesis]:
    stmt = select(models.Hypothesis).order_by(models.Hypothesis.created_at.desc())
    return list(db.scalars(stmt).all())


def create_blueprint(
    db: Session,
    *,
    hypothesis_id: UUID,
    title: str,
    executive_summary: str | None,
    technical_summary: str | None,
    generation_status: str,
    version: int = 1,
    pdf_path: str | None = None,
) -> models.Blueprint:
    blueprint = models.Blueprint(
        hypothesis_id=hypothesis_id,
        version=version,
        title=title,
        executive_summary=executive_summary,
        technical_summary=technical_summary,
        pdf_path=pdf_path,
        generation_status=generation_status,
    )
    db.add(blueprint)
    db.commit()
    db.refresh(blueprint)
    return blueprint


def update_blueprint(
    db: Session,
    blueprint: models.Blueprint,
    *,
    title: str | None = None,
    executive_summary: str | None = None,
    technical_summary: str | None = None,
    pdf_path: str | None = None,
    generation_status: str | None = None,
) -> models.Blueprint:
    if title is not None:
        blueprint.title = title
    if executive_summary is not None:
        blueprint.executive_summary = executive_summary
    if technical_summary is not None:
        blueprint.technical_summary = technical_summary
    if pdf_path is not None:
        blueprint.pdf_path = pdf_path
    if generation_status is not None:
        blueprint.generation_status = generation_status
    db.add(blueprint)
    db.commit()
    db.refresh(blueprint)
    return blueprint


def get_blueprint(db: Session, blueprint_id: UUID) -> models.Blueprint | None:
    return db.get(models.Blueprint, blueprint_id)


def create_notification(
    db: Session,
    *,
    blueprint_id: UUID,
    channel: str,
    message_preview: str | None,
    delivery_status: str,
    external_message_id: str | None = None,
    sent_at: datetime | None = None,
) -> models.Notification:
    notification = models.Notification(
        blueprint_id=blueprint_id,
        channel=channel,
        message_preview=message_preview,
        delivery_status=delivery_status,
        external_message_id=external_message_id,
        sent_at=sent_at,
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification


def update_notification(
    db: Session,
    notification: models.Notification,
    *,
    delivery_status: str | None = None,
    external_message_id: str | None = None,
    sent_at: datetime | None = None,
) -> models.Notification:
    if delivery_status is not None:
        notification.delivery_status = delivery_status
    if external_message_id is not None:
        notification.external_message_id = external_message_id
    if sent_at is not None:
        notification.sent_at = sent_at
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification


def list_notifications(db: Session) -> list[models.Notification]:
    stmt = select(models.Notification).order_by(models.Notification.created_at.desc())
    return list(db.scalars(stmt).all())


def create_run_memory(
    db: Session,
    *,
    run_id: UUID,
    memory_type: str,
    content: str,
) -> models.RunMemory:
    memory = models.RunMemory(run_id=run_id, memory_type=memory_type, content=content)
    db.add(memory)
    db.commit()
    db.refresh(memory)
    return memory


def list_run_memories(db: Session, run_id: UUID) -> list[models.RunMemory]:
    stmt = select(models.RunMemory).where(models.RunMemory.run_id == run_id).order_by(models.RunMemory.created_at.asc())
    return list(db.scalars(stmt).all())


def create_asset_memory(
    db: Session,
    *,
    asset_id: UUID,
    memory_type: str,
    content: str,
    source_run_id: UUID | None = None,
) -> models.AssetMemory:
    memory = models.AssetMemory(
        asset_id=asset_id,
        memory_type=memory_type,
        content=content,
        source_run_id=source_run_id,
    )
    db.add(memory)
    db.commit()
    db.refresh(memory)
    return memory


def list_asset_memories(db: Session, asset_id: UUID, *, limit: int = 5) -> list[models.AssetMemory]:
    stmt = (
        select(models.AssetMemory)
        .where(models.AssetMemory.asset_id == asset_id)
        .order_by(models.AssetMemory.created_at.desc())
        .limit(limit)
    )
    return list(db.scalars(stmt).all())


def create_human_review(
    db: Session,
    *,
    run_id: UUID,
    asset_id: UUID,
    review_type: str,
    reason: str,
    recommended_reviewer: str | None = None,
) -> models.HumanReview:
    review = models.HumanReview(
        run_id=run_id,
        asset_id=asset_id,
        review_type=review_type,
        reason=reason,
        recommended_reviewer=recommended_reviewer,
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    return review


def list_human_reviews(db: Session, *, status: str | None = None) -> list[models.HumanReview]:
    stmt = select(models.HumanReview).order_by(models.HumanReview.created_at.desc())
    if status:
        stmt = stmt.where(models.HumanReview.status == status)
    return list(db.scalars(stmt).all())


def get_human_review(db: Session, review_id: UUID) -> models.HumanReview | None:
    return db.get(models.HumanReview, review_id)


def resolve_human_review(
    db: Session,
    review: models.HumanReview,
    *,
    resolution_notes: str,
) -> models.HumanReview:
    review.status = "resolved"
    review.resolution_notes = resolution_notes
    review.resolved_at = now_utc()
    db.add(review)
    db.commit()
    db.refresh(review)
    return review


# --- Effort Analysis ---


def create_effort_analysis(
    db: Session,
    *,
    run_id: UUID,
    hypothesis_id: UUID,
    estimated_cost_usd: int,
    estimated_time_months: int,
    trial_complexity: str,
    effort_score: float,
) -> models.EffortAnalysis:
    record = models.EffortAnalysis(
        run_id=run_id,
        hypothesis_id=hypothesis_id,
        estimated_cost_usd=estimated_cost_usd,
        estimated_time_months=estimated_time_months,
        trial_complexity=trial_complexity,
        effort_score=effort_score,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def get_effort_analysis_by_run(db: Session, run_id: UUID) -> models.EffortAnalysis | None:
    stmt = select(models.EffortAnalysis).where(models.EffortAnalysis.run_id == run_id)
    return db.scalar(stmt)


def get_effort_analysis_by_hypothesis(db: Session, hypothesis_id: UUID) -> models.EffortAnalysis | None:
    stmt = select(models.EffortAnalysis).where(models.EffortAnalysis.hypothesis_id == hypothesis_id)
    return db.scalar(stmt)


# --- Impact Analysis ---


def create_impact_analysis(
    db: Session,
    *,
    run_id: UUID,
    hypothesis_id: UUID,
    patient_population_size: int,
    expected_breakthrough_score: float,
    commercial_value_estimate: str,
    impact_score: float,
) -> models.ImpactAnalysis:
    record = models.ImpactAnalysis(
        run_id=run_id,
        hypothesis_id=hypothesis_id,
        patient_population_size=patient_population_size,
        expected_breakthrough_score=expected_breakthrough_score,
        commercial_value_estimate=commercial_value_estimate,
        impact_score=impact_score,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def get_impact_analysis_by_run(db: Session, run_id: UUID) -> models.ImpactAnalysis | None:
    stmt = select(models.ImpactAnalysis).where(models.ImpactAnalysis.run_id == run_id)
    return db.scalar(stmt)


def get_impact_analysis_by_hypothesis(db: Session, hypothesis_id: UUID) -> models.ImpactAnalysis | None:
    stmt = select(models.ImpactAnalysis).where(models.ImpactAnalysis.hypothesis_id == hypothesis_id)
    return db.scalar(stmt)


# --- Messages ---


def create_message(
    db: Session,
    *,
    run_id: UUID,
    role: str,
    content: str,
    sources_json: dict | list | None = None,
) -> models.Message:
    msg = models.Message(
        run_id=run_id,
        role=role,
        content=content,
        sources_json=sources_json,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


def list_messages(db: Session, run_id: UUID) -> list[models.Message]:
    stmt = (
        select(models.Message)
        .where(models.Message.run_id == run_id)
        .order_by(models.Message.created_at.asc())
    )
    return list(db.scalars(stmt).all())
