"""Real-time API clients for drug repurposing data.

Clients:
  - OpenTargets GraphQL API  (targets, disease associations)
  - PubMed E-utilities       (literature evidence)
  - ClinicalTrials.gov v2    (trial data)
  - OpenFDA                  (adverse events)

All clients return data pre-mapped to our internal types so context_service
can use them as drop-in replacements for the hardcoded CONTEXT_MAP.
"""

from __future__ import annotations

import json
import logging
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

logger = logging.getLogger(__name__)

_TIMEOUT = 10  # seconds per API call

# ─── helpers ────────────────────────────────────────────────────────────────

def _get_json(url: str, *, timeout: int = _TIMEOUT) -> dict | list | None:
    """GET a URL, return parsed JSON or None on failure."""
    try:
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode())
    except Exception:
        logger.warning("API call failed: %s", url, exc_info=True)
        return None


def _post_json(url: str, body: dict, *, timeout: int = _TIMEOUT) -> dict | None:
    """POST JSON to a URL, return parsed JSON or None on failure."""
    try:
        data = json.dumps(body).encode()
        req = urllib.request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json", "Accept": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode())
    except Exception:
        logger.warning("API POST failed: %s", url, exc_info=True)
        return None


# ─── OpenTargets GraphQL ────────────────────────────────────────────────────

OPENTARGETS_URL = "https://api.platform.opentargets.org/api/v4/graphql"


def _opentargets_search_drug_id(drug_name: str) -> str | None:
    """Search OpenTargets for a drug and return its ChEMBL ID."""
    query = """
    query($q: String!) {
      search(queryString: $q, entityNames: ["drug"], page: {size: 1, index: 0}) {
        hits { id name }
      }
    }
    """
    resp = _post_json(OPENTARGETS_URL, {"query": query, "variables": {"q": drug_name}})
    if not resp:
        return None
    hits = resp.get("data", {}).get("search", {}).get("hits", [])
    return hits[0]["id"] if hits else None


def _opentargets_drug_detail(chembl_id: str) -> dict | None:
    """Fetch full drug details by ChEMBL ID."""
    query = """
    query($id: String!) {
      drug(chemblId: $id) {
        id
        name
        drugType
        maximumClinicalStage
        description
        synonyms
        tradeNames
        mechanismsOfAction {
          rows {
            mechanismOfAction
            targets { approvedSymbol approvedName }
          }
        }
        indications {
          count
          rows { disease { id name } }
        }
        adverseEvents {
          count
          rows { name count }
        }
        drugWarnings { toxicityClass description }
      }
    }
    """
    resp = _post_json(OPENTARGETS_URL, {"query": query, "variables": {"id": chembl_id}})
    if not resp:
        return None
    return resp.get("data", {}).get("drug")


def fetch_drug_targets(drug_name: str) -> list[str]:
    """Return list of target symbols for a drug via OpenTargets."""
    chembl_id = _opentargets_search_drug_id(drug_name)
    if not chembl_id:
        return []
    detail = _opentargets_drug_detail(chembl_id)
    if not detail:
        return []

    targets: list[str] = []
    try:
        moa = detail.get("mechanismsOfAction") or {}
        for row in moa.get("rows", []):
            for t in row.get("targets", []):
                symbol = t.get("approvedSymbol", "")
                name = t.get("approvedName", "")
                targets.append(symbol or name)
    except Exception:
        logger.warning("Failed parsing OpenTargets targets for %s", drug_name)
    return list(dict.fromkeys(targets))[:5]


def fetch_disease_associations(drug_name: str) -> list[str]:
    """Return list of disease names associated with a drug via OpenTargets."""
    chembl_id = _opentargets_search_drug_id(drug_name)
    if not chembl_id:
        return []
    detail = _opentargets_drug_detail(chembl_id)
    if not detail:
        return []

    diseases: list[str] = []
    try:
        indications = detail.get("indications") or {}
        for row in indications.get("rows", []):
            d = row.get("disease") or {}
            if d.get("name"):
                diseases.append(d["name"])
    except Exception:
        logger.warning("Failed parsing OpenTargets diseases for %s", drug_name)
    return list(dict.fromkeys(diseases))[:10]


