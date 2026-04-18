"""Evidence Curator agent implementation."""

from __future__ import annotations

from backend.app.agents.types import (
    AdvocateOutput,
    AssetContext,
    EvidenceCuratorOutput,
    EvidenceItem,
    SkepticOutput,
)

CONCERN_EVIDENCE_KEYWORDS = {
    "liver": ("tolerable", "safety", "toxicity", "adverse", "enzyme"),
    "mechanistic translation": ("mechanistic", "pathway", "target", "biology"),
    "conflict": ("mechanistic", "pathway", "target", "biology"),
}


def _evidence_addresses_concern(snippet: str, concern: str) -> bool:
    combined = f"{snippet} {concern}".lower()
    for needle, keywords in CONCERN_EVIDENCE_KEYWORDS.items():
        if needle in concern.lower():
            return any(keyword in combined for keyword in keywords)
    return any(keyword in combined for keyword in ("safety", "target", "pathway", "trial", "mechanistic"))


def run_evidence_curator(
    context: AssetContext,
    advocate: AdvocateOutput,
    skeptic: SkepticOutput,
) -> EvidenceCuratorOutput:
    """Build structured evidence from deterministic context plus skeptic concerns."""
    evidence = [
        EvidenceItem(
            source_ref=item.source_ref,
            title=item.title,
            snippet=item.snippet,
            evidence_type=item.evidence_type,
        )
        for item in context.evidence_refs
    ]

    addressed_concerns: list[str] = []
    unresolved_concerns: list[str] = []
    searchable_text = " ".join(
        f"{item.title} {item.snippet} {item.evidence_type}" for item in evidence
    )
    for concern in skeptic.contraindications:
        if _evidence_addresses_concern(searchable_text, concern):
            addressed_concerns.append(concern)
        else:
            unresolved_concerns.append(concern)

    if not evidence:
        evidence_summary = (
            f"No direct supporting evidence was available for {context.asset_code} -> "
            f"{advocate.proposed_disease}; skeptic concerns remain unresolved."
        )
        evidence_score = 0.55
    else:
        evidence_summary = (
            f"Mechanistic and trial-history evidence supports exploratory review of "
            f"{context.asset_code} for {advocate.proposed_disease}. "
            f"Addressed {len(addressed_concerns)} of {len(skeptic.contraindications)} skeptic concerns."
        )
        penalty = 0.06 * len(unresolved_concerns)
        bonus = 0.03 * len(addressed_concerns)
        evidence_score = max(0.4, min(0.9, round(0.8 + bonus - penalty, 2)))

    return EvidenceCuratorOutput(
        evidence=evidence,
        evidence_summary=evidence_summary,
        evidence_score=evidence_score,
        addressed_concerns=addressed_concerns,
        unresolved_concerns=unresolved_concerns,
        model_used="deterministic-curator",
        mode="deterministic",
    )
