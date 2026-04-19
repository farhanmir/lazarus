"""SQLAlchemy ORM models.

Schema is organised around four aggregates:

* **Portfolio** — ``CompanyAsset`` and its memories.
* **Reasoning** — ``AgentRun`` → ``AgentStep`` (stream trace), plus
  ``Hypothesis``, ``EffortAnalysis``, ``ImpactAnalysis``.
* **Delivery** — ``Blueprint`` (PDF dossier) and ``Notification`` channels.
* **Operator** — ``HumanReview`` queue, ``Message`` chat log, and the
  ``DiseaseWatchlist``/``WatchlistAlert`` subscription pair.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.db import Base


class CompanyAsset(Base):
    __tablename__ = "company_assets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    asset_code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    internal_name: Mapped[str] = mapped_column(String(255), nullable=False)
    original_indication: Mapped[str] = mapped_column(String(255), nullable=False)
    portfolio_status: Mapped[str] = mapped_column(String(64), nullable=False)
    business_failure_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phase: Mapped[str | None] = mapped_column(String(64), nullable=True)
    owner_company: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    runs: Mapped[list["AgentRun"]] = relationship(back_populates="asset", cascade="all, delete-orphan")
    hypotheses: Mapped[list["Hypothesis"]] = relationship(back_populates="asset", cascade="all, delete-orphan")
    memories: Mapped[list["AssetMemory"]] = relationship(back_populates="asset", cascade="all, delete-orphan")
    human_reviews: Mapped[list["HumanReview"]] = relationship(back_populates="asset", cascade="all, delete-orphan")


class AgentRun(Base):
    __tablename__ = "agent_runs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    asset_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("company_assets.id"), nullable=False, index=True)
    run_type: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(64), nullable=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    final_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    final_recommendation: Mapped[str | None] = mapped_column(String(64), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    asset: Mapped["CompanyAsset"] = relationship(back_populates="runs")
    steps: Mapped[list["AgentStep"]] = relationship(back_populates="run", cascade="all, delete-orphan")
    hypotheses: Mapped[list["Hypothesis"]] = relationship(back_populates="run", cascade="all, delete-orphan")
    memories: Mapped[list["RunMemory"]] = relationship(back_populates="run", cascade="all, delete-orphan")
    human_reviews: Mapped[list["HumanReview"]] = relationship(back_populates="run", cascade="all, delete-orphan")


class AgentStep(Base):
    __tablename__ = "agent_steps"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("agent_runs.id"), nullable=False, index=True)
    agent_name: Mapped[str] = mapped_column(String(64), nullable=False)
    step_order: Mapped[int] = mapped_column(Integer, nullable=False)
    input_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    output_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(64), nullable=False)
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    citations_json: Mapped[dict | list | None] = mapped_column(JSONB, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    run: Mapped["AgentRun"] = relationship(back_populates="steps")


class Hypothesis(Base):
    __tablename__ = "hypotheses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("agent_runs.id"), nullable=False, index=True)
    asset_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("company_assets.id"), nullable=False, index=True)
    neo4j_hypothesis_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    source_disease: Mapped[str] = mapped_column(String(255), nullable=False)
    target_disease: Mapped[str] = mapped_column(String(255), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    advocate_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    skeptic_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    judge_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    final_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    recommended_action: Mapped[str | None] = mapped_column(Text, nullable=True)
    priority_level: Mapped[str | None] = mapped_column(String(32), nullable=True)
    disagreement_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    evidence_coverage_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    requires_hitl: Mapped[bool] = mapped_column(default=False, server_default="false", nullable=False)
    status: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    run: Mapped["AgentRun"] = relationship(back_populates="hypotheses")
    asset: Mapped["CompanyAsset"] = relationship(back_populates="hypotheses")
    blueprints: Mapped[list["Blueprint"]] = relationship(back_populates="hypothesis", cascade="all, delete-orphan")


class Blueprint(Base):
    __tablename__ = "blueprints"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hypothesis_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("hypotheses.id"), nullable=False, index=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    executive_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    technical_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    pdf_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    generation_status: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    hypothesis: Mapped["Hypothesis"] = relationship(back_populates="blueprints")
    notifications: Mapped[list["Notification"]] = relationship(back_populates="blueprint", cascade="all, delete-orphan")


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    blueprint_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("blueprints.id"), nullable=False, index=True)
    channel: Mapped[str] = mapped_column(String(64), nullable=False)
    message_preview: Mapped[str | None] = mapped_column(Text, nullable=True)
    delivery_status: Mapped[str] = mapped_column(String(64), nullable=False)
    external_message_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    blueprint: Mapped["Blueprint"] = relationship(back_populates="notifications")


class RunMemory(Base):
    __tablename__ = "run_memories"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("agent_runs.id"), nullable=False, index=True)
    memory_type: Mapped[str] = mapped_column(String(64), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    run: Mapped["AgentRun"] = relationship(back_populates="memories")


class AssetMemory(Base):
    __tablename__ = "asset_memories"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    asset_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("company_assets.id"), nullable=False, index=True)
    memory_type: Mapped[str] = mapped_column(String(64), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    source_run_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("agent_runs.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    asset: Mapped["CompanyAsset"] = relationship(back_populates="memories")


class HumanReview(Base):
    __tablename__ = "human_reviews"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("agent_runs.id"), nullable=False, index=True)
    asset_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("company_assets.id"), nullable=False, index=True)
    review_type: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending", server_default="pending")
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    recommended_reviewer: Mapped[str | None] = mapped_column(String(255), nullable=True)
    resolution_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    run: Mapped["AgentRun"] = relationship(back_populates="human_reviews")
    asset: Mapped["CompanyAsset"] = relationship(back_populates="human_reviews")


class EffortAnalysis(Base):
    __tablename__ = "effort_analyses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("agent_runs.id"), nullable=False, index=True)
    hypothesis_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("hypotheses.id"), nullable=False, index=True)
    estimated_cost_usd: Mapped[int] = mapped_column(Integer, nullable=False)
    estimated_time_months: Mapped[int] = mapped_column(Integer, nullable=False)
    trial_complexity: Mapped[str] = mapped_column(String(32), nullable=False)
    effort_score: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    run: Mapped["AgentRun"] = relationship()
    hypothesis: Mapped["Hypothesis"] = relationship()


class ImpactAnalysis(Base):
    __tablename__ = "impact_analyses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("agent_runs.id"), nullable=False, index=True)
    hypothesis_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("hypotheses.id"), nullable=False, index=True)
    patient_population_size: Mapped[int] = mapped_column(Integer, nullable=False)
    expected_breakthrough_score: Mapped[float] = mapped_column(Float, nullable=False)
    commercial_value_estimate: Mapped[str] = mapped_column(String(64), nullable=False)
    impact_score: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    run: Mapped["AgentRun"] = relationship()
    hypothesis: Mapped["Hypothesis"] = relationship()


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("agent_runs.id"), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(16), nullable=False)  # "user" or "assistant"
    content: Mapped[str] = mapped_column(Text, nullable=False)
    sources_json: Mapped[dict | list | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    run: Mapped["AgentRun"] = relationship()


class DiseaseWatchlist(Base):
    """User watchlist: 'alert me if any drug can treat this disease.'"""
    __tablename__ = "disease_watchlists"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    disease_query: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active", server_default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    alerts: Mapped[list["WatchlistAlert"]] = relationship(back_populates="watchlist", cascade="all, delete-orphan")


class WatchlistAlert(Base):
    """Fired when a background scan finds a drug matching a watchlist disease."""
    __tablename__ = "watchlist_alerts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    watchlist_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("disease_watchlists.id"), nullable=False, index=True)
    asset_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("company_assets.id"), nullable=False)
    run_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("agent_runs.id"), nullable=False)
    hypothesis_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("hypotheses.id"), nullable=False)
    asset_code: Mapped[str] = mapped_column(String(64), nullable=False)
    drug_name: Mapped[str] = mapped_column(String(255), nullable=False)
    original_indication: Mapped[str] = mapped_column(String(255), nullable=False)
    matched_disease: Mapped[str] = mapped_column(String(255), nullable=False)
    final_confidence: Mapped[float] = mapped_column(Float, nullable=False)
    risk_level: Mapped[str] = mapped_column(String(32), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    dismissed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    watchlist: Mapped["DiseaseWatchlist"] = relationship(back_populates="alerts")
    asset: Mapped["CompanyAsset"] = relationship()
    hypothesis: Mapped["Hypothesis"] = relationship()
