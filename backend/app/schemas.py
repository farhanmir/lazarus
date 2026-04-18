"""Pydantic schemas for the Step 2 backend."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from backend.app.agents.types import ReasoningResult, ReasoningTrace


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class AssetCreate(BaseModel):
    asset_code: str
    internal_name: str
    original_indication: str
    portfolio_status: str
    business_failure_reason: str | None = None
    phase: str | None = None
    owner_company: str | None = None


class AssetResponse(ORMModel):
    id: UUID
    asset_code: str
    internal_name: str
    original_indication: str
    portfolio_status: str
    business_failure_reason: str | None = None
    phase: str | None = None
    owner_company: str | None = None
    created_at: datetime
    updated_at: datetime


class RunCreate(BaseModel):
    asset_id: UUID
    run_type: str = "manual"


class RunResponse(ORMModel):
    id: UUID
    asset_id: UUID
    run_type: str
    status: str
    started_at: datetime | None = None
    completed_at: datetime | None = None
    final_confidence: float | None = None
    final_recommendation: str | None = None
    error_message: str | None = None
    created_at: datetime


class StepResponse(ORMModel):
    id: UUID
    run_id: UUID
    agent_name: str
    step_order: int
    input_summary: str | None = None
    output_summary: str | None = None
    status: str
    score: float | None = None
    citations_json: dict | list | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime


class RunDetailResponse(RunResponse):
    steps: list[StepResponse] = Field(default_factory=list)


class HypothesisCreate(BaseModel):
    run_id: UUID
    asset_id: UUID
    neo4j_hypothesis_id: str | None = None
    source_disease: str
    target_disease: str
    summary: str
    advocate_score: float | None = None
    skeptic_score: float | None = None
    judge_score: float | None = None
    final_confidence: float | None = None
    recommended_action: str | None = None
    priority_level: str | None = None
    disagreement_score: float | None = None
    evidence_coverage_score: float | None = None
    requires_hitl: bool = False
    status: str


class HypothesisResponse(ORMModel):
    id: UUID
    run_id: UUID
    asset_id: UUID
    neo4j_hypothesis_id: str | None = None
    source_disease: str
    target_disease: str
    summary: str
    advocate_score: float | None = None
    skeptic_score: float | None = None
    judge_score: float | None = None
    final_confidence: float | None = None
    recommended_action: str | None = None
    priority_level: str | None = None
    disagreement_score: float | None = None
    evidence_coverage_score: float | None = None
    requires_hitl: bool
    status: str
    created_at: datetime


class RunMemoryResponse(ORMModel):
    id: UUID
    run_id: UUID
    memory_type: str
    content: str
    created_at: datetime


class AssetMemoryResponse(ORMModel):
    id: UUID
    asset_id: UUID
    memory_type: str
    content: str
    source_run_id: UUID | None = None
    created_at: datetime


class HumanReviewResolveRequest(BaseModel):
    resolution_notes: str


class HumanReviewResponse(ORMModel):
    id: UUID
    run_id: UUID
    asset_id: UUID
    review_type: str
    status: str
    reason: str
    recommended_reviewer: str | None = None
    resolution_notes: str | None = None
    created_at: datetime
    resolved_at: datetime | None = None


class BlueprintCreate(BaseModel):
    hypothesis_id: UUID


class BlueprintEvidenceItem(BaseModel):
    source_ref: str
    title: str
    snippet: str
    evidence_type: str


class BlueprintPayload(BaseModel):
    drug_name: str
    asset_code: str
    owner_company: str | None = None
    phase: str | None = None
    business_failure_reason: str | None = None
    original_indication: str
    proposed_indication: str
    executive_summary: str
    supporting_evidence: list[BlueprintEvidenceItem]
    risk_level: str
    risk_summary: str
    confidence_score: float
    recommendation: str
    generated_at: datetime
    technical_summary: str
    advocate_score: float | None = None
    skeptic_score: float | None = None
    judge_score: float | None = None
    recommended_action: str
    suggested_patient_cohort: str
    trial_focus: str
    priority_level: str
    business_rationale: str


class BlueprintResponse(ORMModel):
    id: UUID
    hypothesis_id: UUID
    version: int
    title: str
    executive_summary: str | None = None
    technical_summary: str | None = None
    pdf_path: str | None = None
    generation_status: str
    created_at: datetime


class GraphNode(BaseModel):
    id: str
    type: str
    label: str
    description: str | None = None
    confidence: float | None = None
    highlight: bool = False


class GraphLink(BaseModel):
    source: str
    target: str
    relationship: str
    highlight: bool = False


class GraphResponse(BaseModel):
    asset_id: UUID
    asset_code: str
    hypothesis_id: UUID | None = None
    nodes: list[GraphNode]
    links: list[GraphLink]


class NotificationResponse(ORMModel):
    id: UUID
    blueprint_id: UUID
    channel: str
    message_preview: str | None = None
    delivery_status: str
    external_message_id: str | None = None
    sent_at: datetime | None = None
    created_at: datetime


class RunAnalysisResponse(BaseModel):
    run: RunResponse
    asset_code: str
    reasoning: ReasoningResult
    trace: ReasoningTrace
    hypothesis: HypothesisResponse
    final_hypothesis_id: UUID
    final_confidence: float
    final_decision: str


class RunTraceResponse(BaseModel):
    run: RunResponse
    asset_code: str
    hypothesis: HypothesisResponse | None = None
    steps: list[StepResponse]


class BlueprintGenerationResponse(BaseModel):
    blueprint: BlueprintResponse
    payload: BlueprintPayload
    notification: NotificationResponse | None = None


class AnalysisJobResponse(BaseModel):
    run: RunResponse
    asset_code: str
    status_url: str
    trace_url: str


class BlueprintJobResponse(BaseModel):
    blueprint: BlueprintResponse
    status_url: str
    download_url: str


class BlueprintDetailResponse(BaseModel):
    blueprint: BlueprintResponse
    payload: BlueprintPayload | None = None


class OpenClawReviewRequest(BaseModel):
    asset_code: str
    run_type: str = "manual"
    generate_blueprint: bool = False
    create_notification: bool = False


class OpenClawBlueprintRequest(BaseModel):
    hypothesis_id: UUID | None = None
    asset_code: str | None = None
    create_notification: bool = False


class OpenClawReviewResponse(BaseModel):
    asset_code: str
    run_id: UUID
    hypothesis_id: UUID
    final_decision: str
    final_confidence: float
    target_disease: str
    summary: str
    blueprint_id: UUID | None = None
    blueprint_download_url: str | None = None
    response_text: str


class OpenClawBlueprintResponse(BaseModel):
    blueprint_id: UUID
    hypothesis_id: UUID
    asset_code: str
    title: str
    pdf_path: str | None = None
    download_url: str | None = None
    response_text: str


class SpectrumWebhookRequest(BaseModel):
    text: str | None = None
    sender_id: str | None = None
    action: str | None = None
    asset_code: str | None = None
    hypothesis_id: UUID | None = None
    generate_blueprint: bool = False
    create_notification: bool = False


class SpectrumWebhookResponse(BaseModel):
    status: str
    action: str
    response_text: str
    asset_code: str | None = None
    run_id: UUID | None = None
    hypothesis_id: UUID | None = None
    blueprint_id: UUID | None = None
    blueprint_download_url: str | None = None


PhotonSpectrumWebhookRequest = SpectrumWebhookRequest
PhotonSpectrumWebhookResponse = SpectrumWebhookResponse


# --- Effort & Impact Analysis ---


class EffortAnalysisResponse(ORMModel):
    id: UUID
    run_id: UUID
    hypothesis_id: UUID
    estimated_cost_usd: int
    estimated_time_months: int
    trial_complexity: str
    effort_score: float
    created_at: datetime


class ImpactAnalysisResponse(ORMModel):
    id: UUID
    run_id: UUID
    hypothesis_id: UUID
    patient_population_size: int
    expected_breakthrough_score: float
    commercial_value_estimate: str
    impact_score: float
    created_at: datetime


class EffortImpactSummary(BaseModel):
    effort: EffortAnalysisResponse
    impact: ImpactAnalysisResponse
    investment_readiness_score: float


# --- Messages (Follow-Up Assistant) ---


class MessageCreate(BaseModel):
    run_id: UUID
    question: str


class MessageResponse(ORMModel):
    id: UUID
    run_id: UUID
    role: str
    content: str
    sources_json: dict | list | None = None
    created_at: datetime


class ConversationResponse(BaseModel):
    run_id: UUID
    messages: list[MessageResponse]
