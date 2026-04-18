# Lazarus

Lazarus is a multi-agent clinical asset repurposing platform. It takes a shelved drug asset, runs a staged reasoning workflow, visualizes the resulting graph and agent trace, and generates an executive blueprint PDF. The repo also includes optional OpenClaw and Spectrum/iMessage access layers.

## What’s In The Repo

- `backend/`
  FastAPI backend, Postgres-backed run storage, graph/tracing APIs, blueprint generation, and agent orchestration.
- `frontend/`
  React + D3 + Tailwind dashboard for live reasoning, graph exploration, and blueprint preview.
- `openclaw/`
  Optional OpenClaw and local Spectrum/iMessage bridge helpers.
- `artifacts/`
  Generated local outputs. Ignored from Git.

## Core Workflow

```text
Advocate -> Skeptic -> Evidence Curator -> Judge -> Trial Strategist
```

The backend also includes:

- async run and blueprint jobs
- real-time run streaming
- iterative reasoning / disagreement scoring
- parallel evidence branches
- short-term and long-term memory records
- optional human-in-the-loop review queue

## Quick Start

### 1. Copy environment config

```bash
cp .env.example .env
```

Fill in the keys you actually use.

### 2. Start Postgres

```bash
docker compose up -d
```

### 3. Backend

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -m backend.app.seed
uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

### 5. Optional local Spectrum/iMessage bridge

```bash
cd openclaw
npm install
npm run spectrum:local
```

## Deployment Notes

- `.env` is ignored. Use `.env.example` as the committed template.
- `artifacts/`, virtualenvs, `node_modules/`, and local generated PDFs are ignored.
- Before publishing, rotate any secrets that have ever been pasted into terminal logs, screenshots, or chat.

## Helpful Endpoints

- `GET /`
- `GET /assets`
- `POST /run-analysis`
- `POST /run-analysis/async`
- `GET /runs/{run_id}/trace`
- `GET /runs/{run_id}/stream`
- `POST /generate-blueprint`
- `POST /generate-blueprint/async`
- `GET /spectrum/health`
- `POST /spectrum/webhook`

## Frontend Build Check

```bash
cd frontend
npm run build
```

## OpenClaw / Spectrum Notes

- `openclaw/.env.example` contains the local bridge-specific environment template.
- If you only want the main product on GitHub, you can keep the optional messaging integrations unconfigured.
