"""Candidate discovery service (light search / Mortician + Advocate)."""

from __future__ import annotations

import re

from sqlalchemy.orm import Session

from backend.app import crud, schemas
from backend.app.agents.advocate import run_advocate
from backend.app.services.context_service import build_asset_context
from backend.app.services.discovery_service import fetch_lazarus_candidates
from backend.app.services.llm_service import (
    dedalus_chat_completion,
    gemini_chat_completion,
)


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip().lower())


def _token_set(text: str) -> set[str]:
    normalized = _normalize(text)
    return {token for token in re.split(r"[^a-z0-9]+", normalized) if token}


def _overlap_score(left: str, right: str) -> float:
    left_tokens = _token_set(left)
    right_tokens = _token_set(right)
    if not left_tokens or not right_tokens:
        return 0.0
    overlap = left_tokens & right_tokens
    return len(overlap) / max(len(right_tokens), 1)


def _build_search_blob(asset, context) -> str:
    return " ".join(
        [
            asset.asset_code or "",
            asset.internal_name or "",
            asset.original_indication or "",
            context.source_disease or "",
            " ".join(context.linked_diseases or []),
            context.target or "",
            " ".join(context.adverse_events or []),
            context.business_failure_reason or "",
        ]
    )


def _query_relevance_score(asset, context, disease_query: str) -> float:
    query_norm = _normalize(disease_query)
    if not query_norm:
        return 0.0

    source_norm = _normalize(context.source_disease)
    linked_norms = [_normalize(item) for item in context.linked_diseases]
    blob = _build_search_blob(asset, context)
    blob_norm = _normalize(blob)

    if query_norm == source_norm:
        return 1.0
    if query_norm in linked_norms:
        return 0.92

    source_overlap = _overlap_score(context.source_disease, disease_query)
    linked_overlap = max(
        (_overlap_score(item, disease_query) for item in context.linked_diseases),
        default=0.0,
    )
    blob_overlap = _overlap_score(blob, disease_query)

    substring_bonus = 0.35 if query_norm in blob_norm else 0.0

    query_tokens = _token_set(disease_query)
    blob_tokens = _token_set(blob)
    prefix_hits = sum(
        1
        for token in query_tokens
        if any(blob_token.startswith(token) for blob_token in blob_tokens)
    )
    prefix_bonus = min(0.2, prefix_hits * 0.06)

    score = max(source_overlap * 0.9, linked_overlap, blob_overlap * 0.8)
    return min(1.0, score + substring_bonus + prefix_bonus)


def _mortician_scan(context, disease_query: str) -> tuple[float, str]:
    disease_norm = _normalize(disease_query)
    source_norm = _normalize(context.source_disease)
    linked_norm = [_normalize(item) for item in context.linked_diseases]

    if disease_norm == source_norm:
        return 0.97, f"Source indication matches {disease_query}."
    if disease_norm in linked_norm:
        return 0.91, f"Linked-disease map includes {disease_query}."

    source_overlap = _overlap_score(context.source_disease, disease_query)
    linked_overlap = max(
        (_overlap_score(item, disease_query) for item in context.linked_diseases),
        default=0.0,
    )
    score = max(source_overlap * 0.8, linked_overlap * 0.9)

    if score >= 0.55:
        return (
            min(0.88, 0.58 + score * 0.34),
            "Mechanistic keyword overlap from trial scanner.",
        )
    return (
        min(0.49, 0.20 + score * 0.45),
        "Weak lexical overlap; candidate is long-shot.",
    )