def fetch_target_disease_associations(target_symbol: str) -> list[str]:
    """Given a target symbol (e.g. JAK1), find associated diseases."""
    # Search for the target ID first
    search_query = """
    query($q: String!) {
      search(queryString: $q, entityNames: ["target"], page: {size: 1, index: 0}) {
        hits { id name }
      }
    }
    """
    resp = _post_json(OPENTARGETS_URL, {"query": search_query, "variables": {"q": target_symbol}})
    if not resp:
        return []

    hits = resp.get("data", {}).get("search", {}).get("hits", [])
    if not hits:
        return []

    target_id = hits[0]["id"]
    # Get associated diseases for this target
    detail_query = """
    query($id: String!) {
      target(ensemblId: $id) {
        associatedDiseases(page: {size: 10, index: 0}) {
          rows {
            disease { name }
            score
          }
        }
      }
    }
    """
    resp2 = _post_json(OPENTARGETS_URL, {"query": detail_query, "variables": {"id": target_id}})
    if not resp2:
        return []

    diseases: list[str] = []
    try:
        target_data = resp2.get("data", {}).get("target") or {}
        assoc = target_data.get("associatedDiseases") or {}
        for row in assoc.get("rows", []):
            d = row.get("disease") or {}
            if d.get("name"):
                diseases.append(d["name"])
    except Exception:
        logger.warning("Failed parsing OpenTargets target diseases for %s", target_symbol)
    return list(dict.fromkeys(diseases))[:10]


# ─── PubMed E-utilities ────────────────────────────────────────────────────

PUBMED_SEARCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
PUBMED_SUMMARY_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi"


def fetch_pubmed_evidence(
    drug_name: str,
    disease: str,
    max_results: int = 3,
) -> list[dict]:
    """Search PubMed for papers about drug+disease.
    Returns list of {source_ref, title, snippet, evidence_type}.
    """
    search_term = f"{drug_name} {disease} repurposing"
    params = urllib.parse.urlencode({
        "db": "pubmed",
        "term": search_term,
        "retmax": max_results,
        "retmode": "json",
        "sort": "relevance",
    })
    search_resp = _get_json(f"{PUBMED_SEARCH_URL}?{params}")
    if not search_resp:
        return []

    ids = search_resp.get("esearchresult", {}).get("idlist", [])
    if not ids:
        return []

    # Fetch summaries for found IDs
    summary_params = urllib.parse.urlencode({
        "db": "pubmed",
        "id": ",".join(ids),
        "retmode": "json",
    })
    summary_resp = _get_json(f"{PUBMED_SUMMARY_URL}?{summary_params}")
    if not summary_resp:
        return []

    results = []
    result_data = summary_resp.get("result", {})
    for pmid in ids:
        article = result_data.get(pmid, {})
        if not article or not isinstance(article, dict):
            continue
        title = article.get("title", "Untitled")
        # Use sorttitle or first 200 chars of title as snippet
        snippet = article.get("sorttitle", title)[:300]
        # Build a richer snippet from available fields
        source_str = article.get("source", "")
        pub_date = article.get("pubdate", "")
        if source_str:
            snippet = f"{title} ({source_str}, {pub_date})"

        results.append({
            "source_ref": f"PMID-{pmid}",
            "title": title,
            "snippet": snippet[:300],
            "evidence_type": "pubmed",
        })
    return results


# ─── ClinicalTrials.gov v2 API ─────────────────────────────────────────────

CT_GOV_URL = "https://clinicaltrials.gov/api/v2/studies"


def fetch_clinical_trials(
    drug_name: str,
    disease: str,
    max_results: int = 2,
) -> list[dict]:
    """Search ClinicalTrials.gov for relevant trials.
    Returns list of {source_ref, title, snippet, evidence_type}.
    """
    params = urllib.parse.urlencode({
        "query.term": f"{drug_name} {disease}",
        "pageSize": max_results,
        "format": "json",
    })
    resp = _get_json(f"{CT_GOV_URL}?{params}")
    if not resp:
        return []

    results = []
    for study in resp.get("studies", []):
        proto = study.get("protocolSection", {})
        id_mod = proto.get("identificationModule", {})
        desc_mod = proto.get("descriptionModule", {})
        status_mod = proto.get("statusModule", {})

        nct_id = id_mod.get("nctId", "")
        title = id_mod.get("briefTitle", id_mod.get("officialTitle", "Untitled"))
        brief_summary = desc_mod.get("briefSummary", "")
        overall_status = status_mod.get("overallStatus", "")

        snippet = brief_summary[:300] if brief_summary else f"Status: {overall_status}. {title}"

        results.append({
            "source_ref": nct_id,
            "title": title,
            "snippet": snippet,
            "evidence_type": "clinical_trial",
        })
    return results


# ─── OpenFDA ────────────────────────────────────────────────────────────────

OPENFDA_URL = "https://api.fda.gov/drug/event.json"


def fetch_adverse_events(drug_name: str, max_results: int = 5) -> list[str]:
    """Fetch top adverse events reported for a drug from OpenFDA.
    Returns list of event description strings.
    """
    params = urllib.parse.urlencode({
        "search": f'patient.drug.openfda.generic_name:"{drug_name}"',
        "count": "patient.reaction.reactionmeddrapt.exact",
        "limit": max_results,
    })
    resp = _get_json(f"{OPENFDA_URL}?{params}")
    if not resp:
        return []

    results = []
    for item in resp.get("results", []):
        term = item.get("term", "")
        if term:
            results.append(term)
    return results


