"""Structured Lazarus discovery pipeline for shortlist-quality trial search.

This module implements a deterministic multi-stage filter:
1) Pull structured failed/terminated studies from ClinicalTrials.gov.
2) Classify failure mode (toxicity/futility vs logistical/strategic).
3) Keep only recoverable candidates with secondary signal and/or low-accrual logic.
4) Require minimum source coverage for downstream agent debate quality.
"""

from __future__ import annotations

import json
import re
import statistics
import urllib.parse
import urllib.request
from dataclasses import dataclass
from functools import lru_cache
from urllib import error
from uuid import UUID

from sqlalchemy.orm import Session

from backend.app import crud
from backend.app.services.context_service import build_asset_context

CTGOV_BASE = "https://clinicaltrials.gov/api/v2/studies"
PUBMED_ESEARCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
OPENFDA_DRUG_LABEL = "https://api.fda.gov/drug/label.json"

FAILED_STATUSES = ("TERMINATED", "WITHDRAWN", "COMPLETED")

TOXICITY_TERMS = {
    "toxicity",
    "toxic",
    "dose-limiting",
    "dlt",
    "safety",
    "adverse event",
    "sae",
    "myelosuppression",
    "fatal",
    "death",
}

BIOLOGY_FAILURE_TERMS = {
    "futility",
    "no efficacy",
    "lack of efficacy",
    "endpoint not met",
    "did not meet",
    "no meaningful",
}

LOGISTICAL_TERMS = {
    "funding",
    "budget",
    "resource",
    "slow accrual",
    "low accrual",
    "enrollment",
    "recruitment",
    "site closure",
    "operational",
}

STRATEGIC_TERMS = {
    "strategic",
    "reprioritization",
    "portfolio",
    "business decision",
    "commercial",
    "merger",
    "acquisition",
}

SECONDARY_SIGNAL_TERMS = {
    "secondary endpoint",
    "secondary outcome",
    "nominal significance",
    "trend",
    "signal",
    "response",
    "improved",
    "statistically significant",
    "p<",
    "p-value",
}


@dataclass(slots=True)
class LazarusDiscoverySignal:
    asset_id: UUID
    score: float
    termination_reason: str
    source_coverage_score: float
    has_secondary_signal: bool
    enrollment_ratio: float | None
    near_neighbor_match: bool
    prime_candidate: bool


def _normalize(text: str | None) -> str:
    return re.sub(r"\s+", " ", (text or "").strip().lower())


def _contains_any(text: str, terms: set[str]) -> bool:
    normalized = _normalize(text)
    return any(term in normalized for term in terms)


def _safe_int(value: object) -> int | None:
    if value is None:
        return None
    try:
        return int(str(value))
    except (TypeError, ValueError):
        return None


