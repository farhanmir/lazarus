"""Single-shot rescue pipeline: CT.gov → Gemini autopsy → K2 strategy → PDF → Photon."""

from __future__ import annotations

import json
import logging
import os
import random
from pathlib import Path
from uuid import UUID, uuid4

from backend.app import schemas
from backend.app.services.discovery_service import list_failed_trial_summaries
from backend.app.services.llm_service import gemini_chat_completion, k2_chat_completion
from backend.app.services.pdf_service import render_pdf_from_html
from backend.app.services.spectrum_service import send_spectrum_reply

logger = logging.getLogger(__name__)

RESCUE_ARTIFACTS_DIR = (
    Path(__file__).resolve().parent.parent.parent.parent / "artifacts" / "rescue"
)
BLUEPRINT_CSS = Path(__file__).resolve().parent.parent / "templates" / "blueprint.css"

STAGE_DEFS: list[tuple[str, str]] = [
    ("discovery", "Searching trials (OpenClaw ladder + CT.gov v2)"),
    ("ingest", "Ingesting data (Gemini)"),
    ("reason", "Reasoning pivot (K2 Think V2)"),
    ("blueprint", "Finalizing blueprint (Dedalus-ready PDF)"),
    ("photon", "Sending alert (Photon / Spectrum)"),
]

HUMOR: dict[str, str] = {
    "discovery": "Bribing ClinicalTrials.gov with a tasteful User-Agent string.",
    "ingest": "Negotiating with the trial ghost. It demands JSON, not vibes.",
    "reason": "Asking K2 to be serious for once. (No promises.)",
    "blueprint": "Teaching electrons to pretend they are a McKinsey deck.",
    "photon": "If the phone buzzes, the demo gods smiled upon you.",
}

FOOTNOTES = [
    "Disclaimer: Lazarus is a hackathon project, not your IRB.",
    "If a judge asks about p-values, offer them coffee first.",
    "We respect futility. Toxicity still wins. Chemistry is not negotiable via SMS.",
]


AUTOPSY_SCHEMA: dict = {
    "type": "object",
    "properties": {
        "trial_id": {"type": "string"},
        "headline": {"type": "string"},
        "failure_classification": {
            "type": "string",
            "description": "e.g. toxicity, futility, logistical, strategic, unknown",
        },
        "likely_primary_reason": {"type": "string"},
        "safety_signal": {"type": "string"},
        "rescue_hint": {"type": "string"},
    },
    "required": [
        "trial_id",
        "headline",
        "failure_classification",
        "likely_primary_reason",
        "safety_signal",
        "rescue_hint",
    ],
    "additionalProperties": False,
}

STRATEGY_SCHEMA: dict = {
    "type": "object",
    "properties": {
        "scientific_rescue_strategy": {"type": "string"},
        "pivot_options": {
            "type": "array",
            "items": {"type": "string"},
            "minItems": 1,
            "maxItems": 7,
        },
        "validation_next_steps": {"type": "string"},
    },
    "required": ["scientific_rescue_strategy", "pivot_options", "validation_next_steps"],
    "additionalProperties": False,
}


def _stage(
    stage_id: str,
    label: str,
    status: str,
    *,
    data: dict | None = None,
) -> schemas.RescueStagePayload:
    return schemas.RescueStagePayload(
        id=stage_id,
        label=label,
        status=status,
        humor=HUMOR.get(stage_id, ""),
        data=data or {},
    )


def _skipped_tail(from_index: int, reason: str) -> list[schemas.RescueStagePayload]:
    out: list[schemas.RescueStagePayload] = []
    for i in range(from_index, len(STAGE_DEFS)):
        sid, lab = STAGE_DEFS[i]
        out.append(
            _stage(sid, lab, "skipped", data={"detail": reason}),
        )
    return out


def _heuristic_autopsy(
    disease: str, trial: dict[str, object]
) -> dict[str, str]:
    nct = str(trial.get("nct_id") or "")
    title = str(trial.get("title") or "")[:200]
    why = str(trial.get("why_stopped") or "").strip()
    status = str(trial.get("status") or "")
    blob = f"{why} {trial.get('text_blob', '')}".lower()
    if any(x in blob for x in ("toxic", "safety", "adverse", "hepato", "liver")):
        fclass = "toxicity"
    elif any(x in blob for x in ("futil", "efficacy", "endpoint", "lack of")):
        fclass = "futility"
    elif any(x in blob for x in ("fund", "enroll", "accrual", "sponsor")):
        fclass = "logistical_or_strategic"
    else:
        fclass = "unknown"
    return {
        "trial_id": nct,
        "headline": f"{title} ({status}) — autopsy without LLM (registry text only).",
        "failure_classification": fclass,
        "likely_primary_reason": why or "Not stated in structured termination fields.",
        "safety_signal": "Review intervention arms and DSMB narrative in the full record.",
        "rescue_hint": f"If failure was non-biological, re-test mechanistic fit vs {disease}.",
    }


