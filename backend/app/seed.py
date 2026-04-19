"""Idempotent demo seed.

Bootstraps a small but realistic portfolio of shelved assets so the dashboard,
reasoning pipeline, and graph views have something to chew on out of the box.
Run via ``python -m backend.app.seed`` — safe to re-run.
"""

from __future__ import annotations

from backend.app import crud, schemas
from backend.app.db import Base, SessionLocal, engine
from backend.app.services.analysis_service import build_blueprint_for_hypothesis, run_mock_analysis

ASSET_SEEDS = [
    {
        "asset_code": "RX-782",
        "internal_name": "Rexalon",
        "original_indication": "Asthma",
        "portfolio_status": "shelved",
        "business_failure_reason": "poor_enrollment",
        "phase": "Phase 2",
        "owner_company": "Northstar Bio",
    },
    {
        "asset_code": "RX-901",
        "internal_name": "MigraNil",
        "original_indication": "Migraine",
        "portfolio_status": "archived",
        "business_failure_reason": "funding_cut",
        "phase": "Phase 1",
        "owner_company": "HelixForge Therapeutics",
    },
    {
        "asset_code": "RX-455",
        "internal_name": "Dermava",
        "original_indication": "Psoriasis",
        "portfolio_status": "shelved",
        "business_failure_reason": "strategic_pivot",
        "phase": "Phase 2",
        "owner_company": "BlueHarbor Pharma",
    },
    {
        "asset_code": "RX-222",
        "internal_name": "Pulmora",
        "original_indication": "COPD",
        "portfolio_status": "shelved",
        "business_failure_reason": "poor_enrollment",
        "phase": "Phase 2",
        "owner_company": "Asterion Oncology",
    },
]


def seed_assets() -> dict[str, str]:
    asset_ids: dict[str, str] = {}
    with SessionLocal() as db:
        for item in ASSET_SEEDS:
            asset = crud.get_asset_by_code(db, item["asset_code"])
            if asset is None:
                asset = crud.create_asset(db, schemas.AssetCreate(**item))
            asset_ids[item["asset_code"]] = str(asset.id)
    return asset_ids


def seed_data() -> None:
    Base.metadata.create_all(bind=engine)
    seed_assets()

    with SessionLocal() as db:
        demo_asset = crud.get_asset_by_code(db, "RX-782")
        if demo_asset is not None and not crud.list_runs(db):
            response = run_mock_analysis(db, demo_asset.id, "demo")
            if response.hypothesis is not None and not crud.list_notifications(db):
                build_blueprint_for_hypothesis(db, response.hypothesis.id, create_notification=True)

        second_asset = crud.get_asset_by_code(db, "RX-901")
        if second_asset is not None and crud.get_asset_by_code(db, "RX-901") is not None:
            existing_manual = [run for run in crud.list_runs(db) if run.asset_id == second_asset.id and run.run_type == "manual"]
            if not existing_manual:
                run_mock_analysis(db, second_asset.id, "manual")


if __name__ == "__main__":
    seed_data()
    print("Step 3 seed complete.")
