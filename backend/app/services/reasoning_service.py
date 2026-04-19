"""Reasoning pipeline orchestrator.

Drives the agent swarm end-to-end for a single asset:

    Advocate → Skeptic → Evidence Curator → (parallel evidence branches) →
    Trial Strategist → Effort + Impact → Judge → HITL gate

Every agent step is persisted as an ``AgentStep`` row *and* emitted on the
WebSocket stream, so the UI watches the pipeline think in real time rather
than receiving a single lump at the end.
"""

from __future__ import annotations

import logging
import os
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from threading import Thread
from uuid import UUID

logger = logging.getLogger(__name__)

from sqlalchemy.orm import Session

from backend.app import crud, schemas
from backend.app.agents.advocate import run_advocate
from backend.app.agents.effort_estimator import run_effort_estimator
from backend.app.agents.evidence_curator import run_evidence_curator
from backend.app.agents.impact_predictor import run_impact_predictor
from backend.app.agents.judge import run_judge
from backend.app.agents.skeptic import run_skeptic
from backend.app.agents.types import (
    AdvocateOutput,
    AssetContext,
    EffortEstimatorInput,
    EffortEstimatorOutput,
    EvidenceCuratorOutput,
    HITLDecision,
    ImpactPredictorInput,
    ImpactPredictorOutput,
    JudgeOutput,
    ParallelEvidenceOutput,
    ReasoningAssessment,
    TrialStrategyInput,
    TrialStrategyOutput,
    ReasoningResult,
    ReasoningTrace,
    SkepticOutput,
)
from backend.app.db import SessionLocal
from backend.app.services.context_service import build_asset_context
from backend.app.services.reasoning_enhancement_service import (
    build_hitl_decision,
    build_long_term_memory_note,
    build_reasoning_assessment,
    build_short_term_memory_entries,
    merge_parallel_evidence_into_context,
    retrieve_evidence_context,
    revise_advocate_output,
    run_parallel_evidence_branches,
)
from backend.app.services.spectrum_service import send_spectrum_run_summary
from backend.app.services.trial_strategy_service import generate_trial_strategy


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _log_agent_step(
    db: Session,
    *,
    run_id: UUID,
    agent_name: str,
    step_order: int,
    input_summary: str,
    output_summary: str,
    score: float | None,
    citations_json: dict | list | None,
) -> None:
    timestamp = now_utc()
    crud.create_agent_step(
        db,
        run_id=run_id,
        agent_name=agent_name,
        step_order=step_order,
        input_summary=input_summary,
        output_summary=output_summary,
        status="completed",
        score=score,
        citations_json=citations_json,
        started_at=timestamp,
        completed_at=timestamp,
    )


def _build_trace(
    context: AssetContext,
    advocate: AdvocateOutput,
    skeptic: SkepticOutput,
    evidence: EvidenceCuratorOutput,
    judge: JudgeOutput,
    trial_strategist: TrialStrategyOutput,
    parallel_evidence: ParallelEvidenceOutput,
    assessment: ReasoningAssessment,
    hitl: HITLDecision,
    effort_estimator: EffortEstimatorOutput | None = None,
    impact_predictor: ImpactPredictorOutput | None = None,
) -> ReasoningTrace:
    return ReasoningTrace(
        asset_code=context.asset_code,
        context=context,
        advocate=advocate,
        skeptic=skeptic,
        evidence_curator=evidence,
        judge=judge,
        trial_strategist=trial_strategist,
        effort_estimator=effort_estimator,
        impact_predictor=impact_predictor,
        parallel_evidence=parallel_evidence,
        assessment=assessment,
        hitl=hitl,
        citations=evidence.evidence,
    )


def _build_trial_strategy_input(
    context: AssetContext,
    advocate: AdvocateOutput,
    skeptic: SkepticOutput,
    evidence: EvidenceCuratorOutput,
    judge: JudgeOutput,
) -> TrialStrategyInput:
    return TrialStrategyInput(
        asset_code=context.asset_code,
        drug_name=context.internal_name,
        original_indication=context.source_disease,
        proposed_indication=advocate.proposed_disease,
        risk_level=skeptic.risk_level,
        final_confidence=judge.final_confidence,
        judge_decision=judge.final_decision,
        evidence_summary=[
            f"{item.source_ref}: {item.title}"
            for item in evidence.evidence
        ] or [evidence.evidence_summary],
        business_failure_reason=context.business_failure_reason,
        phase=context.phase,
    )