def _heuristic_strategy(autopsy: dict[str, str]) -> dict[str, str | list[str]]:
    return {
        "scientific_rescue_strategy": (
            "Heuristic fallback: tighten inclusion to lower-risk metabolism if toxicity was dose-related; "
            "if logistical failure, preserve biology and redesign powering."
        ),
        "pivot_options": [
            autopsy.get("rescue_hint", "Narrow population"),
            "Biomarker-enriched cohort readout",
            "Partner-led site network expansion",
        ],
        "validation_next_steps": "Confirm with CSR/protocol synopsis; do not skip tox panel review.",
    }


def _trial_text_bundle(trial: dict[str, object]) -> str:
    slim = {
        k: trial.get(k)
        for k in (
            "nct_id",
            "title",
            "status",
            "why_stopped",
            "conditions",
            "interventions",
            "enrollment",
            "has_results",
        )
    }
    return json.dumps(slim, indent=2)[:14000]


def _render_rescue_pdf_html(
    disease: str,
    trial: dict[str, object],
    autopsy: dict,
    strategy: dict,
) -> str:
    pivots = strategy.get("pivot_options") or []
    li = "".join(f"<li>{str(p)}</li>" for p in pivots[:7])
    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><title>Rescue blueprint</title></head>
<body style="font-family: system-ui, sans-serif; padding: 2rem; color: #0f172a;">
  <h1>Lazarus rescue blueprint</h1>
  <p><strong>Disease query:</strong> {disease}</p>
  <p><strong>Trial:</strong> {trial.get("nct_id", "")} — {trial.get("title", "")}</p>
  <h2>Trial autopsy</h2>
  <p><strong>{autopsy.get("headline", "")}</strong></p>
  <p>Classification: {autopsy.get("failure_classification", "")}</p>
  <p>Primary reason: {autopsy.get("likely_primary_reason", "")}</p>
  <p>Safety: {autopsy.get("safety_signal", "")}</p>
  <h2>Scientific rescue strategy</h2>
  <p>{strategy.get("scientific_rescue_strategy", "")}</p>
  <h3>Pivot options</h3>
  <ol>{li}</ol>
  <p><strong>Next validation:</strong> {strategy.get("validation_next_steps", "")}</p>
  <hr/>
  <p style="font-size: 12px; color: #64748b;">Generated for demo — not clinical advice.</p>
