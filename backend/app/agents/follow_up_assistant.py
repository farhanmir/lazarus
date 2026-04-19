"""Follow-Up Assistant agent — grounded Q&A over run outputs, hypotheses, and blueprints."""

from __future__ import annotations

import json
import os
from uuid import UUID

from sqlalchemy.orm import Session

from backend.app import crud
from backend.app.agents.types import FollowUpAnswer
from backend.app.services.llm_service import openai_chat_completion


def _gather_run_context(db: Session, run_id: UUID) -> dict[str, str]:
    """Pull all persisted agent outputs for a run into a searchable context dict."""
    steps = crud.list_steps_by_run(db, run_id)
    context: dict[str, str] = {}
    for step in steps:
        key = step.agent_name
        context[key] = step.output_summary or ""
    return context


def _gather_hypothesis_context(db: Session, run_id: UUID) -> list[dict]:
    run = crud.get_run(db, run_id)
    if run is None:
        return []
    hyps = []
    for h in getattr(run, "hypotheses", []):
        hyps.append({
            "id": str(h.id),
            "source_disease": h.source_disease,
            "target_disease": h.target_disease,
            "summary": h.summary,
            "advocate_score": h.advocate_score,
            "skeptic_score": h.skeptic_score,
            "judge_score": h.judge_score,
            "final_confidence": h.final_confidence,
            "recommended_action": h.recommended_action,
            "priority_level": h.priority_level,
        })
    return hyps


_KEYWORD_AGENT_MAP = {
    "advocate": ["advocate", "proposal", "proposed", "repurpos"],
    "skeptic": ["skeptic", "risk", "contraindic", "concern", "danger"],
    "evidence_curator": ["evidence", "curator", "citation", "source", "paper"],
    "judge": ["judge", "decision", "verdict", "confidence", "final"],
    "trial_strategist": ["trial", "strategy", "cohort", "patient", "action"],
    "effort_estimator": ["effort", "cost", "time", "month", "complex", "expensive"],
    "impact_predictor": ["impact", "population", "breakthrough", "commercial", "value"],
    "parallel_evidence": ["parallel", "branch", "mechanism", "safety"],
    "assessment": ["disagreement", "coverage", "hitl", "iterate"],
}


def _find_relevant_agents(question: str) -> list[str]:
    q = question.lower()
    matches = []
    for agent, keywords in _KEYWORD_AGENT_MAP.items():
        if any(kw in q for kw in keywords):
            matches.append(agent)
    return matches or list(_KEYWORD_AGENT_MAP.keys())  # if no match, search all


_AGENT_LABELS = {
    "advocate": "Advocate",
    "skeptic": "Skeptic",
    "evidence_curator": "Evidence Curator",
    "judge": "Judge",
    "trial_strategist": "Trial Strategist",
    "effort_estimator": "Effort Estimator",
    "impact_predictor": "Impact Predictor",
    "parallel_evidence": "Parallel Evidence",
    "assessment": "Assessment",
}

_FIELD_LABELS = {
    "proposed_disease": "Proposed Disease",
    "target_disease": "Target Disease",
    "source_disease": "Source Disease",
    "reasoning": "Reasoning",
    "confidence": "Confidence",
    "model_used": "Model",
    "mode": "Mode",
    "risk_level": "Risk Level",
    "risk_factors": "Risk Factors",
    "concerns": "Concerns",
    "recommendation": "Recommendation",
    "recommended_action": "Recommended Action",
    "decision": "Decision",
    "verdict": "Verdict",
    "final_confidence": "Final Confidence",
    "summary": "Summary",
    "estimated_cost_usd": "Estimated Cost (USD)",
    "estimated_time_months": "Estimated Timeline (months)",
    "trial_complexity": "Trial Complexity",
    "effort_score": "Effort Score",
    "patient_population_size": "Patient Population",
    "expected_breakthrough_score": "Breakthrough Score",
    "commercial_value_estimate": "Commercial Value",
    "impact_score": "Impact Score",
    "citations": "Citations",
    "evidence_quality": "Evidence Quality",
    "mechanism_of_action": "Mechanism of Action",
}


def _format_value(value: object) -> str:
    """Format a single value for display."""
    if isinstance(value, float):
        return f"{value:.2f}"
    if isinstance(value, list):
        if not value:
            return "None"
        if all(isinstance(v, str) for v in value):
            return ", ".join(value)
        return "; ".join(str(v) for v in value)
    if isinstance(value, dict):
        parts = [f"  {k}: {v}" for k, v in value.items()]
        return "\n" + "\n".join(parts)
    return str(value)


def _format_snippet(agent_name: str, raw: str) -> str:
    """Convert a raw agent output (often JSON) into readable plain text."""
    label = _AGENT_LABELS.get(agent_name, agent_name.replace("_", " ").title())

    # Try to parse as JSON
    try:
        data = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        # Not JSON — return as-is with a header
        return f"{label}: {raw}"

    if isinstance(data, dict):
        lines = [f"{label}:"]
        for key, value in data.items():
            if value is None or value == "" or value == []:
                continue
            field_label = _FIELD_LABELS.get(key, key.replace("_", " ").title())
            lines.append(f"  • {field_label}: {_format_value(value)}")
        return "\n".join(lines)

    if isinstance(data, list):
        lines = [f"{label}:"]
        for i, item in enumerate(data, 1):
            if isinstance(item, dict):
                parts = [f"{_FIELD_LABELS.get(k, k)}: {_format_value(v)}" for k, v in item.items() if v]
                lines.append(f"  {i}. {' | '.join(parts)}")
            else:
                lines.append(f"  {i}. {item}")
        return "\n".join(lines)

    return f"{label}: {data}"


