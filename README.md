# Lazarus: Autonomous Clinical R&D Swarm

Lazarus is an autonomous AI swarm that monitors failed clinical trials and 'resurrects' them by finding new patient sub-groups where the drug actually works. When it finds a billion-dollar match, it pings the executive's iMessage with a ready-to-sign R&D blueprint.

## Quick Links
- **[Project Strategy & Vision](docs/Lazarus_Nexus_Strategy.md):** Deep dive into the Lazarus architecture, swarm logic, and the "Bio-Nexus" demo strategy.
- **[Implementation Plan](docs/2026-04-17-lazarus-implementation.md):** The phased roadmap.
- **[HackPrinceton 2026 Guide](docs/HackPrinceton_2026_Guide.md):** Reference for official event tracks, prizes, and sponsor requirements.

## What’s In The Repo

- `backend/`
  FastAPI backend, Postgres-backed run storage, graph/tracing APIs, blueprint generation, and agent orchestration.
- `frontend/`
  React + D3 + Tailwind dashboard for live reasoning, graph exploration, and blueprint preview.
- `openclaw/`
  Optional OpenClaw and local Spectrum/iMessage bridge helpers.
- `docs/`
  Hackathon architecture, team contracts, and strategy documents.
- `artifacts/`
  Generated local outputs. Ignored from Git.

## HackPrinceton Prize Tracks

- 🏆 **Best Healthcare / Overall Hack:** Deterministic, category-defining **Sovereign R&D Participant**.
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
- `POST /generate-blueprint`
- `POST /generate-blueprint/async`
- `GET /spectrum/health`
- `POST /spectrum/webhook`

---
*Developed for HackPrinceton Spring 2026.*