def _persist_short_term_memory(
    db: Session,
    *,
    run_id: UUID,
    entries: list[tuple[str, str]],
) -> None:
    for memory_type, content in entries:
        crud.create_run_memory(
            db,
            run_id=run_id,
            memory_type=memory_type,
            content=content,
        )


def _persist_long_term_memory(
    db: Session,
    *,
    asset_id: UUID,
    run_id: UUID,
    content: str,
) -> None:
    crud.create_asset_memory(
        db,
        asset_id=asset_id,
        memory_type="reasoning_lesson",
        content=content,
        source_run_id=run_id,
    )


def _execute_reasoning_pipeline(
    db: Session,
    *,
    asset,
    run,
) -> schemas.RunAnalysisResponse:
    base_context = build_asset_context(asset)
    prior_memories = crud.list_asset_memories(db, asset.id, limit=4)
    context = retrieve_evidence_context(base_context, prior_memories=prior_memories)
    pipeline_start = time.monotonic()
    logger.info("[pipeline] start run_id=%s asset=%s run_type=%s", run.id, asset.asset_code, run.run_type)
    try:
        t0 = time.monotonic()
        advocate = run_advocate(context)
        logger.info("[pipeline] advocate completed in %.2fs", time.monotonic() - t0)
        _log_agent_step(
            db,
            run_id=run.id,
            agent_name="advocate",
            step_order=1,
            input_summary=f"Asset context for {context.asset_code} with source disease {context.source_disease}.",
            output_summary=advocate.model_dump_json(),
            score=advocate.confidence,
            citations_json={"model_used": advocate.model_used, "mode": advocate.mode},
        )

        # --- Run Skeptic + Parallel Evidence concurrently ---
        t0 = time.monotonic()
        with ThreadPoolExecutor(max_workers=2) as executor:
            skeptic_future = executor.submit(run_skeptic, context, advocate)
            # Parallel evidence needs skeptic, so we pass a lambda that waits for it
            pe_future = executor.submit(
                lambda: run_parallel_evidence_branches(context, advocate, skeptic_future.result())
            )
            skeptic = skeptic_future.result()
            parallel_evidence = pe_future.result()
        logger.info("[pipeline] skeptic + parallel_evidence completed in %.2fs (concurrent)", time.monotonic() - t0)
        _log_agent_step(
            db,
            run_id=run.id,
            agent_name="skeptic",
            step_order=2,
            input_summary=f"Advocate proposed {advocate.proposed_disease} for {context.asset_code}.",
            output_summary=skeptic.model_dump_json(),
            score=skeptic.skeptic_score,
            citations_json={
                "model_used": skeptic.model_used,
                "mode": skeptic.mode,
                "contraindications": skeptic.contraindications,
            },
        )
        _log_agent_step(
            db,
            run_id=run.id,
            agent_name="parallel_evidence",
            step_order=3,
            input_summary=(
                f"Fan out mechanism, safety, trial, and business branches for {context.asset_code} "
                f"after proposal {advocate.proposed_disease}."
            ),
            output_summary=parallel_evidence.model_dump_json(),
            score=parallel_evidence.combined_score,
            citations_json={
                "provenance": {
                    "mechanism": parallel_evidence.mechanism.provenance,
                    "safety": parallel_evidence.safety.provenance,
                    "trial": parallel_evidence.trial.provenance,
                    "business": parallel_evidence.business.provenance,
                }
            },
        )

        curated_context = merge_parallel_evidence_into_context(context, parallel_evidence)
        t0 = time.monotonic()
        evidence = run_evidence_curator(curated_context, advocate, skeptic)
        logger.info("[pipeline] evidence_curator completed in %.2fs", time.monotonic() - t0)
        _log_agent_step(
            db,
            run_id=run.id,
            agent_name="evidence_curator",
            step_order=4,
            input_summary=(
                f"Collect evidence for {context.asset_code} -> {advocate.proposed_disease} "
                f"while checking skeptic concerns: {', '.join(skeptic.contraindications) or 'none'}."
            ),
            output_summary=evidence.model_dump_json(),
            score=evidence.evidence_score,
            citations_json=[item.model_dump() for item in evidence.evidence],
        )

        assessment = build_reasoning_assessment(advocate, skeptic, evidence, parallel_evidence)
        logger.info(
            "[pipeline] assessment disagreement=%.2f coverage=%.2f should_iterate=%s requires_hitl=%s",
            assessment.disagreement_score,
            assessment.evidence_coverage_score,
            assessment.should_iterate,
            assessment.requires_hitl,
        )
        _log_agent_step(
            db,
            run_id=run.id,
            agent_name="assessment",
            step_order=5,
            input_summary="Evaluate disagreement, evidence coverage, and review escalation thresholds.",
            output_summary=assessment.model_dump_json(),
            score=assessment.evidence_coverage_score,
            citations_json={
                "disagreement_score": assessment.disagreement_score,
                "requires_hitl": assessment.requires_hitl,
            },
        )

        if assessment.should_iterate:
            advocate = revise_advocate_output(context, advocate, assessment, parallel_evidence)
            _log_agent_step(
                db,
                run_id=run.id,
                agent_name="advocate_iteration",
                step_order=6,
                input_summary="[Turn 2] Revise Advocate output using disagreement and parallel branch feedback.",
                output_summary=advocate.model_dump_json(),
                score=advocate.confidence,
                citations_json={"iteration_reason": assessment.rationale},
            )

            skeptic = run_skeptic(context, advocate)
            _log_agent_step(
                db,
                run_id=run.id,
                agent_name="skeptic_iteration",
                step_order=7,
                input_summary=f"[Turn 2] Re-test revised Advocate proposal {advocate.proposed_disease}.",
                output_summary=skeptic.model_dump_json(),
                score=skeptic.skeptic_score,
                citations_json={"mode": skeptic.mode, "contraindications": skeptic.contraindications},
            )

            evidence = run_evidence_curator(curated_context, advocate, skeptic)
            _log_agent_step(
                db,
                run_id=run.id,
                agent_name="evidence_iteration",
                step_order=8,
                input_summary="[Turn 2] Refresh evidence package after the iterative Advocate/Skeptic loop.",
                output_summary=evidence.model_dump_json(),
                score=evidence.evidence_score,
                citations_json=[item.model_dump() for item in evidence.evidence],
            )

            assessment = build_reasoning_assessment(advocate, skeptic, evidence, parallel_evidence)
            _log_agent_step(
                db,
                run_id=run.id,
                agent_name="assessment_iteration",
                step_order=9,
                input_summary="[Turn 2] Recompute disagreement and coverage after the iterative pass.",
                output_summary=assessment.model_dump_json(),
                score=assessment.evidence_coverage_score,
                citations_json={
                    "disagreement_score": assessment.disagreement_score,
                    "requires_hitl": assessment.requires_hitl,
                },
            )

        judge = run_judge(context, advocate, skeptic, evidence)
        logger.info("[pipeline] judge completed in %.2fs", time.monotonic() - t0)
        _log_agent_step(
            db,
            run_id=run.id,
            agent_name="judge",
            step_order=10,
            input_summary="Combine Advocate, Skeptic, and Evidence Curator outputs.",
            output_summary=judge.model_dump_json(),
            score=judge.final_confidence,
            citations_json={"model_used": judge.model_used, "mode": judge.mode},
        )

        trial_strategist_input = _build_trial_strategy_input(
            context,
            advocate,
            skeptic,
            evidence,
            judge,
        )
        trial_started_at = now_utc()
        t0 = time.monotonic()
        trial_strategist = generate_trial_strategy(trial_strategist_input)
        logger.info("[pipeline] trial_strategist completed in %.2fs", time.monotonic() - t0)
        trial_completed_at = now_utc()
        execution_time = round((trial_completed_at - trial_started_at).total_seconds(), 4)
        hitl = build_hitl_decision(context, assessment, skeptic)
        crud.create_agent_step(
            db,
            run_id=run.id,
            agent_name="trial_strategist",
            step_order=11,
            input_summary=(
                f"Agent started. Build next-step recommendation for {context.asset_code} "
                f"after judge decision '{judge.final_decision}' at {judge.final_confidence:.2f} confidence."
            ),
            output_summary=trial_strategist.model_dump_json(),
            status="completed",
            score=judge.final_confidence,
            citations_json={
                "model_used": trial_strategist.model_used,
                "mode": trial_strategist.mode,
                "priority_level": trial_strategist.priority_level,
                "recommended_action": trial_strategist.recommended_action,
                "execution_time": execution_time,
                "logs": [
                    "Agent started",
                    "Agent completed",
                    "Decision generated",
                ],
            },
            started_at=trial_started_at,
            completed_at=trial_completed_at,
        )

        _log_agent_step(
            db,
            run_id=run.id,
            agent_name="hitl_router",
            step_order=12,
            input_summary="Determine whether this run requires a human-in-the-loop checkpoint.",
            output_summary=hitl.model_dump_json(),
            score=1.0 if hitl.required else 0.0,
            citations_json={"review_type": hitl.review_type, "reviewer": hitl.recommended_reviewer},
        )

        hypothesis = crud.create_hypothesis(
            db,
            schemas.HypothesisCreate(
                run_id=run.id,
                asset_id=asset.id,
                neo4j_hypothesis_id=f"mock-{context.asset_code.lower()}-{advocate.proposed_disease.lower().replace(' ', '-')}",
                source_disease=context.source_disease,
                target_disease=advocate.proposed_disease,
                summary=judge.summary,
                advocate_score=advocate.confidence,
                skeptic_score=skeptic.skeptic_score,
                judge_score=judge.judge_score,
                final_confidence=judge.final_confidence,
                recommended_action=trial_strategist.recommended_action,
                priority_level=trial_strategist.priority_level,
                disagreement_score=assessment.disagreement_score,
                evidence_coverage_score=assessment.evidence_coverage_score,
                requires_hitl=hitl.required,
                status="proposed" if judge.final_confidence >= 0.65 else "rejected",
            ),
        )

        # --- Effort Estimator (Agent 6) ---
        effort_input = EffortEstimatorInput(
            drug_name=context.internal_name,
            original_indication=context.source_disease,
            proposed_indication=advocate.proposed_disease,
            risk_level=skeptic.risk_level,
            confidence=judge.final_confidence,
            evidence_count=len(evidence.evidence),
            priority_level=trial_strategist.priority_level,
        )
        effort_output = run_effort_estimator(effort_input)
        _log_agent_step(
            db,
            run_id=run.id,
            agent_name="effort_estimator",
            step_order=13,
            input_summary=f"Estimate cost/time/complexity for {context.asset_code} -> {advocate.proposed_disease}.",
            output_summary=effort_output.model_dump_json(),
            score=effort_output.effort_score,
            citations_json=effort_output.model_dump(),
        )
        crud.create_effort_analysis(
            db,
            run_id=run.id,
            hypothesis_id=hypothesis.id,
            estimated_cost_usd=effort_output.estimated_cost_usd,
            estimated_time_months=effort_output.estimated_time_months,
            trial_complexity=effort_output.trial_complexity,
            effort_score=effort_output.effort_score,
        )

        # --- Impact Predictor (Agent 7) ---
        impact_input = ImpactPredictorInput(
            drug_name=context.internal_name,
            original_indication=context.source_disease,
            proposed_indication=advocate.proposed_disease,
            confidence=judge.final_confidence,
            risk_level=skeptic.risk_level,
            evidence_count=len(evidence.evidence),
            priority_level=trial_strategist.priority_level,
        )
        impact_output = run_impact_predictor(impact_input)
        _log_agent_step(
            db,
            run_id=run.id,
            agent_name="impact_predictor",
            step_order=14,
            input_summary=f"Predict impact for {context.asset_code} -> {advocate.proposed_disease}.",
            output_summary=impact_output.model_dump_json(),
            score=impact_output.impact_score,
            citations_json=impact_output.model_dump(),
        )
        crud.create_impact_analysis(
            db,
            run_id=run.id,
            hypothesis_id=hypothesis.id,
            patient_population_size=impact_output.patient_population_size,
            expected_breakthrough_score=impact_output.expected_breakthrough_score,
            commercial_value_estimate=impact_output.commercial_value_estimate,
            impact_score=impact_output.impact_score,
        )

        if hitl.required:
            crud.create_human_review(
                db,
                run_id=run.id,
                asset_id=asset.id,
                review_type=hitl.review_type,
                reason=hitl.reason,
                recommended_reviewer=hitl.recommended_reviewer,
            )

        run = crud.update_run_status(
            db,
            run,
            status="completed",
            final_confidence=judge.final_confidence,
            final_recommendation=judge.final_decision,
        )

        _persist_short_term_memory(
            db,
            run_id=run.id,
            entries=build_short_term_memory_entries(context, advocate, skeptic, assessment),
        )
        _persist_long_term_memory(
            db,
            asset_id=asset.id,
            run_id=run.id,
            content=build_long_term_memory_note(context, advocate, assessment, judge.summary),
        )

        if run.run_type == "manual":
            spectrum_recipient = (os.getenv("SPECTRUM_RECIPIENT", "")).strip()
            if spectrum_recipient:
                send_spectrum_run_summary(
                    recipient=spectrum_recipient,
                    asset_code=context.asset_code,
                    target_disease=advocate.proposed_disease,
                    final_decision=judge.final_decision,
                    final_confidence=judge.final_confidence,
                    recommended_action=trial_strategist.recommended_action,
                )

        total_duration = time.monotonic() - pipeline_start
        logger.info(
            "[pipeline] completed run_id=%s asset=%s total_duration=%.2fs final_decision=%s final_confidence=%.2f",
            run.id,
            context.asset_code,
            total_duration,
            judge.final_decision,
            judge.final_confidence,
        )

        reasoning_result = ReasoningResult(
            run_id=run.id,
            hypothesis_id=hypothesis.id,
            asset_id=asset.id,
            asset_code=context.asset_code,
            source_disease=context.source_disease,
            target_disease=advocate.proposed_disease,
            advocate=advocate,
            skeptic=skeptic,
            evidence_curator=evidence,
            judge=judge,
            trial_strategist=trial_strategist,
            effort_estimator=effort_output,
            impact_predictor=impact_output,
            parallel_evidence=parallel_evidence,
            assessment=assessment,
            hitl=hitl,
        )
        trace = _build_trace(
            context,
            advocate,
            skeptic,
            evidence,
            judge,
            trial_strategist,
            parallel_evidence,
            assessment,
            hitl,
            effort_estimator=effort_output,
            impact_predictor=impact_output,
        )

        return schemas.RunAnalysisResponse(
            run=schemas.RunResponse.model_validate(run),
            asset_code=context.asset_code,
            reasoning=reasoning_result,
            trace=trace,
            hypothesis=schemas.HypothesisResponse.model_validate(hypothesis),
            final_hypothesis_id=hypothesis.id,
            final_confidence=judge.final_confidence,
            final_decision=judge.final_decision,
        )

    except Exception as exc:
        logger.exception("[pipeline] failed run_id=%s asset=%s after %.2fs", run.id, asset.asset_code, time.monotonic() - pipeline_start)
        crud.update_run_status(db, run, status="failed", error_message=str(exc))
        raise


