"""Context builder for Step 3 reasoning."""

from __future__ import annotations

from backend.app.agents.types import AssetContext, EvidenceReference
from backend.app.models import CompanyAsset


CONTEXT_MAP = {
    "Asthma": {
        "target": "JAK1",
        "linked_diseases": ["Lupus", "Rheumatoid Arthritis"],
        "adverse_events": ["Mild liver enzyme elevation"],
        "evidence_refs": [
            {
                "source_ref": "PMID-12345",
                "title": "JAK1 involvement in autoimmune disease",
                "snippet": "JAK1 signaling is implicated in multiple autoimmune conditions including Lupus.",
                "evidence_type": "pubmed",
            },
            {
                "source_ref": "NCT-99821",
                "title": "Trial context for RX-782",
                "snippet": "RX-782 showed tolerable safety but failed to meet enrollment goals in Asthma.",
                "evidence_type": "clinical_trial",
            },
        ],
    },
    "Migraine": {
        "target": "CGRP",
        "linked_diseases": ["Fibromyalgia"],
        "adverse_events": ["Transient dizziness"],
        "evidence_refs": [
            {
                "source_ref": "PMID-22334",
                "title": "CGRP and chronic pain overlap",
                "snippet": "CGRP-linked signaling has been associated with pain amplification syndromes.",
                "evidence_type": "pubmed",
            },
            {
                "source_ref": "NCT-55112",
                "title": "Migraine asset development history",
                "snippet": "Clinical program ended for business reasons despite acceptable early tolerability.",
                "evidence_type": "clinical_trial",
            },
        ],
    },
    "Psoriasis": {
        "target": "TNF-alpha",
        "linked_diseases": ["Rheumatoid Arthritis"],
        "adverse_events": ["Mild injection site reactions"],
        "evidence_refs": [
            {
                "source_ref": "PMID-34567",
                "title": "TNF-alpha biology across inflammatory disease",
                "snippet": "TNF-alpha remains a validated pathway across psoriasis and rheumatoid arthritis.",
                "evidence_type": "pubmed",
            },
            {
                "source_ref": "CSR-RA-212",
                "title": "Program review for inflammatory repositioning",
                "snippet": "Mechanistic overlap supports a follow-on rheumatoid arthritis assessment.",
                "evidence_type": "internal_memo",
            },
        ],
    },
    "COPD": {
        "target": "TGF-beta",
        "linked_diseases": ["Pulmonary Fibrosis"],
        "adverse_events": ["Transient cough", "Mild fatigue"],
        "evidence_refs": [
            {
                "source_ref": "PMID-88991",
                "title": "TGF-beta signaling in fibrotic lung remodeling",
                "snippet": "TGF-beta is central to fibroblast activation and interstitial lung scarring.",
                "evidence_type": "pubmed",
            },
            {
                "source_ref": "NCT-77110",
                "title": "COPD phase 2 development summary",
                "snippet": "Program stalled for execution reasons rather than clear mechanistic toxicity.",
                "evidence_type": "clinical_trial",
            },
        ],
    },
}


def build_asset_context(asset: CompanyAsset) -> AssetContext:
    """Build structured scientific context from an operational asset row."""
    mapping = CONTEXT_MAP.get(
        asset.original_indication,
        {
            "target": "Unknown target",
            "linked_diseases": ["Rare Inflammatory Disease"],
            "adverse_events": ["Unknown adverse event profile"],
            "evidence_refs": [
                {
                    "source_ref": "MOCK-0001",
                    "title": "Fallback context record",
                    "snippet": "No disease-specific mapping existed, so Lazarus used a fallback context.",
                    "evidence_type": "mock",
                }
            ],
        },
    )

    return AssetContext(
        asset_id=asset.id,
        asset_code=asset.asset_code,
        internal_name=asset.internal_name,
        source_disease=asset.original_indication,
        portfolio_status=asset.portfolio_status,
        business_failure_reason=asset.business_failure_reason,
        phase=asset.phase,
        owner_company=asset.owner_company,
        target=mapping["target"],
        linked_diseases=list(mapping["linked_diseases"]),
        adverse_events=list(mapping["adverse_events"]),
        evidence_refs=[EvidenceReference(**item) for item in mapping["evidence_refs"]],
    )