def _fetch_json(url: str, timeout: int = 8) -> dict | None:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "LazarusSwarm/1.0"})
        with urllib.request.urlopen(req, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except (error.URLError, error.HTTPError, TimeoutError, json.JSONDecodeError):
        return None


@lru_cache(maxsize=64)
def _fetch_ctgov_failed_studies(
    disease: str, *, page_size: int = 100, max_pages: int = 2
) -> list[dict]:
    """Fetch failed/terminated study pages using official v2 query/filter params."""
    studies: list[dict] = []
    page_token: str | None = None
    pages = 0

    while pages < max_pages:
        query_params: dict[str, str] = {
            "format": "json",
            "query.cond": disease,
            "filter.overallStatus": ",".join(FAILED_STATUSES),
            "sort": "@relevance",
            "pageSize": str(max(10, min(page_size, 1000))),
        }
        if page_token:
            query_params["pageToken"] = page_token

        params = urllib.parse.urlencode(query_params)
        payload = _fetch_json(f"{CTGOV_BASE}?{params}")
        if not payload:
            break

        page_studies = payload.get("studies", [])
        if isinstance(page_studies, list):
            studies.extend(page_studies)

        page_token = payload.get("nextPageToken")
        pages += 1
        if not page_token:
            break

    return studies


def _extract_study_fields(study: dict) -> dict[str, object]:
    protocol = study.get("protocolSection", {})
    status_mod = protocol.get("statusModule", {})
    ident_mod = protocol.get("identificationModule", {})
    conditions_mod = protocol.get("conditionsModule", {})
    desc_mod = protocol.get("descriptionModule", {})
    outcomes_mod = protocol.get("outcomesModule", {})
    design_mod = protocol.get("designModule", {})
    arms_mod = protocol.get("armsInterventionsModule", {})

    secondary_outcomes = outcomes_mod.get("secondaryOutcomes", []) or []
    secondary_text = " ".join(
        str(outcome.get("measure", "")) + " " + str(outcome.get("description", ""))
        for outcome in secondary_outcomes
        if isinstance(outcome, dict)
    )

    text_blob = " ".join(
        [
            str(status_mod.get("whyStopped", "")),
            str(desc_mod.get("briefSummary", "")),
            str(desc_mod.get("detailedDescription", "")),
            secondary_text,
        ]
    )

    enrollment = _safe_int((design_mod.get("enrollmentInfo", {}) or {}).get("count"))
    conditions = [
        condition.strip()
        for condition in (conditions_mod.get("conditions", []) or [])
        if isinstance(condition, str) and condition.strip()
    ]
    interventions = [
        str(intervention.get("name", "")).strip()
        for intervention in (arms_mod.get("interventions", []) or [])
        if isinstance(intervention, dict) and str(intervention.get("name", "")).strip()
    ]

    return {
        "nct_id": ident_mod.get("nctId") or "",
        "title": ident_mod.get("briefTitle") or "",
        "status": status_mod.get("overallStatus") or "",
        "why_stopped": status_mod.get("whyStopped") or "",
        "has_results": bool(study.get("hasResults", False)),
        "enrollment": enrollment,
        "text_blob": text_blob,
        "conditions": conditions,
        "interventions": interventions,
    }


def _classify_failure_reason(
    reason_text: str,
    fallback_text: str,
    *,
    status: str = "",
    has_results: bool = True,
) -> str:
    text = f"{reason_text} {fallback_text}".strip()
    if _contains_any(text, TOXICITY_TERMS):
        return "toxicity"
    if _contains_any(text, BIOLOGY_FAILURE_TERMS):
        return "futility"
    if _contains_any(text, LOGISTICAL_TERMS):
        return "logistical"
    if _contains_any(text, STRATEGIC_TERMS):
        return "strategic"
    if _normalize(status) == "completed" and not has_results:
        return "strategic"
    return "unknown"


def _has_secondary_signal(study_text: str) -> bool:
    return _contains_any(study_text, SECONDARY_SIGNAL_TERMS)


@lru_cache(maxsize=256)
def _pubmed_count(query: str) -> int:
    params = urllib.parse.urlencode(
        {
            "db": "pubmed",
            "retmode": "json",
            "term": query,
            "retmax": 0,
        }
    )
    payload = _fetch_json(f"{PUBMED_ESEARCH}?{params}", timeout=6)
    if not payload:
        return 0
    count_str = payload.get("esearchresult", {}).get("count", "0")
    return _safe_int(count_str) or 0


@lru_cache(maxsize=256)
def _fda_label_count(drug_name: str) -> int:
    # AdCom packets are not exposed through a stable open API; openFDA label hits are
    # used as a structured regulatory signal proxy.
    term = drug_name.replace('"', "")
    params = urllib.parse.urlencode(
        {
            "search": f'openfda.brand_name:"{term}"+openfda.generic_name:"{term}"',
            "limit": 1,
        }
    )
    payload = _fetch_json(f"{OPENFDA_DRUG_LABEL}?{params}", timeout=6)
    if not payload:
        return 0
    meta = payload.get("meta", {})
    return _safe_int(meta.get("results", {}).get("total")) or 0


def _biopharma_catalyst_proxy(asset) -> int:
    # BioPharma Catalyst has no public API endpoint. We use a deterministic proxy that
    # only scores public-pipeline-like failures (Phase II/III + strategic/business signals).
    phase_text = _normalize(asset.phase)
    reason_text = _normalize(asset.business_failure_reason)
    if ("phase 2" in phase_text or "phase 3" in phase_text) and (
        "fund" in reason_text
        or "strategic" in reason_text
        or "portfolio" in reason_text
        or "business" in reason_text
        or "reprior" in reason_text
    ):
        return 1
    return 0


def _source_coverage_score(
    asset,
    study_fields: dict[str, object],
    *,
    pubmed_count: int,
    fda_label_count: int,
    biopharma_proxy: int,
) -> float:
    has_ctgov = 1 if study_fields.get("nct_id") else 0
    has_csr_like = 1 if _normalize(asset.business_failure_reason) else 0

    score = 0.0
    score += 0.30 if has_ctgov else 0.0
    score += 0.25 if pubmed_count > 0 else 0.0
    score += 0.20 if fda_label_count > 0 else 0.0
    score += 0.15 if biopharma_proxy > 0 else 0.0
    score += 0.10 if has_csr_like else 0.0
    return round(score, 3)


def _is_safe_to_rescue(asset, reason_class: str) -> bool:
    phase_text = _normalize(asset.phase)
    phase1_pass = (
        "phase 1" in phase_text or "phase 2" in phase_text or "phase 3" in phase_text
    )
    if not phase1_pass:
        return False
    return reason_class != "toxicity"


def _has_near_neighbor_match(
    context, therapeutic_area: str, study_fields: dict[str, object]
) -> bool:
    query = _normalize(therapeutic_area)
    condition_blob = " ".join(
        str(item) for item in (study_fields.get("conditions", []) or [])
    )

    if query and query in _normalize(condition_blob):
        return True
    if query and query in _normalize(context.source_disease):
        return True
    return any(
        query in _normalize(item) or _normalize(item) in query
        for item in (study_fields.get("conditions", []) or [])
    )


def _query_relevance_score(
    context, therapeutic_area: str, study_fields: dict[str, object]
) -> float:
    query = _normalize(therapeutic_area)
    if not query:
        return 0.0

    search_blob = " ".join(
        [
            context.source_disease,
            " ".join(str(item) for item in (study_fields.get("conditions", []) or [])),
            context.target,
            str(study_fields.get("title", "")),
            str(study_fields.get("text_blob", "")),
            " ".join(
                str(item) for item in (study_fields.get("interventions", []) or [])
            ),
        ]
    )
    blob = _normalize(search_blob)

    if query in blob:
        return 1.0

    query_tokens = {token for token in re.split(r"[^a-z0-9]+", query) if token}
    blob_tokens = {token for token in re.split(r"[^a-z0-9]+", blob) if token}
    if not query_tokens or not blob_tokens:
        return 0.0

    overlap = len(query_tokens & blob_tokens)
    return overlap / max(len(query_tokens), 1)


def _study_matches_asset(asset, study_fields: dict[str, object]) -> bool:
    """Weak linkage between internal asset and CTGov study intervention/title mentions."""
    name = _normalize(asset.internal_name)
    if not name:
        return False

    blob = _normalize(
        " ".join(
            [
                str(study_fields.get("title", "")),
                str(study_fields.get("text_blob", "")),
                " ".join(
                    str(item) for item in (study_fields.get("interventions", []) or [])
                ),
            ]
        )
    )
    return name in blob


def fetch_lazarus_candidates(
    db: Session,
    therapeutic_area: str,
    *,
    limit: int = 15,
) -> dict[UUID, LazarusDiscoverySignal]:
    """Return asset-level discovery signals that pass Lazarus shortlist logic."""
    assets = crud.list_assets(db)
    if not assets:
        return {}

    disease_studies = _fetch_ctgov_failed_studies(therapeutic_area)
    parsed_disease_studies = [_extract_study_fields(study) for study in disease_studies]
    if not parsed_disease_studies:
        return {}

    shortlisted: list[LazarusDiscoverySignal] = []

    for asset in assets:
        context = build_asset_context(asset)
        asset_linked_studies = [
            item for item in parsed_disease_studies if _study_matches_asset(asset, item)
        ]
        if not asset_linked_studies:
            # Do not evaluate assets against unrelated disease studies.
            continue
        parsed = asset_linked_studies

        # Expensive external probes are computed once per asset, not once per study row.
        query = f"{asset.internal_name} {therapeutic_area}".strip()
        pubmed_count = _pubmed_count(query)
        fda_label_count = _fda_label_count(asset.internal_name)
        biopharma_proxy = _biopharma_catalyst_proxy(asset)

        enrollments = [
            int(item["enrollment"])
            for item in parsed
            if isinstance(item.get("enrollment"), int) and int(item["enrollment"]) > 0
        ]
        baseline = statistics.median(enrollments) if enrollments else 100.0

        best_signal: LazarusDiscoverySignal | None = None

        for item in parsed:
            why_stopped = str(item.get("why_stopped", ""))
            text_blob = str(item.get("text_blob", ""))
            reason_class = _classify_failure_reason(
                why_stopped,
                f"{text_blob} {asset.business_failure_reason or ''}",
                status=str(item.get("status", "")),
                has_results=bool(item.get("has_results", True)),
            )
            query_relevance = _query_relevance_score(context, therapeutic_area, item)

            # Do not allow unrelated diseases to pass on strategic keywords alone.
            if query_relevance < 0.15:
                continue

            # Stage 1: Binary toxicity gate.
            if not _is_safe_to_rescue(asset, reason_class):
                continue

            enrollment = item.get("enrollment")
            enrollment_ratio = (
                round(float(enrollment) / float(baseline), 3)
                if isinstance(enrollment, int) and baseline > 0
                else None
            )

            has_secondary = _has_secondary_signal(text_blob)
            low_accrual = reason_class == "logistical" and (
                enrollment_ratio is None or enrollment_ratio < 0.65
            )
            strategic = reason_class in {"logistical", "strategic"}

            # Stage 2: efficacy vs enrollment filter.
            prime_candidate = bool(low_accrual and has_secondary)

            # Stage 3: market and indication near-neighbor mapping.
            neighbor = _has_near_neighbor_match(context, therapeutic_area, item)

            stage2_pass = strategic or prime_candidate or (neighbor and has_secondary)
            if not stage2_pass:
                continue

            source_score = _source_coverage_score(
                asset,
                item,
                pubmed_count=pubmed_count,
                fda_label_count=fda_label_count,
                biopharma_proxy=biopharma_proxy,
            )

            # Require enough source material for Advocate vs Skeptic debate quality.
            if source_score < 0.40:
                continue

            score = 0.0
            score += 0.35 if strategic else 0.0
            score += 0.25 if prime_candidate else 0.0
            score += 0.20 if neighbor else 0.0
            score += 0.20 * source_score
            if has_secondary:
                score += 0.10
            score += 0.25 * query_relevance

            signal = LazarusDiscoverySignal(
                asset_id=asset.id,
                score=round(min(0.99, score), 3),
                termination_reason=reason_class,
                source_coverage_score=source_score,
                has_secondary_signal=has_secondary,
                enrollment_ratio=enrollment_ratio,
                near_neighbor_match=neighbor,
                prime_candidate=prime_candidate,
            )

            if best_signal is None or signal.score > best_signal.score:
                best_signal = signal

        if best_signal is not None:
            shortlisted.append(best_signal)

    shortlisted.sort(key=lambda item: item.score, reverse=True)
    trimmed = shortlisted[: max(limit, 1)]
    return {item.asset_id: item for item in trimmed}
