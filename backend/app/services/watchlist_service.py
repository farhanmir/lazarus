"""Watchlist service: background scan all drugs for a user-requested disease."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from threading import Thread
from uuid import UUID

from backend.app import crud, schemas
from backend.app.db import SessionLocal
from backend.app.services.context_service import build_asset_context
from backend.app.services.gmail_service import send_gmail_scan_summary, send_gmail_watchlist_alert
from backend.app.services.imessage_service import send_watchlist_alert_message, send_watchlist_scan_summary
from backend.app.services.reasoning_service import _execute_reasoning_pipeline

logger = logging.getLogger(__name__)

# Minimum confidence to trigger an alert
ALERT_CONFIDENCE_THRESHOLD = 0.60

# Reuse cached hypotheses if they are less than this old
CACHE_TTL_HOURS = 24


def _disease_matches(query: str, target: str) -> bool:
    """Fuzzy match: does the target disease match the user's query?"""
    q = query.lower().strip()
    t = target.lower().strip()
    # Exact or substring match
    return q in t or t in q


def _get_cached_hypothesis(db, asset_id: UUID):
    """Return the most recent hypothesis for this asset if it's within the cache TTL."""
    hypotheses = crud.list_hypotheses_by_asset(db, asset_id)
    if not hypotheses:
        return None
    latest = hypotheses[0]  # already ordered by created_at desc
    cutoff = datetime.now(timezone.utc) - timedelta(hours=CACHE_TTL_HOURS)
    created = latest.created_at
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    if created >= cutoff:
        logger.info("[watchlist] cache HIT for asset %s — reusing hypothesis %s (age: %s)",
                     asset_id, latest.id, datetime.now(timezone.utc) - created)
        return latest
    logger.info("[watchlist] cache EXPIRED for asset %s (age: %s)", asset_id, datetime.now(timezone.utc) - created)
    return None


def _scan_all_assets_for_disease(watchlist_id: UUID, disease_query: str) -> None:
    """Run pipeline on every asset and create alerts for matches.

    Uses cached hypotheses when available to avoid expensive LLM calls.
    """
    logger.info("[watchlist] starting background scan for '%s' (watchlist=%s)", disease_query, watchlist_id)

    with SessionLocal() as db:
        assets = crud.list_assets(db)
        matched_count = 0
        cache_hits = 0

        for asset in assets:
            try:
                # --- cache check ---
                cached = _get_cached_hypothesis(db, asset.id)
                if cached is not None:
                    cache_hits += 1
                    target_disease = cached.target_disease
                    confidence = cached.final_confidence or 0.0
                    risk_level = "unknown"
                    run_id = cached.run_id
                    hypothesis_id = cached.id
                else:
                    # no cache — run full pipeline
                    run = crud.create_run(db, asset_id=asset.id, run_type="watchlist_scan", status="running")
                    result = _execute_reasoning_pipeline(db, asset=asset, run=run)
                    target_disease = result.hypothesis.target_disease
                    confidence = result.final_confidence
                    risk_level = result.reasoning.skeptic.risk_level if result.reasoning else "unknown"
                    run_id = run.id
                    hypothesis_id = result.hypothesis.id

                # Check if the proposed disease matches the user's query
                if _disease_matches(disease_query, target_disease) and confidence >= ALERT_CONFIDENCE_THRESHOLD:
                    context = build_asset_context(asset)
                    alert_summary = (
                        f"{asset.internal_name} ({asset.asset_code}) was originally developed for "
                        f"{asset.original_indication} but was shelved due to "
                        f"{asset.business_failure_reason or 'unknown reasons'}. "
                        f"Our analysis shows it could be repurposed for {target_disease} "
                        f"with {confidence:.0%} confidence."
                    )

                    crud.create_watchlist_alert(
                        db,
                        watchlist_id=watchlist_id,
                        asset_id=asset.id,
                        run_id=run_id,
                        hypothesis_id=hypothesis_id,
                        asset_code=asset.asset_code,
                        drug_name=asset.internal_name,
                        original_indication=asset.original_indication,
                        matched_disease=target_disease,
                        final_confidence=confidence,
                        risk_level=risk_level,
                        summary=alert_summary,
                    )
                    matched_count += 1
                    logger.info(
                        "[watchlist] ALERT: %s -> %s (confidence=%.2f) matches '%s'",
                        asset.asset_code, target_disease, confidence, disease_query,
                    )

                    # Send alert to iMessage via Photon/Spectrum
                    try:
                        imsg_result = send_watchlist_alert_message(
                            drug_name=asset.internal_name,
                            asset_code=asset.asset_code,
                            original_indication=asset.original_indication,
                            matched_disease=target_disease,
                            confidence=confidence,
                            risk_level=risk_level,
                            reason=alert_summary,
                        )
                        logger.info("[watchlist] iMessage alert for %s: %s", asset.asset_code, imsg_result.get("status"))
                    except Exception:
                        logger.exception("[watchlist] iMessage send failed for %s", asset.asset_code)

                    # Send alert via Gmail
                    try:
                        gmail_result = send_gmail_watchlist_alert(
                            drug_name=asset.internal_name,
                            asset_code=asset.asset_code,
                            original_indication=asset.original_indication,
                            matched_disease=target_disease,
                            confidence=confidence,
                            risk_level=risk_level,
                            reason=alert_summary,
                        )
                        logger.info("[watchlist] Gmail alert for %s: %s", asset.asset_code, gmail_result.get("status"))
                    except Exception:
                        logger.exception("[watchlist] Gmail send failed for %s", asset.asset_code)
                else:
                    logger.info(
                        "[watchlist] no match: %s -> %s (confidence=%.2f) for query '%s'",
                        asset.asset_code, target_disease, confidence, disease_query,
                    )

            except Exception:
                logger.exception("[watchlist] failed pipeline for %s", asset.asset_code)

        # Mark watchlist as completed
        wl = crud.get_watchlist(db, watchlist_id)
        if wl is not None:
            crud.complete_watchlist(db, wl)

        logger.info(
            "[watchlist] scan complete for '%s': %d assets tested, %d alerts generated, %d cache hits",
            disease_query, len(assets), matched_count, cache_hits,
        )

        # Send scan completion summary via iMessage
        try:
            send_watchlist_scan_summary(
                disease_query=disease_query,
                total_assets=len(assets),
                alert_count=matched_count,
                cache_hits=cache_hits,
            )
        except Exception:
            logger.exception("[watchlist] iMessage scan summary send failed")

        # Send scan completion summary via Gmail
        try:
            send_gmail_scan_summary(
                disease_query=disease_query,
                total_assets=len(assets),
                alert_count=matched_count,
                cache_hits=cache_hits,
            )
        except Exception:
            logger.exception("[watchlist] Gmail scan summary send failed")


def start_watchlist_scan(watchlist_id: UUID, disease_query: str) -> None:
    """Launch the background scan in a daemon thread."""
    Thread(
        target=_scan_all_assets_for_disease,
        args=(watchlist_id, disease_query),
        daemon=True,
    ).start()
