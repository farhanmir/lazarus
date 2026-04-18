"""Enhancement layer for iterative, parallel, and memory-aware reasoning."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from threading import Lock

from backend.app.agents.types import (
    AdvocateOutput,
    AssetContext,
    EvidenceCuratorOutput,
    EvidenceReference,
    HITLDecision,
    ParallelEvidenceBranchOutput,
    ParallelEvidenceOutput,
    ReasoningAssessment,
    SkepticOutput,
)
from backend.app.models import AssetMemory

_retrieval_cache: dict[str, list[EvidenceReference]] = {}
_cache_lock = Lock()


def _dedupe_evidence(items: list[EvidenceReference]) -> list[EvidenceReference]:
    seen: set[tuple[str, str]] = set()
    deduped: list[EvidenceReference] = []
    for item in items:
        key = (item.source_ref, item.title)
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)
    return deduped


def retrieve_evidence_context(
    context: AssetContext,
    *,
    prior_memories: list[AssetMemory] | None = None,
) -> AssetContext:
    """Build a lightweight retrieval-backed evidence view with caching and provenance."""
    cache_key = f"{context.asset_code}:{context.source_disease}:{context.target}"

    with _cache_lock:
        cached = _retrieval_cache.get(cache_key)

    if cached is not None:
        return context.model_copy(update={"evidence_refs": cached, "context_source": "retrieval_cache"})

    augmented = list(context.evidence_refs)
    augmented.append(
        EvidenceReference(
            source_ref=f"RETRIEVAL-{context.asset_code}",
            title=f"{context.target} repositioning retrieval bundle",
            snippet=(
                f"Retrieved internal repositioning context for {context.asset_code} linking "
                f"{context.source_disease} to {', '.join(context.linked_diseases)} through {context.target}."
            ),
            evidence_type="retrieval_bundle",
        )
    )

    for memory in prior_memories or []:
        augmented.append(
            EvidenceReference(
                source_ref=f"MEM-{memory.id}",
                title=f"Prior run memory for {context.asset_code}",
                snippet=memory.content,
                evidence_type="long_term_memory",
            )
        )

    deduped = _dedupe_evidence(augmented)
    with _cache_lock:
        _retrieval_cache[cache_key] = deduped

    return context.model_copy(update={"evidence_refs": deduped, "context_source": "retrieval_augmented"})


def _build_mechanism_branch(context: AssetContext, advocate: AdvocateOutput, _: SkepticOutput) -> ParallelEvidenceBranchOutput:
    overlap = advocate.proposed_disease in context.linked_diseases
    score = 0.86 if overlap else 0.58
    return ParallelEvidenceBranchOutput(
        branch_name="mechanism",
        score=score,
        summary=(
            f"{context.target} provides the primary mechanistic bridge from {context.source_disease} "
            f"to {advocate.proposed_disease}."
        ),
        supporting_points=[
            f"Target {context.target} is linked to {', '.join(context.linked_diseases)}.",
            f"Advocate selected {advocate.proposed_disease} based on pathway overlap.",
        ],
        provenance=[item.source_ref for item in context.evidence_refs[:2]],
    )


def _build_safety_branch(context: AssetContext, _: AdvocateOutput, skeptic: SkepticOutput) -> ParallelEvidenceBranchOutput:
    score = 0.82 if skeptic.risk_level.lower() != "high" else 0.34
    concerns = skeptic.contraindications or context.adverse_events
    return ParallelEvidenceBranchOutput(
        branch_name="safety",
        score=score,
        summary=f"Safety review observed {skeptic.risk_level} risk with focus on {', '.join(concerns[:2])}.",
        supporting_points=[
            f"Known adverse events: {', '.join(context.adverse_events)}.",
            f"Skeptic verdict: {skeptic.verdict}.",
        ],
        provenance=["safety_history", *[item.source_ref for item in context.evidence_refs if item.evidence_type == "clinical_trial"]],
    )


def _build_trial_branch(context: AssetContext, _: AdvocateOutput, __: SkepticOutput) -> ParallelEvidenceBranchOutput:
    later_phase = "2" in (context.phase or "")
    score = 0.84 if later_phase else 0.63
    return ParallelEvidenceBranchOutput(
        branch_name="trial",
        score=score,
        summary=f"Prior {context.phase or 'early'} program history supports {'mid-stage reuse' if later_phase else 'exploratory validation'}.",
        supporting_points=[
            f"Portfolio status: {context.portfolio_status}.",
            f"Failure reason: {context.business_failure_reason or 'unknown'}.",
        ],
        provenance=[item.source_ref for item in context.evidence_refs if item.evidence_type in {"clinical_trial", "internal_memo"}],
    )


def _build_business_branch(context: AssetContext, _: AdvocateOutput, skeptic: SkepticOutput) -> ParallelEvidenceBranchOutput:
    execution_failure = (context.business_failure_reason or "").lower() in {"poor_enrollment", "funding_cut", "strategic_pivot"}
    score = 0.8 if execution_failure and skeptic.risk_level.lower() != "high" else 0.55
    return ParallelEvidenceBranchOutput(
        branch_name="business",
        score=score,
        summary="Business review favors reuse when prior failure was operational rather than mechanistic.",
        supporting_points=[
            f"Failure reason: {context.business_failure_reason or 'unknown'}.",
            f"Owner company: {context.owner_company or 'internal portfolio'}.",
        ],
        provenance=["portfolio_record", context.asset_code],
    )


def run_parallel_evidence_branches(
    context: AssetContext,
    advocate: AdvocateOutput,
    skeptic: SkepticOutput,
) -> ParallelEvidenceOutput:
    with ThreadPoolExecutor(max_workers=4) as executor:
        mechanism_future = executor.submit(_build_mechanism_branch, context, advocate, skeptic)
        safety_future = executor.submit(_build_safety_branch, context, advocate, skeptic)
        trial_future = executor.submit(_build_trial_branch, context, advocate, skeptic)
        business_future = executor.submit(_build_business_branch, context, advocate, skeptic)

        mechanism = mechanism_future.result()
        safety = safety_future.result()
        trial = trial_future.result()
        business = business_future.result()

    combined = round((mechanism.score + safety.score + trial.score + business.score) / 4, 4)
    return ParallelEvidenceOutput(
        mechanism=mechanism,
        safety=safety,
        trial=trial,
        business=business,
        combined_score=combined,
    )


def merge_parallel_evidence_into_context(
    context: AssetContext,
    parallel_output: ParallelEvidenceOutput,
) -> AssetContext:
    additional = [
        EvidenceReference(
            source_ref=f"BRANCH-{branch.branch_name.upper()}",
            title=f"{branch.branch_name.capitalize()} evidence branch",
            snippet=branch.summary,
            evidence_type=f"{branch.branch_name}_branch",
        )
        for branch in [
            parallel_output.mechanism,
            parallel_output.safety,
            parallel_output.trial,
            parallel_output.business,
        ]
    ]
    merged = _dedupe_evidence([*context.evidence_refs, *additional])
    return context.model_copy(update={"evidence_refs": merged})


def build_reasoning_assessment(
    advocate: AdvocateOutput,
    skeptic: SkepticOutput,
    evidence: EvidenceCuratorOutput,
    parallel_output: ParallelEvidenceOutput,
) -> ReasoningAssessment:
    risk_penalty = {"low": 0.05, "medium": 0.22, "high": 0.42}.get(skeptic.risk_level.lower(), 0.25)
    disagreement = max(0.0, min(1.0, abs(advocate.confidence - skeptic.skeptic_score) + risk_penalty))

    branch_scores = [
        parallel_output.mechanism.score,
        parallel_output.safety.score,
        parallel_output.trial.score,
        parallel_output.business.score,
    ]
    concern_denominator = max(1, len(evidence.addressed_concerns) + len(evidence.unresolved_concerns))
    concern_ratio = len(evidence.addressed_concerns) / concern_denominator
    coverage = max(
        0.0,
        min(
            1.0,
            (evidence.evidence_score * 0.55)
            + (parallel_output.combined_score * 0.25)
            + (concern_ratio * 0.20),
        ),
    )

    unresolved = list(evidence.unresolved_concerns)
    if skeptic.risk_level.lower() == "high":
        unresolved.append("High risk profile requires explicit human confirmation.")
    if parallel_output.safety.score < 0.5:
        unresolved.append("Safety branch remains weak relative to mechanism evidence.")

    should_iterate = disagreement >= 0.42 or coverage < 0.68 or bool(evidence.unresolved_concerns)
    requires_hitl = skeptic.risk_level.lower() == "high" or disagreement >= 0.58 or coverage < 0.55
    rationale = (
        f"Disagreement scored {disagreement:.2f} and evidence coverage scored {coverage:.2f}; "
        f"{'a revision loop was triggered' if should_iterate else 'the initial recommendation was consistent enough to proceed'}."
    )

    return ReasoningAssessment(
        disagreement_score=round(disagreement, 4),
        evidence_coverage_score=round(coverage, 4),
        unresolved_gaps=unresolved,
        should_iterate=should_iterate,
        requires_hitl=requires_hitl,
        rationale=rationale,
    )


def revise_advocate_output(
    context: AssetContext,
    advocate: AdvocateOutput,
    assessment: ReasoningAssessment,
    parallel_output: ParallelEvidenceOutput,
) -> AdvocateOutput:
    alternative = next(
        (disease for disease in context.linked_diseases if disease != advocate.proposed_disease),
        advocate.proposed_disease,
    )
    should_switch = (
        assessment.requires_hitl
        and parallel_output.safety.score < 0.45
        and parallel_output.mechanism.score >= 0.72
        and alternative != advocate.proposed_disease
    )
    revised_disease = alternative if should_switch else advocate.proposed_disease
    revised_confidence = max(0.45, advocate.confidence - (assessment.disagreement_score * 0.18))
    revised_reasoning = (
        f"{advocate.reasoning} Revision pass incorporated safety/trial/business branches and "
        f"{'shifted focus to ' + revised_disease if should_switch else 'retained the original indication with tighter confidence bounds'}."
    )
    return AdvocateOutput(
        proposed_disease=revised_disease,
        reasoning=revised_reasoning,
        confidence=round(revised_confidence, 4),
        model_used=advocate.model_used,
        mode=f"{advocate.mode}_iterated",
    )


def build_hitl_decision(
    context: AssetContext,
    assessment: ReasoningAssessment,
    skeptic: SkepticOutput,
) -> HITLDecision:
    if not assessment.requires_hitl:
        return HITLDecision(
            required=False,
            review_type="none",
            reason="Automated coverage and disagreement thresholds were acceptable.",
            recommended_reviewer="not_required",
        )

    review_type = "safety_board" if skeptic.risk_level.lower() == "high" else "portfolio_committee"
    reviewer = "Clinical Safety Lead" if review_type == "safety_board" else "Portfolio Strategy Lead"
    return HITLDecision(
        required=True,
        review_type=review_type,
        reason=(
            f"{context.asset_code} requires human review because disagreement is {assessment.disagreement_score:.2f} "
            f"and evidence coverage is {assessment.evidence_coverage_score:.2f}."
        ),
        recommended_reviewer=reviewer,
    )


def build_short_term_memory_entries(
    context: AssetContext,
    advocate: AdvocateOutput,
    skeptic: SkepticOutput,
    assessment: ReasoningAssessment,
) -> list[tuple[str, str]]:
    return [
        ("context", f"{context.asset_code} targets {context.target} with source disease {context.source_disease}."),
        ("proposal", f"Advocate proposed {advocate.proposed_disease} at {advocate.confidence:.2f} confidence."),
        ("risk", f"Skeptic marked risk as {skeptic.risk_level} with verdict '{skeptic.verdict}'."),
        ("assessment", assessment.rationale),
    ]


def build_long_term_memory_note(
    context: AssetContext,
    advocate: AdvocateOutput,
    assessment: ReasoningAssessment,
    judge_summary: str,
) -> str:
    return (
        f"{context.asset_code} was reviewed for {advocate.proposed_disease}. "
        f"Disagreement={assessment.disagreement_score:.2f}, coverage={assessment.evidence_coverage_score:.2f}. "
        f"Judge summary: {judge_summary}"
    )
