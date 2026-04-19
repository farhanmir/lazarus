"""API routes for multi-disease scan and disease watchlist."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app import crud, schemas
from backend.app.db import get_db
from backend.app.services.api_clients import search_drugs, fetch_full_context
from backend.app.services.multi_disease_service import ALL_KNOWN_DISEASES, run_multi_disease_scan
from backend.app.services.watchlist_service import start_watchlist_scan

router = APIRouter(tags=["scan"])


# ───────────────────────── Multi-Disease Scan ─────────────────────────


@router.post(
    "/scan/multi-disease",
    response_model=schemas.MultiDiseaseScanResponse,
    status_code=status.HTTP_201_CREATED,
)
def multi_disease_scan(
    payload: schemas.MultiDiseaseScanRequest,
    db: Session = Depends(get_db),
):
    """Run the pipeline for one drug against multiple diseases and return ranked results."""
    try:
        return run_multi_disease_scan(db, payload.asset_id, payload.target_diseases or None)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/scan/diseases")
def list_known_diseases():
    """Return all disease names the system can simulate against."""
    return {"diseases": ALL_KNOWN_DISEASES}


# ───────────────────────── Drug Search (Real-time) ─────────────────────────


@router.get("/scan/drugs")
def search_drugs_endpoint(q: str = ""):
    """Search for real drugs via OpenTargets. Returns name, type, phase, etc."""
    if not q or len(q) < 2:
        return {"drugs": []}
    return {"drugs": search_drugs(q, max_results=10)}


@router.post("/scan/import-drug")
def import_drug_as_asset(
    payload: schemas.ImportDrugRequest,
    db: Session = Depends(get_db),
):
    """Import a real drug from OpenTargets search into the asset portfolio so it
    can be used with multi-disease scan and the full pipeline."""
    # Check if already imported (by chembl_id in asset_code or internal_name match)
    existing = crud.get_asset_by_code(db, payload.chembl_id)
    if existing:
        return {"asset": schemas.AssetResponse.model_validate(existing), "created": False}

    # Also check by name
    from sqlalchemy import select
    from backend.app.models import CompanyAsset

    stmt = select(CompanyAsset).where(
        CompanyAsset.internal_name.ilike(payload.drug_name)
    )
    by_name = db.scalar(stmt)
    if by_name:
        return {"asset": schemas.AssetResponse.model_validate(by_name), "created": False}

    # Create a new asset from the real drug
    asset_create = schemas.AssetCreate(
        asset_code=payload.chembl_id,
        internal_name=payload.drug_name.title(),
        original_indication=payload.description[:200] if payload.description else "Imported from OpenTargets",
        portfolio_status="imported",
        phase=payload.max_phase or None,
    )
    asset = crud.create_asset(db, asset_create)
    return {"asset": schemas.AssetResponse.model_validate(asset), "created": True}


@router.get("/scan/drug-context")
def get_drug_context(drug_name: str, disease: str = ""):
    """Preview the real-time context that would be built for a drug/disease pair."""
    if not drug_name:
        raise HTTPException(status_code=400, detail="drug_name is required")
    source_disease = disease or "general"
    ctx = fetch_full_context(drug_name, source_disease)
    return {
        "drug_name": drug_name,
        "source_disease": source_disease,
        "context": ctx,
    }


# ───────────────────────── Disease Watchlist ─────────────────────────


@router.post(
    "/watchlist",
    response_model=schemas.WatchlistResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def create_watchlist(
    payload: schemas.WatchlistCreateRequest,
    db: Session = Depends(get_db),
):
    """Create a disease watchlist and start scanning all drugs in the background."""
    wl = crud.create_watchlist(db, payload.disease_query)
    start_watchlist_scan(wl.id, payload.disease_query)
    return wl


@router.get("/watchlist", response_model=schemas.WatchlistListResponse)
def list_watchlists(db: Session = Depends(get_db)):
    """List all watchlists with their alerts."""
    items = crud.list_watchlists(db)
    active_count = sum(1 for w in items if w.status == "active")
    total_alerts = sum(len(w.alerts) for w in items)
    return schemas.WatchlistListResponse(
        items=[schemas.WatchlistResponse.model_validate(w) for w in items],
        active_count=active_count,
        total_alerts=total_alerts,
    )


@router.get("/watchlist/{watchlist_id}", response_model=schemas.WatchlistResponse)
def get_watchlist(watchlist_id: UUID, db: Session = Depends(get_db)):
    """Get a single watchlist with its alerts."""
    wl = crud.get_watchlist(db, watchlist_id)
    if wl is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Watchlist not found.")
    return wl


@router.get("/alerts", response_model=list[schemas.WatchlistAlertResponse])
def list_active_alerts(db: Session = Depends(get_db)):
    """List all undismissed alerts, sorted by confidence (highest first)."""
    return crud.list_active_alerts(db)


@router.post("/alerts/{alert_id}/dismiss", response_model=schemas.WatchlistAlertResponse)
def dismiss_alert(alert_id: UUID, db: Session = Depends(get_db)):
    """Dismiss an alert."""
    alert = crud.dismiss_alert(db, alert_id)
    if alert is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found.")
    return alert
