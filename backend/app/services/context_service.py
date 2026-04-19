"""Context builder for Step 3 reasoning.

Supports two modes controlled by the LAZARUS_CONTEXT_SOURCE env var:
  - "api"  (default) → fetch real-time data from OpenTargets, PubMed,
                        ClinicalTrials.gov, and OpenFDA.  Falls back to
                        the static CONTEXT_MAP on API failure.
  - "static"         → use the hardcoded CONTEXT_MAP only (fast, offline).
"""

from __future__ import annotations

import logging
import os
from functools import lru_cache

from backend.app.agents.types import AssetContext, EvidenceReference
from backend.app.models import CompanyAsset
from backend.app.services.api_clients import fetch_full_context

logger = logging.getLogger(__name__)


# ─── Static fallback map (original seed data) ──────────────────────────────

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


# ─── LRU cache for API responses (in-memory, per-process) ──────────────────

@lru_cache(maxsize=256)
def _cached_api_context(drug_name: str, source_disease: str) -> dict | None:
    """Fetch from real APIs and cache the result in-memory.
    Returns the mapping dict or None on failure."""
    try:
        result = fetch_full_context(drug_name, source_disease)
        # Validate we got meaningful data back
        if result.get("target") and result["target"] != "Unknown target":
            logger.info(
                "[context] API success: %s/%s → target=%s, %d diseases, %d evidence refs",
                drug_name, source_disease,
                result["target"],
                len(result.get("linked_diseases", [])),
                len(result.get("evidence_refs", [])),
            )
            return result
        logger.info("[context] API returned no target for %s/%s, falling back to static", drug_name, source_disease)
        return None
    except Exception:
        logger.warning("[context] API fetch failed for %s/%s, using static fallback", drug_name, source_disease)
        return None


# ─── Main builder ───────────────────────────────────────────────────────────

def _use_api() -> bool:
    """Check if we should use real-time APIs (default: True)."""
    return os.getenv("LAZARUS_CONTEXT_SOURCE", "api").lower() != "static"


def _get_mapping(drug_name: str, source_disease: str) -> tuple[dict, str]:
    """Return (mapping_dict, context_source) for a drug/disease combo.
    Tries API first, falls back to CONTEXT_MAP, then generic fallback."""
    if _use_api():
        api_result = _cached_api_context(drug_name, source_disease)
        if api_result is not None:
            return api_result, "real_time_api"

    # Static fallback
    static = CONTEXT_MAP.get(source_disease)
    if static:
        return static, "static_context_map"

    # Generic fallback for unknown diseases
    return {
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
    }, "generic_fallback"


def build_asset_context(asset: CompanyAsset) -> AssetContext:
    """Build structured scientific context from an operational asset row.

    When LAZARUS_CONTEXT_SOURCE=api (default):
      1. Try real-time APIs (OpenTargets + PubMed + ClinicalTrials.gov + OpenFDA)
      2. Cache result in-memory (lru_cache)
      3. Fall back to static CONTEXT_MAP if API fails
    When LAZARUS_CONTEXT_SOURCE=static:
      Use CONTEXT_MAP only (fast, offline, deterministic).
    """
    mapping, source = _get_mapping(asset.internal_name, asset.original_indication)

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
        context_source=source,
    )
