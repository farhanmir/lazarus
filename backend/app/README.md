# Lazarus Step 2 Backend

This module is the PostgreSQL operational truth ledger plus the Step 3 multi-agent reasoning layer for Lazarus. It stores company assets, analysis runs, agent step logs, hypotheses, blueprints, and notifications, and exposes a minimal FastAPI API for a hackathon demo.

## Recommended local flow

Use Docker for Postgres so local auth stays predictable:

```bash
docker compose up -d postgres
source venv/bin/activate
pip install -r requirements.txt
python -m backend.app.seed
uvicorn backend.app.main:app --reload
```

## Default database URL

```env
DATABASE_URL=postgresql+psycopg2://postgres:postgres@127.0.0.1:5432/lazarus_db
```

## Step 3 reasoning flow

```text
Asset -> Context Builder -> Advocate -> Skeptic -> Evidence Curator -> Judge -> Hypothesis
```

The current implementation uses deterministic fallbacks for reliability while preserving the 4-agent structure and model ownership:

- Advocate: Gemini-shaped fallback
- Skeptic: K2 Think V2-shaped fallback
- Evidence Curator: deterministic
- Judge: deterministic weighted synthesis

## Endpoints

- `GET /assets`
- `GET /assets/{asset_id}`
- `POST /assets`
- `POST /run-analysis`
- `GET /runs`
- `GET /runs/{run_id}`
- `GET /runs/{run_id}/trace`
- `GET /hypotheses`
- `GET /hypothesis/{hypothesis_id}`
- `POST /generate-blueprint`
- `GET /blueprints/{blueprint_id}`