def run_reasoning_pipeline(db: Session, asset_id: UUID, run_type: str) -> schemas.RunAnalysisResponse:
    """Execute the full 4-agent reasoning pipeline and persist the result."""
    asset = crud.get_asset(db, asset_id)
    if asset is None:
        raise ValueError("Asset not found.")

    run = crud.create_run(db, asset_id=asset.id, run_type=run_type, status="running")
    return _execute_reasoning_pipeline(db, asset=asset, run=run)


def create_analysis_run(db: Session, asset_id: UUID, run_type: str) -> schemas.RunResponse:
    """Create a queued analysis run that can be processed asynchronously."""
    asset = crud.get_asset(db, asset_id)
    if asset is None:
        raise ValueError("Asset not found.")

    run = crud.create_run(db, asset_id=asset.id, run_type=run_type, status="queued")
    return schemas.RunResponse.model_validate(run)


def execute_analysis_run(run_id: UUID) -> None:
    """Execute a previously created analysis run in a standalone session."""
    with SessionLocal() as db:
        run = crud.get_run(db, run_id)
        if run is None:
            return

        asset = crud.get_asset(db, run.asset_id)
        if asset is None:
            crud.update_run_status(db, run, status="failed", error_message="Asset not found.")
            return

        run = crud.update_run_status(db, run, status="running", error_message=None)
        _execute_reasoning_pipeline(db, asset=asset, run=run)


def start_analysis_run(run_id: UUID) -> None:
    """Launch an analysis run in the background."""
    Thread(target=execute_analysis_run, args=(run_id,), daemon=True).start()