# ─── Drug Search (ChEMBL-style via OpenTargets) ────────────────────────────

def search_drugs(query: str, max_results: int = 10) -> list[dict]:
    """Search for drugs by name. Returns list of drug info dicts."""
    # Step 1: Search for matching drug IDs
    search_gql = """
    query($q: String!) {
      search(queryString: $q, entityNames: ["drug"], page: {size: 10, index: 0}) {
        hits { id name entity description }
      }
    }
    """
    resp = _post_json(OPENTARGETS_URL, {"query": search_gql, "variables": {"q": query}})
    if not resp:
        return []

    drugs = []
    try:
        for hit in resp.get("data", {}).get("search", {}).get("hits", [])[:max_results]:
            chembl_id = hit.get("id", "")
            # Step 2: Get details for each drug
            detail = _opentargets_drug_detail(chembl_id)
            if detail:
                stage = detail.get("maximumClinicalStage", "")
                warnings = detail.get("drugWarnings") or []
                drugs.append({
                    "chembl_id": chembl_id,
                    "name": detail.get("name", hit.get("name", "")),
                    "description": (hit.get("description") or "")[:200],
                    "drug_type": detail.get("drugType", "unknown"),
                    "max_phase": stage,
                    "is_approved": stage == "APPROVAL",
                    "has_been_withdrawn": any(
                        w.get("toxicityClass") for w in warnings
                    ) if warnings else False,
                })
            else:
                drugs.append({
                    "chembl_id": chembl_id,
                    "name": hit.get("name", ""),
                    "description": (hit.get("description") or "")[:200],
                    "drug_type": "unknown",
                    "max_phase": "unknown",
                    "is_approved": False,
                    "has_been_withdrawn": False,
                })
    except Exception:
        logger.warning("Failed parsing drug search for %s", query)
    return drugs


# ─── Combined context fetch ────────────────────────────────────────────────

def fetch_full_context(
    drug_name: str,
    source_disease: str,
) -> dict:
    """Fetch all context for a drug from real APIs.

    Returns a dict matching the CONTEXT_MAP shape:
      {target, linked_diseases, adverse_events, evidence_refs}
    """
    # 1. Get drug ChEMBL ID and full details
    chembl_id = _opentargets_search_drug_id(drug_name)
    detail = _opentargets_drug_detail(chembl_id) if chembl_id else None

    # 2. Extract targets from drug detail
    targets: list[str] = []
    if detail:
        moa = detail.get("mechanismsOfAction") or {}
        for row in moa.get("rows", []):
            for t in row.get("targets", []):
                symbol = t.get("approvedSymbol", "")
                name = t.get("approvedName", "")
                targets.append(symbol or name)
        targets = list(dict.fromkeys(targets))[:5]
    primary_target = targets[0] if targets else "Unknown target"

    # 3. Get linked diseases — from drug indications + target associations
    drug_diseases: list[str] = []
    if detail:
        indications = detail.get("indications") or {}
        for row in indications.get("rows", []):
            d = row.get("disease") or {}
            if d.get("name"):
                drug_diseases.append(d["name"])
    target_diseases = fetch_target_disease_associations(primary_target) if primary_target != "Unknown target" else []
    all_diseases = list(dict.fromkeys(drug_diseases + target_diseases))
    # Remove the source disease from linked list
    linked = [d for d in all_diseases if d.lower() != source_disease.lower()][:8]

    # 4. Get adverse events — try OpenFDA first, fallback to OpenTargets
    adverse = fetch_adverse_events(drug_name)
    if not adverse and detail:
        # Use OpenTargets adverse events
        ae_data = detail.get("adverseEvents") or {}
        for row in ae_data.get("rows", [])[:5]:
            if row.get("name"):
                adverse.append(row["name"])
    if not adverse:
        adverse = ["No adverse event data available"]

    # 4. Get evidence from PubMed
    pubmed_refs = fetch_pubmed_evidence(drug_name, source_disease)

    # 5. Get clinical trials
    trial_refs = fetch_clinical_trials(drug_name, source_disease)

    evidence_refs = pubmed_refs + trial_refs
    if not evidence_refs:
        evidence_refs = [{
            "source_ref": "API-NONE",
            "title": f"No published evidence found for {drug_name} + {source_disease}",
            "snippet": "Real-time API search returned no results. The LLM will reason from mechanism data only.",
            "evidence_type": "api_fallback",
        }]

    return {
        "target": primary_target,
        "linked_diseases": linked if linked else ["No linked diseases found"],
        "adverse_events": adverse,
        "evidence_refs": evidence_refs,
    }
