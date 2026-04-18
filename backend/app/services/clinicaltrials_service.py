"""ClinicalTrials.gov integration helpers for asset cohort context."""

from __future__ import annotations

import json
import urllib.parse
import urllib.request
from collections import Counter
from urllib.error import URLError


CTGOV_BASE = "https://clinicaltrials.gov/api/v2/studies"


def _safe_int(value: object) -> int | None:
    if value is None:
        return None
    try:
        return int(str(value))
    except (TypeError, ValueError):
        return None


def _extract_study_summary(study: dict) -> tuple[dict, int | None, list[str], str | None]:
    protocol = study.get("protocolSection", {})
    ident = protocol.get("identificationModule", {})
    status = protocol.get("statusModule", {})
    conditions = protocol.get("conditionsModule", {})
    design = protocol.get("designModule", {})

    enrollment_count = _safe_int((design.get("enrollmentInfo", {}) or {}).get("count"))
    condition_list = [
        condition.strip()
        for condition in (conditions.get("conditions", []) or [])
        if isinstance(condition, str) and condition.strip()
    ]
    overall_status = status.get("overallStatus") if isinstance(status.get("overallStatus"), str) else None

    summary = {
        "nct_id": ident.get("nctId"),
        "title": ident.get("briefTitle"),
        "status": overall_status,
        "enrollment": enrollment_count,
    }
    return summary, enrollment_count, condition_list, overall_status


def fetch_patient_snapshot(drug_name: str, disease: str, page_size: int = 20) -> dict | None:
    """Fetch a compact cohort snapshot from ClinicalTrials.gov.

    We intentionally fail open and return None on upstream errors so the API
    remains available during network hiccups.
    """
    query = f"{drug_name} {disease}".strip()
    params = urllib.parse.urlencode({"query.term": query, "pageSize": max(5, min(page_size, 50))})
    url = f"{CTGOV_BASE}?{params}"

    try:
        req = urllib.request.Request(url, headers={"User-Agent": "LazarusSwarm/1.0"})
        with urllib.request.urlopen(req, timeout=8) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (URLError, TimeoutError, json.JSONDecodeError):
        return None

    studies = payload.get("studies", [])
    if not studies:
        return {
            "asset_query": query,
            "trial_count": 0,
            "cohort_size": None,
            "target_subgroup": "No matching cohort found",
            "treatment_efficacy": None,
            "control_efficacy": None,
            "p_value": None,
            "is_significant": None,
            "method": "ClinicalTrials.gov v2 aggregate (no direct efficacy data)",
            "source": "clinicaltrials.gov",
            "studies": [],
        }

    enrollments: list[int] = []
    condition_counter: Counter[str] = Counter()
    status_counter: Counter[str] = Counter()
    summarized_studies: list[dict] = []

    for study in studies:
        summary, enrollment_count, condition_list, overall_status = _extract_study_summary(study)

        if enrollment_count is not None and enrollment_count > 0:
            enrollments.append(enrollment_count)

        for condition in condition_list:
            condition_counter[condition] += 1

        if overall_status:
            status_counter[overall_status] += 1

        summarized_studies.append(summary)

    cohort_size = int(sum(enrollments) / len(enrollments)) if enrollments else None
    target_subgroup = condition_counter.most_common(1)[0][0] if condition_counter else disease
    completed = status_counter.get("COMPLETED", 0)
    trial_count = len(studies)

    # ClinicalTrials.gov does not provide normalized treatment/control efficacy
    # or p-values in this endpoint, so we expose nulls explicitly.
    return {
        "asset_query": query,
        "trial_count": trial_count,
        "cohort_size": cohort_size,
        "target_subgroup": target_subgroup,
        "treatment_efficacy": None,
        "control_efficacy": None,
        "p_value": None,
        "is_significant": None,
        "completed_trials": completed,
        "method": "ClinicalTrials.gov v2 aggregate (no direct efficacy data)",
        "source": "clinicaltrials.gov",
        "studies": summarized_studies[:5],
    }