def _build_candidate(asset, disease_query: str) -> schemas.CandidateResponse:
    context = build_asset_context(asset)
    mortician_score, mortician_reason = _mortician_scan(context, disease_query)

    advocate = run_advocate(context)
    advocate_alignment = max(
        _overlap_score(advocate.proposed_disease, disease_query),
        (
            1.0
            if _normalize(advocate.proposed_disease) == _normalize(disease_query)
            else 0.0
        ),
    )

    scientific_confidence = round(
        max(
            0.05,
            min(
                0.99,
                (mortician_score * 0.6)
                + (advocate.confidence * 0.2)
                + (advocate_alignment * 0.2),
            ),
        ),
        3,
    )

    trial_brief = _build_trial_brief(
        context, disease_query, advocate.proposed_disease, advocate.reasoning
    )

    return schemas.CandidateResponse(
        asset_id=asset.id,
        asset_code=asset.asset_code,
        drug_name=asset.internal_name,
        disease_query=disease_query,
        original_indication=asset.original_indication,
        proposed_disease=advocate.proposed_disease,
        abandonment_reason=asset.business_failure_reason,
        scientific_confidence_score=scientific_confidence,
        mortician_score=round(mortician_score, 3),
        match_reason=f"{mortician_reason} Advocate suggests {advocate.proposed_disease}.",
        trial_status=asset.portfolio_status,
        rescue_angle=trial_brief["rescue_angle"],
        key_facts=trial_brief["key_facts"],
        relevance_summary=trial_brief["relevance_summary"],
    )


def _build_candidate_fast(asset, disease_query: str) -> schemas.CandidateResponse:
    """Fast deterministic candidate formatter for search results (no LLM calls)."""
    context = build_asset_context(asset)
    mortician_score, mortician_reason = _mortician_scan(context, disease_query)

    proposed_disease = (
        context.linked_diseases[0]
        if context.linked_diseases
        else context.source_disease
    )
    proposed_alignment = max(
        _overlap_score(proposed_disease, disease_query),
        1.0 if _normalize(proposed_disease) == _normalize(disease_query) else 0.0,
    )
    scientific_confidence = round(
        max(0.05, min(0.99, (mortician_score * 0.8) + (proposed_alignment * 0.2))), 3
    )

    key_facts = [
        f"Source indication: {context.source_disease}",
        f"Target pathway: {context.target}",
        f"Primary failure note: {context.business_failure_reason or 'not recorded'}",
    ]
    relevance_summary = f"{asset.asset_code} is ranked using live ClinicalTrials.gov evidence and deterministic Lazarus filters for {disease_query}."
    rescue_angle = f"Test {asset.internal_name} toward {proposed_disease} if pathway overlap and non-toxicity hold in deeper review."

    return schemas.CandidateResponse(
        asset_id=asset.id,
        asset_code=asset.asset_code,
        drug_name=asset.internal_name,
        disease_query=disease_query,
        original_indication=asset.original_indication,
        proposed_disease=proposed_disease,
        abandonment_reason=asset.business_failure_reason,
        scientific_confidence_score=scientific_confidence,
        mortician_score=round(mortician_score, 3),
        match_reason=f"{mortician_reason} Deterministic shortlist formatting applied.",
        trial_status=asset.portfolio_status,
        rescue_angle=rescue_angle,
        key_facts=key_facts,
        relevance_summary=relevance_summary,
    )