def _search_context(context: dict[str, str], agents: list[str], question: str) -> list[tuple[str, str]]:
    """Return (agent_name, snippet) tuples relevant to the question."""
    results = []
    q_lower = question.lower()
    for agent in agents:
        text = context.get(agent, "")
        if not text:
            continue
        # Simple relevance: if any word from question appears in agent output
        words = [w for w in q_lower.split() if len(w) > 3]
        if any(w in text.lower() for w in words) or agent in agents:
            results.append((agent, text[:500]))
    return results


FOLLOW_UP_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "answer": {"type": "string"},
        "sources": {
            "type": "array",
            "items": {"type": "string"},
        },
    },
    "required": ["answer", "sources"],
    "additionalProperties": False,
}


def _build_llm_prompt(question: str, snippets: list[tuple[str, str]], hypotheses: list[dict]) -> tuple[str, list[str]]:
    source_ids: list[str] = []
    sections: list[str] = []

    for agent_name, snippet in snippets:
        source_id = f"agent:{agent_name}"
        source_ids.append(source_id)
        readable = _format_snippet(agent_name, snippet)
        sections.append(f"[{source_id}]\n{readable}")

    for h in hypotheses:
        source_id = f"hypothesis:{h['id']}"
        source_ids.append(source_id)
        sections.append(
            "\n".join(
                [
                    f"[{source_id}]",
                    f"Hypothesis: {h['source_disease']} -> {h['target_disease']}",
                    f"Summary: {h['summary'] or 'No summary recorded.'}",
                    f"Final Confidence: {h['final_confidence']}",
                    f"Recommended Action: {h['recommended_action']}",
                    f"Priority Level: {h['priority_level']}",
                ]
            )
        )

    prompt = "\n\n".join(
        [
            "Question:",
            question,
            "",
            "Grounding Context:",
            "\n\n".join(sections) if sections else "No context found.",
        ]
    )
    return prompt, source_ids


def _answer_with_openai(question: str, snippets: list[tuple[str, str]], hypotheses: list[dict]) -> FollowUpAnswer | None:
    model = os.getenv("OPENAI_FOLLOW_UP_MODEL", os.getenv("OPENAI_SKEPTIC_MODEL", "gpt-4o-mini"))
    prompt, allowed_sources = _build_llm_prompt(question, snippets, hypotheses)
    response = openai_chat_completion(
        model=model,
        system_prompt=(
            "You are the Lazarus Follow-Up Assistant. Answer the user's question using only the provided run "
            "context. Be concise, natural, and specific. Do not mention data that is not present in the context. "
            "If the answer is unavailable, say so plainly. Return only grounded citations from the provided source IDs."
        ),
        user_prompt=prompt,
        response_schema=FOLLOW_UP_RESPONSE_SCHEMA,
    )
    if not response or not response.get("answer"):
        return None

    filtered_sources = [
        source for source in response.get("sources", [])
        if source in allowed_sources
    ]
    return FollowUpAnswer(
        question=question,
        answer=response["answer"].strip(),
        sources=filtered_sources,
        model_used=model,
        mode="grounded_llm",
    )


def _deterministic_answer(question: str, snippets: list[tuple[str, str]], hypotheses: list[dict]) -> FollowUpAnswer:
    """Deterministic fallback when the LLM path is unavailable."""
    answer_parts = []
    sources = []

    for agent_name, snippet in snippets:
        readable = _format_snippet(agent_name, snippet)
        answer_parts.append(readable)
        sources.append(agent_name)

    if hypotheses and any(kw in question.lower() for kw in ["hypothesis", "disease", "target", "summary", "overall", "result"]):
        for h in hypotheses:
            answer_parts.append(
                f"Hypothesis: {h['source_disease']} → {h['target_disease']} | "
                f"Confidence: {h['final_confidence']} | Action: {h['recommended_action']}"
            )
            sources.append(f"hypothesis-{h['id'][:8]}")

    answer = "\n\n".join(answer_parts) if answer_parts else (
        "I found relevant data but couldn't match your specific question. "
        "Try asking about specific agents (advocate, skeptic, judge), "
        "effort/cost estimates, or impact predictions."
    )

    return FollowUpAnswer(
        question=question,
        answer=answer,
        sources=sources,
    )


def answer_follow_up(db: Session, run_id: UUID, question: str) -> FollowUpAnswer:
    """Answer a user question grounded in the run's agent outputs."""
    context = _gather_run_context(db, run_id)
    hypotheses = _gather_hypothesis_context(db, run_id)

    relevant_agents = _find_relevant_agents(question)
    snippets = _search_context(context, relevant_agents, question)

    if not snippets and not hypotheses:
        return FollowUpAnswer(
            question=question,
            answer="No analysis data found for this run. Please run the analysis pipeline first.",
            sources=[],
        )

    llm_answer = _answer_with_openai(question, snippets, hypotheses)
    if llm_answer is not None:
        return llm_answer

    return _deterministic_answer(question, snippets, hypotheses)
