"""FastAPI entrypoint for Step 2."""

from __future__ import annotations

from contextlib import asynccontextmanager
import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.api.assets import router as assets_router
from backend.app.api.blueprints import router as blueprints_router
from backend.app.api.graph import router as graph_router
from backend.app.api.hypotheses import router as hypotheses_router
from backend.app.api.memories import router as memories_router
from backend.app.api.messages import router as messages_router
from backend.app.api.openclaw import router as openclaw_router
from backend.app.api.photon import router as photon_router
from backend.app.api.reviews import router as reviews_router
from backend.app.api.runs import router as runs_router
from backend.app.api.spectrum import router as spectrum_router
from backend.app.api.strategy import router as strategy_router
from backend.app.db import Base, apply_runtime_migrations, engine


def configure_logging() -> None:
    level_name = os.getenv("LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)
    logging.basicConfig(
        level=level,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    )


configure_logging()


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    apply_runtime_migrations()
    yield


app = FastAPI(
    title="Lazarus Backend",
    version="0.5.0",
    description="Operational truth ledger, reasoning engine, and visualization API for the Lazarus hackathon MVP.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
        "null",  # file:// origins
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(assets_router)
app.include_router(runs_router)
app.include_router(hypotheses_router)
app.include_router(blueprints_router)
app.include_router(graph_router)
app.include_router(openclaw_router)
app.include_router(spectrum_router)
app.include_router(photon_router)
app.include_router(memories_router)
app.include_router(reviews_router)
app.include_router(strategy_router)
app.include_router(messages_router)


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "Lazarus backend is running."}
