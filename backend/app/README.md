# Lazarus Backend

FastAPI service that owns the operational ledger (Postgres), the multi-agent
reasoning pipeline, the blueprint (PDF) generator, and all external integrations
(ClinicalTrials.gov, PubMed, openFDA, Photon/Spectrum, OpenClaw).

The root [`README.md`](../../README.md) has the full architecture, data model, and
HTTP surface. This file is only a local quick-start for the backend module.

## Local run

```bash
docker compose up -d postgres neo4j redis
source venv/bin/activate
pip install -r requirements.txt
python -m backend.app.seed                 # seed the demo portfolio
uvicorn backend.app.main:app --reload --port 8000
```

## Default connection strings

```env
DATABASE_URL=postgresql+psycopg2://postgres:postgres@127.0.0.1:5432/lazarus_db
NEO4J_URI=bolt://localhost:7687
REDIS_URL=redis://localhost:6379/0
```

## Reasoning flow (summary)

```
Asset → Context Builder → Advocate → Skeptic → Parallel Evidence
     → Evidence Curator → Assessment → Judge → Trial Strategist
     → Effort + Impact → Hypothesis → (HITL gate) → Blueprint
```

Every agent has a deterministic fallback, so the pipeline produces a coherent
trace even with missing API keys. See `backend/app/agents/` for per-agent code.

## Integration sub-READMEs

- [`README_OPENCLAW.md`](README_OPENCLAW.md) — OpenClaw skill-pack bridge
- [`README_PHOTON.md`](README_PHOTON.md) — Photon/Spectrum iMessage bridge
- [`README_SPECTRUM.md`](README_SPECTRUM.md) — Spectrum webhook surface

## HTTP surface

The authoritative list of endpoints lives in the root README under
**HTTP API (selected)**. Anything under `/docs` at runtime (FastAPI's generated
OpenAPI UI) is the live source of truth.
