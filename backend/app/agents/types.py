"""Shared structured types for the Step 3 reasoning pipeline."""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, Field


class EvidenceReference(BaseModel):
    source_ref: str
    title: str
    snippet: str
    evidence_type: str


class AssetContext(BaseModel):
    asset_id: UUID
    asset_code: str
    internal_name: str
    source_disease: str
    portfolio_status: str
    business_failure_reason: str | None = None
    phase: str | None = None
    owner_company: str | None = None
    target: str
    linked_diseases: list[str]
    adverse_events: list[str]
    evidence_refs: list[EvidenceReference]
    context_source: str = "deterministic_context_builder"


class AdvocateOutput(BaseModel):
    proposed_disease: str
    reasoning: str
    confidence: float
    model_used: str
    mode: str


class SkepticOutput(BaseModel):
    risk_level: str
    contraindications: list[str]
    conflict_summary: str
    skeptic_score: float
    verdict: str
    model_used: str
    mode: str


class EvidenceItem(BaseModel):
    source_ref: str
    title: str
    snippet: str
    evidence_type: str


class EvidenceCuratorOutput(BaseModel):
    evidence: list[EvidenceItem]
    evidence_summary: str
    evidence_score: float
    addressed_concerns: list[str] = Field(default_factory=list)
    unresolved_concerns: list[str] = Field(default_factory=list)
    model_used: str
    mode: str


class JudgeOutput(BaseModel):
    final_decision: str
    summary: str
    judge_score: float
    final_confidence: float
    recommended_next_step: str
    model_used: str
    mode: str


class TrialStrategyInput(BaseModel):
    asset_code: str
    drug_name: str
    original_indication: str
    proposed_indication: str
    risk_level: str
    final_confidence: float
    judge_decision: str
    evidence_summary: list[str]
    business_failure_reason: str | None = None
    phase: str | None = None


class TrialStrategyOutput(BaseModel):
    recommended_action: str
    suggested_patient_cohort: str
    trial_focus: str
    business_rationale: str
    priority_level: str
    model_used: str
    mode: str


class ParallelEvidenceBranchOutput(BaseModel):
    branch_name: str
    score: float
    summary: str
    supporting_points: list[str] = Field(default_factory=list)
    provenance: list[str] = Field(default_factory=list)


class ParallelEvidenceOutput(BaseModel):
    mechanism: ParallelEvidenceBranchOutput
    safety: ParallelEvidenceBranchOutput
    trial: ParallelEvidenceBranchOutput
    business: ParallelEvidenceBranchOutput
    combined_score: float


class ReasoningAssessment(BaseModel):
    disagreement_score: float
    evidence_coverage_score: float
    unresolved_gaps: list[str] = Field(default_factory=list)
    should_iterate: bool
    requires_hitl: bool
    rationale: str


class HITLDecision(BaseModel):
    required: bool
    review_type: str
    reason: str
    recommended_reviewer: str


class ReasoningResult(BaseModel):
    run_id: UUID
    hypothesis_id: UUID
    asset_id: UUID
    asset_code: str
    source_disease: str
    target_disease: str
    advocate: AdvocateOutput
    skeptic: SkepticOutput
    evidence_curator: EvidenceCuratorOutput
    judge: JudgeOutput
    trial_strategist: TrialStrategyOutput
    parallel_evidence: ParallelEvidenceOutput
    assessment: ReasoningAssessment
    hitl: HITLDecision


class ReasoningTrace(BaseModel):
    asset_code: str
    context: AssetContext
    advocate: AdvocateOutput
    skeptic: SkepticOutput
    evidence_curator: EvidenceCuratorOutput
    judge: JudgeOutput
    trial_strategist: TrialStrategyOutput
    parallel_evidence: ParallelEvidenceOutput
    assessment: ReasoningAssessment
    hitl: HITLDecision
    citations: list[EvidenceItem] = Field(default_factory=list)
