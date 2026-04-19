# Lazarus: Autonomous Clinical R&D Swarm

Lazarus is an AI-powered drug repurposing platform for shelved or underused pharma assets. It runs a multi-agent reasoning pipeline over an asset, proposes a new indication, stress-tests the idea, gathers supporting evidence, estimates effort and impact, and generates an executive-ready blueprint.

## Quick Links
- **[Project Strategy & Vision](docs/Lazarus_Nexus_Strategy.md):** Deep dive into the Lazarus architecture, swarm logic, and the "Bio-Nexus" demo strategy.
- **[Implementation Plan](docs/2026-04-17-lazarus-implementation.md):** The phased roadmap.
- **[HackPrinceton 2026 Guide](docs/HackPrinceton_2026_Guide.md):** Reference for official event tracks, prizes, and sponsor requirements.

## What’s In The Repo

- `backend/`
  FastAPI backend, Postgres-backed run storage, graph/tracing APIs, blueprint generation, portfolio ranking, HITL review queue, and agent orchestration.
- `frontend/`
  React + Cytoscape.js + Tailwind dashboard for live reasoning, graph exploration, portfolio ranking, comparison workflows, messaging, and blueprint preview.
- `openclaw/`
  Optional OpenClaw and local Spectrum/iMessage bridge helpers.
- `docs/`
  Hackathon architecture, team contracts, and strategy documents.
- `artifacts/`
  Generated local outputs. Ignored from Git.

## HackPrinceton Prize Tracks

- 🏆 **Best Business and Enterprise / Overall Hack:** Deterministic, category-defining **Sovereign R&D Participant**.
- 🧪 **Regeneron ($1,000):** Strict biological rigor. Graph nodes must cite real PubMed IDs (PMIDs).
- ✨ **Best Use of Gemini API (MLH):** **The Defibrillator** ingests 500-page FDA briefings into the 2M window.
- 🧠 **Best Use of K2 Think V2:** **The Coroner** exposes a precise 10-step biological "Thinking Trace".
- ⚙️ **Eragon:** An **Internal R&D Sovereign** that governs internal pipelines.
- 🐳 **Dedalus ($500):** A **Natively Distributed Agent Swarm** where each reasoning agent runs on its own independent, stateful Linux VM, coordinated via a centralized FastAPI Control Plane.
- 💬 **Photon ($700):** **Interactive iMessage group-chat** where the agent defends P-Values natively.

## Quick Start

### 1. Copy environment config

```bash
cp .env.example .env
```

Fill in the keys you actually use.

### 2. Start Services

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

## Helpful Endpoints

- `GET /`
- `GET /assets`
- `POST /run-analysis`
- `POST /run-analysis/async`
- `GET /runs/{run_id}/trace`
- `GET /runs/{run_id}/stream`
- `GET /portfolio/ranking`
- `GET /human-reviews/dashboard`
- `GET /assets/{asset_id}/hypotheses/compare`
- `POST /generate-blueprint`
- `POST /generate-blueprint/async`
- `GET /spectrum/health`
- `POST /spectrum/webhook`

## Product Surfaces

- **Live multi-agent dashboard**
  Watch Advocate, Skeptic, Curator, Judge, and Trial Strategist reason over a drug asset in real time.
- **Interactive graph**
  Explore Drug, Target, Disease, Evidence, Hypothesis, and Strategy nodes with Cytoscape-based graph controls.
- **Portfolio ranking**
  Rank assets by confidence, impact, effort, risk, and HITL drag.
- **Human review dashboard**
  Review and resolve safety-board or portfolio-committee escalations.
- **Hypothesis comparison**
  Compare competing indications for the same asset across confidence, coverage, disagreement, and readiness.
- **Blueprint generation**
  Generate an executive-ready PDF dossier for the selected hypothesis.

## GitHub Deployment Checklist

Before you push this repository publicly:

1. Rotate any secrets that were ever stored locally or pasted into shells/chat history.
2. Make sure `.env` is not tracked.
3. Verify the repo builds cleanly:
   - `python3 -m compileall backend/app`
   - `cd frontend && npm run build`
4. Review `git status` for any local-only files you do not want in the repo.
5. Commit from the project root and push to your target GitHub remote.

Example:

```bash
git add .
git commit -m "Prepare Lazarus for GitHub deployment"
git push -u origin main
```

---
*Developed for HackPrinceton Spring 2026.*