</body>
</html>"""


def run_rescue_pipeline(
    disease: str,
    *,
    recipient: str | None = None,
) -> schemas.RescuePipelineResponse:
    disease_clean = disease.strip()
    footnote = random.choice(FOOTNOTES)
    stages: list[schemas.RescueStagePayload] = []

    trials = list_failed_trial_summaries(disease_clean, max_trials=18)
    if not trials:
        stages.append(
            _stage(
                STAGE_DEFS[0][0],
                STAGE_DEFS[0][1],
                "error",
                data={
                    "detail": "No terminated/withdrawn/completed trials returned for this disease query.",
                },
            ),
        )
        stages.extend(_skipped_tail(1, "Discovery returned no trials."))
        return schemas.RescuePipelineResponse(
            disease=disease_clean,
            stages=stages,
            footnote=footnote,
            photon_status={"status": "skipped", "reason": "Pipeline stopped early."},
        )

    primary: dict[str, object] = trials[0]
    for row in trials:
        if str(row.get("why_stopped", "")).strip():
            primary = row
            break

    openclaw_note = (
        "OpenClaw operators can call /openclaw/* for scripted actions; "
        "this stage used the hosted ClinicalTrials.gov v2 Studies API."
    )
    stages.append(
        _stage(
            "discovery",
            STAGE_DEFS[0][1],
            "complete",
            data={
                "openclaw_operator_note": openclaw_note,
                "trials_found": len(trials),
                "primary_trial": primary,
                "trial_sample": trials[:6],
            },
        ),
    )

    bundle = _trial_text_bundle(primary)
    gemini_model = os.getenv("RESCUE_GEMINI_MODEL", "gemini-2.5-flash").strip() or "gemini-2.5-flash"
    autopsy: dict | None = gemini_chat_completion(
        model=gemini_model,
        system_prompt=(
            "You are a clinical trial analyst. Using ONLY the JSON trial bundle provided, "
            "produce a concise Trial Autopsy. If text is thin, say unknown rather than inventing."
        ),
        user_prompt=f"Disease focus: {disease_clean}\n\nTrial bundle:\n{bundle}",
        response_schema=AUTOPSY_SCHEMA,
    )
    if not isinstance(autopsy, dict):
        autopsy = _heuristic_autopsy(disease_clean, primary)
        ingest_mode = "heuristic_fallback"
    else:
        ingest_mode = "gemini_json"

    stages.append(
        _stage(
            "ingest",
            STAGE_DEFS[1][1],
            "complete",
            data={"mode": ingest_mode, "autopsy": autopsy},
        ),
    )

    autopsy_s = {k: str(v) for k, v in autopsy.items() if isinstance(v, (str, int, float))}
    k2_model = (
        os.getenv("K2_RESCUE_MODEL", "").strip()
        or os.getenv("K2_PROVIDER_MODEL", "").strip()
        or os.getenv("K2_MODEL", "").strip()
        or "k2-thinking-v2"
    )
    strategy = k2_chat_completion(
        model=k2_model,
        system_prompt=(
            "You are a rigorous clinical scientist. Given the trial autopsy JSON, propose a "
            "Scientific Rescue Strategy: pivots must be actionable and must not contradict "
            "a toxicity wall without explicit mitigation."
        ),
        user_prompt=json.dumps({"disease": disease_clean, "autopsy": autopsy_s}, indent=2),
        response_schema=STRATEGY_SCHEMA,
    )
    if not isinstance(strategy, dict):
        strategy = _heuristic_strategy(autopsy_s)
        reason_mode = "heuristic_fallback"
    else:
        reason_mode = "k2_json"

    stages.append(
        _stage(
            "reason",
            STAGE_DEFS[2][1],
            "complete",
            data={"mode": reason_mode, "strategy": strategy},
        ),
    )

    artifact_uuid = uuid4()
    RESCUE_ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    pdf_path = RESCUE_ARTIFACTS_DIR / f"{artifact_uuid}.pdf"
    html = _render_rescue_pdf_html(disease_clean, primary, autopsy, strategy)
    artifact_id: UUID | None = artifact_uuid
    download_path: str | None = f"/api/rescue-artifacts/{artifact_uuid}/pdf"
    bp_detail = str(pdf_path)
    try:
        render_pdf_from_html(
            html,
            pdf_path,
            BLUEPRINT_CSS if BLUEPRINT_CSS.exists() else None,
        )
        bp_status = "complete"
    except Exception:
        logger.exception("rescue pdf render failed")
        bp_status = "error"
        bp_detail = "PDF render failed"
        download_path = None
        artifact_id = None

    stages.append(
        _stage(
            "blueprint",
            STAGE_DEFS[3][1],
            bp_status,
            data={
                "execution_note": "Rendered as PDF on the Lazarus host (container/Dedalus BYOK optional).",
                "path": bp_detail,
            },
        ),
    )

    public_base = os.getenv("PUBLIC_API_BASE", "http://127.0.0.1:8000").rstrip("/")
    pivots = strategy.get("pivot_options") if isinstance(strategy.get("pivot_options"), list) else []
    n_cand = min(len(pivots), 5)
    nct = str(primary.get("nct_id") or "unknown")
    link = f"{public_base}{download_path}" if download_path else f"{public_base}/"
    message = (
        f"Trial rescue digest: {disease_clean} (NCT {nct}). "
        f"{n_cand} pivot path(s) from K2-style reasoning. "
        f"Blueprint: {link}"
    )

    photon_result: dict = {"status": "skipped", "reason": "No recipient configured."}
    target_recipient = (recipient or "").strip() or os.getenv("SPECTRUM_RECIPIENT", "").strip()
    if target_recipient:
        try:
            photon_result = send_spectrum_reply(
                recipient=target_recipient,
                message=message,
                metadata={
                    "source": "lazarus-rescue-pipeline",
                    "nct_id": nct,
                    "disease": disease_clean,
                },
            )
        except Exception as exc:  # pragma: no cover - network
            photon_result = {"status": "failed", "reason": str(exc)}
    else:
        photon_result = {
            "status": "skipped",
            "reason": "Pass recipient in request body or set SPECTRUM_RECIPIENT.",
            "draft_message": message,
        }

    ps = str(photon_result.get("status", "skipped"))
    photon_stage_status = (
        "complete" if ps == "sent" else ("error" if ps == "failed" else "skipped")
    )
    stages.append(
        _stage(
            "photon",
            STAGE_DEFS[4][1],
            photon_stage_status,
            data=photon_result,
        ),
    )

    return schemas.RescuePipelineResponse(
        disease=disease_clean,
        stages=stages,
        artifact_id=artifact_id,
        blueprint_download_path=download_path,
        photon_status=photon_result,
        footnote=footnote,
    )
