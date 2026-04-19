"""Pathway-first biological plausibility scoring (Postgres + asset context).

Lazarus does not ship external KG embeddings; this module approximates a
graph-style prior using target, linked indications, and execution-vs-biology
failure hints recorded on each asset.
"""

from __future__ import annotations

import re
from uuid import UUID

from backend.app.services.context_service import build_asset_context
from backend.app.services.discovery_service import BIOLOGY_FAILURE_TERMS


def _normalize(text: str | None) -> str:
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


def _contains_any(text: str, terms: set[str]) -> bool:
    normalized = _normalize(text)
    return any(term in normalized for term in terms)


EXECUTION_RESCUE_TERMS = {
    "poor_enrollment",
    "funding_cut",
    "strategic_pivot",
    "regulatory_hold",
    "funding",
    "enrollment",
    "strategic",
    "portfolio",
    "business",
    "accrual",
    "resource",
    "commercial",
    "reprioritization",
    "merger",
    "acquisition",
}


def is_biology_futility_asset(asset, context) -> bool:
    """True when recorded failure mode suggests the molecule failed for efficacy, not ops."""
    blob = " ".join(
        [
            asset.business_failure_reason or "",
            context.business_failure_reason or "",
            asset.portfolio_status or "",
        ]
    )
    return _contains_any(blob, BIOLOGY_FAILURE_TERMS)


def pathway_plausibility(asset, context, disease_query: str) -> float:
    """Deterministic 0..1 score: MoA/pathway overlap vs query disease + execution hints."""
    if is_biology_futility_asset(asset, context):
        return 0.0

    qn = _normalize(disease_query)
    if not qn:
        return 0.0

    source_norm = _normalize(context.source_disease)
    linked_norms = [_normalize(x) for x in (context.linked_diseases or [])]
    target_blob = " ".join(
        filter(
            None,
            [
                context.target,
                asset.internal_name or "",
                asset.original_indication or "",
            ],
        )
    )

    if qn == source_norm:
        base = 1.0
    elif qn in linked_norms:
        base = 0.94
    else:
        source_o = _overlap_score(context.source_disease, disease_query)
        linked_o = max(
            (_overlap_score(x, disease_query) for x in (context.linked_diseases or [])),
            default=0.0,
        )
        target_o = _overlap_score(target_blob, disease_query)
        blob = " ".join(
            [
                source_norm,
                " ".join(linked_norms),
                _normalize(target_blob),
                _normalize(context.business_failure_reason or ""),
            ]
        )
        substring_bonus = 0.22 if qn in blob else 0.0
        base = max(source_o * 0.92, linked_o * 0.9, target_o * 0.88) + substring_bonus
        base = min(1.0, base)

    exec_blob = _normalize(
        " ".join(
            [
                asset.business_failure_reason or "",
                context.business_failure_reason or "",
                asset.portfolio_status or "",
            ]
        )
    )
    execution_lift = 0.14 if _contains_any(exec_blob, EXECUTION_RESCUE_TERMS) else 0.0

    return round(min(1.0, base * 0.92 + execution_lift), 4)


def score_assets_pathway_first(assets, disease_query: str) -> dict[UUID, float]:
    scores: dict[UUID, float] = {}
    for asset in assets:
        ctx = build_asset_context(asset)
        scores[asset.id] = pathway_plausibility(asset, ctx, disease_query)
    return scores


def graph_first_asset_ids(
    assets,
    pathway_scores: dict[UUID, float],
    *,
    min_score: float = 0.18,
    pool_size: int = 12,
) -> set[UUID]:
    """Asset ids allowed into ClinicalTrials.gov matching (pathway gate + top-K fill)."""
    ranked = sorted(assets, key=lambda a: pathway_scores.get(a.id, 0.0), reverse=True)
    strong = {a.id for a in ranked if pathway_scores.get(a.id, 0.0) >= min_score}
    if strong:
        return strong
    out: set[UUID] = set()
    for a in ranked:
        if pathway_scores.get(a.id, 0.0) > 0.0:
            out.add(a.id)
        if len(out) >= min(pool_size, len(assets)):
            break
    if not out and ranked:
        out.add(ranked[0].id)
    return out