def _build_trial_brief(
    context, disease_query: str, proposed_disease: str, advocate_reasoning: str
) -> dict[str, object]:
    response_schema = {
        "type": "object",
        "properties": {
            "relevance_summary": {"type": "string"},
            "rescue_angle": {"type": "string"},
            "key_facts": {
                "type": "array",
                "items": {"type": "string"},
                "minItems": 3,
                "maxItems": 5,
            },
        },
        "required": ["relevance_summary", "rescue_angle", "key_facts"],
        "additionalProperties": False,
    }

    user_prompt = (
        "Disease query:\n"
        f"- {disease_query}\n\n"
        "Failed trial context:\n"
        f"- asset_code: {context.asset_code}\n"
        f"- drug_name: {context.internal_name}\n"
        f"- original_indication: {context.source_disease}\n"
        f"- target: {context.target}\n"
        f"- linked_diseases: {', '.join(context.linked_diseases)}\n"
        f"- adverse_events: {', '.join(context.adverse_events)}\n"
        f"- failure_reason: {context.business_failure_reason or 'unknown'}\n"
        f"- advocate_reasoning: {advocate_reasoning}\n"
        f"- proposed_disease: {proposed_disease}\n\n"
        "Return a concise ranked trial brief for a scientist."
    )

    llm_output = gemini_chat_completion(
        model="gemini-2.5-flash",
        system_prompt=(
            "You are a clinical trial search analyst. You rank failed trials for disease rescue. "
            "Use only the provided database context. Explain why the trial is relevant and how it could be repurposed. "
            "Return strict JSON."
        ),
        user_prompt=user_prompt,
        response_schema=response_schema,
    )
    if llm_output is None:
        llm_output = dedalus_chat_completion(
            model="google/gemini-2.5-flash",
            system_prompt=(
                "You are a clinical trial search analyst. You rank failed trials for disease rescue. "
                "Use only the provided database context. Explain why the trial is relevant and how it could be repurposed. "
                "Return strict JSON."
            ),
            user_prompt=user_prompt,
            response_schema=response_schema,
            provider="google",
        )

    if isinstance(llm_output, dict):
        facts = llm_output.get("key_facts", [])
        if isinstance(facts, list):
            key_facts = [str(item) for item in facts[:5] if str(item).strip()]
        else:
            key_facts = []
        return {
            "relevance_summary": str(llm_output.get("relevance_summary", "")),
            "rescue_angle": str(llm_output.get("rescue_angle", "")),
            "key_facts": key_facts,
        }

    fallback_facts = [
        f"Original indication: {context.source_disease}",
        f"Target: {context.target}",
        f"Failure reason: {context.business_failure_reason or 'not recorded'}",
    ]
    return {
        "relevance_summary": (
            f"{context.asset_code} is a failed {context.portfolio_status.lower()} asset with {context.target} alignment "
            f"that could be repurposed for {disease_query}."
        ),
        "rescue_angle": (
            f"Consider {context.internal_name} as a mechanistic bridge into {proposed_disease} based on target overlap."
        ),
        "key_facts": fallback_facts,
    }


def search_candidates(
    db: Session, disease_query: str, *, limit: int = 5
) -> schemas.CandidateSearchResponse:
    assets = crud.list_assets(db)
    if not assets:
        return schemas.CandidateSearchResponse(disease=disease_query, candidates=[])

    discovery_signals = fetch_lazarus_candidates(
        db,
        disease_query,
        limit=max(limit * 3, 10),
    )
    if not discovery_signals:
        return schemas.CandidateSearchResponse(disease=disease_query, candidates=[])

    allowed_asset_ids = set(discovery_signals.keys())

    preliminary = []
    for asset in assets:
        if allowed_asset_ids and asset.id not in allowed_asset_ids:
            continue

        context = build_asset_context(asset)
        mortician_score, reason = _mortician_scan(context, disease_query)
        relevance_score = _query_relevance_score(asset, context, disease_query)
        discovery_score = (
            discovery_signals.get(asset.id).score
            if asset.id in discovery_signals
            else 0.0
        )
        combined_score = max(mortician_score * 0.7, relevance_score, discovery_score)

        # Require either lexical relevance or a strong mechanistic match to avoid random-looking results.
        if relevance_score < 0.14 and mortician_score < 0.55 and discovery_score < 0.45:
            continue

        preliminary.append((combined_score, reason, asset))

    if not preliminary:
        return schemas.CandidateSearchResponse(disease=disease_query, candidates=[])

    preliminary.sort(key=lambda item: item[0], reverse=True)
    shortlist = [item[2] for item in preliminary[: max(limit * 2, limit)]]

    candidates = [_build_candidate_fast(asset, disease_query) for asset in shortlist]
    candidates.sort(key=lambda item: item.scientific_confidence_score, reverse=True)

    return schemas.CandidateSearchResponse(
        disease=disease_query,
        candidates=candidates[:limit],
    )
