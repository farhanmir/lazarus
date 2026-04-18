"""Run routes."""

from __future__ import annotations

import asyncio
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from sqlalchemy.orm import Session

from backend.app import crud, schemas
from backend.app.db import SessionLocal, get_db
from backend.app.services.reasoning_service import (
    create_analysis_run,
    run_reasoning_pipeline,
    start_analysis_run,
)

router = APIRouter(tags=["runs"])


def _build_run_trace_payload(db: Session, run_id: UUID) -> schemas.RunTraceResponse | None:
    run = crud.get_run(db, run_id)
    if run is None:
        return None

    asset = crud.get_asset(db, run.asset_id)
    hypothesis = next(iter(run.hypotheses), None) if getattr(run, "hypotheses", None) else None
    return schemas.RunTraceResponse(
        run=schemas.RunResponse.model_validate(run),
        asset_code=asset.asset_code if asset is not None else "unknown",
        hypothesis=(
            schemas.HypothesisResponse.model_validate(hypothesis)
            if hypothesis is not None
            else None
        ),
        steps=[schemas.StepResponse.model_validate(step) for step in run.steps],
    )


@router.post("/run-analysis", response_model=schemas.RunAnalysisResponse, status_code=status.HTTP_201_CREATED)
def run_analysis(payload: schemas.RunCreate, db: Session = Depends(get_db)):
    try:
        return run_reasoning_pipeline(db, payload.asset_id, payload.run_type)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/run-analysis/async", response_model=schemas.AnalysisJobResponse, status_code=status.HTTP_202_ACCEPTED)
def run_analysis_async(payload: schemas.RunCreate, db: Session = Depends(get_db)):
    try:
        run = create_analysis_run(db, payload.asset_id, payload.run_type)
        asset = crud.get_asset(db, payload.asset_id)
        start_analysis_run(run.id)
        return schemas.AnalysisJobResponse(
            run=run,
            asset_code=asset.asset_code if asset is not None else "unknown",
            status_url=f"/runs/{run.id}",
            trace_url=f"/runs/{run.id}/trace",
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/runs", response_model=list[schemas.RunResponse])
def list_runs(db: Session = Depends(get_db)):
    return crud.list_runs(db)


@router.get("/runs/{run_id}", response_model=schemas.RunDetailResponse)
def get_run(run_id: UUID, db: Session = Depends(get_db)):
    run = crud.get_run(db, run_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found.")
    return run


@router.get("/runs/{run_id}/trace", response_model=schemas.RunTraceResponse)
def get_run_trace(run_id: UUID, db: Session = Depends(get_db)):
    payload = _build_run_trace_payload(db, run_id)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found.")
    return payload


@router.websocket("/runs/{run_id}/stream")
async def stream_run_trace(websocket: WebSocket, run_id: UUID):
    await websocket.accept()
    try:
        while True:
            with SessionLocal() as db:
                payload = _build_run_trace_payload(db, run_id)
                if payload is None:
                    await websocket.send_json({"error": "Run not found."})
                    await websocket.close(code=4404)
                    return

                await websocket.send_json(payload.model_dump(mode="json"))
                if payload.run.status in {"completed", "failed"}:
                    await websocket.close()
                    return

            await asyncio.sleep(0.8)
    except WebSocketDisconnect:
        return
