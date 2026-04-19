# Lazarus: Autonomous Clinical R&D Swarm

Lazarus surfaces **failed, terminated, or shelved clinical programs**, runs a **multi-agent reasoning pipeline** (advocate, skeptic, judge, and supporting agents) over structured context, and produces **R&D blueprint artifacts**. It adds **portfolio ranking**, **graph exploration**, **hypothesis comparison**, **human-in-the-loop review**, and optional **Spectrum / Photon** messaging.

It is built as a **live R&D control plane**: Postgres-backed runs and steps, **async evaluate + trace** (WebSocket / polling), **blueprint PDFs**, optional **Photon/Spectrum** alerts, hooks for **OpenClaw** demos, and a **dual UI** (main dashboard + lab)—so judges see an end-to-end product, not a one-off script.

---

## Quick links

- [Project strategy](docs/Lazarus_Nexus_Strategy.md)
- [Implementation roadmap (aspirational in places)](docs/2026-04-17-lazarus-implementation.md)
- [HackPrinceton guide (local copy)](docs/HackPrinceton_2026_Guide.md)
- [Team contracts (interfaces; not all wired yet)](CONTRACTS.md)

---

## What is in the repo

| Path | Role |
|------|------|
| `backend/app/` | FastAPI app, Postgres, graph APIs, blueprint generation, portfolio ranking, HITL review, agent orchestration |
| `frontend/` | Vite + React + Cytoscape: live reasoning, graph, portfolio, compare, messaging, lab routes, agent trace |
| `openclaw/` | Optional Node helpers (local Spectrum bridge and OpenClaw integration) |
| `docs/` | Architecture and hackathon notes |
| `docker-compose.yml` | Postgres, Redis, Neo4j for local development |

---

## HackPrinceton Spring 2026 — tracks (official structure)

You must submit to **exactly one** main track. You may also opt into **any number** of sponsor / special tracks (each may send judges during round 1). **Best Overall** is automatic consideration for all submissions.

### Main tracks (choose one)

| Main track | Angle for Lazarus |
|------------|-------------------|
| **Best Healthcare Hack** | Failed-trial rescue, patient-relevant repurposing, clinical rigor story |
| **Best Business and Enterprise Hack** | Sovereign R&D / portfolio analytics / executive-ready blueprint |
| **Best Sustainability Hack** | Only if you explicitly tie rescue to environmental or sustainability outcomes |
| **Best Entertainment and Media Hack** | Unlikely primary fit unless you reframe the demo |
| **Best Education Hack** | Unlikely primary fit unless you reframe the demo |

### Special tracks your team is targeting (evidence checklist)

| Sponsor / track | What judges need to see in Lazarus | Code / demo pointers |
|-----------------|-----------------------------------|------------------------|
| **Regeneron — AI & Tech for Clinical Trials** | Real trial logic, serious clinical workflow, evidence discipline | `discovery_service.py` (ClinicalTrials.gov, PubMed, openFDA heuristics), run trace + hypothesis |
| **[MLH] Best Use of Gemini API** | Non-trivial Gemini use, visible in demo | `agents/advocate.py`, `agents/judge.py`, `candidate_service.py` (Gemini structured briefs) |
| **MBZUAI — Best Use of K2 Think V2** | K2 as **core** reasoning, not a throwaway call | `agents/skeptic.py`, reasoning trace UI `/agents/:runId` |
| **Eragon — Build What Actually Runs Monday (OpenClaw)** | OpenClaw agent doing real work across tools | `openclaw/`, `api/openclaw.py` — optional path; align demo script if you enter this track |
| **Photon — Agents in iMessage (Spectrum)** | Spectrum integration, social / messaging depth | `api/photon.py`, `services/spectrum_service.py`; local bridge must call **`POST /photon/spectrum/webhook`** (not `/spectrum/webhook` unless you remount the legacy router) |
| **Best Overall Hack** | Creativity, utility, charity, avidity across rubric | End-to-end polished demo: query → candidates → run → blueprint → (optional) notify |

Prize wording on Devpost / day-of may differ slightly; always confirm the **official** sponsor PDFs and Discord.

---

## Quick start

### 1. Environment

```bash
cp .env.example .env
```

Fill keys you use (`DATABASE_URL`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `K2_API_KEY`, Spectrum vars if messaging).

**Demo Wi-Fi:** set `LAZARUS_DISCOVERY_DEMO_CACHE=true` to serve a canned ClinicalTrials.gov-shaped payload (Type 2 diabetes / Rexalon-class narrative) so discovery and rescue pipeline never block on venue network.

### 2. Dependencies (Docker)

```bash
docker compose up -d
```

### 3. Backend

```bash
python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
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

By default the dev server **proxies API calls** to `http://127.0.0.1:8000`, so you usually **do not** need `VITE_API_BASE_URL`. If you set it to a dead URL, the UI will show **Network Error** — leave it unset for local dev, or point it at a live API and ensure **CORS** includes your UI origin.

### 5. Optional: local Spectrum bridge

```bash
cd openclaw
npm install
npm run spectrum:local
```

## Helpful endpoints

- `GET /`
- `GET /assets`, `GET /assets/{id}/patient-data`
- `GET /api/candidates`, `POST /api/evaluate`
- `POST /run-analysis`, `POST /run-analysis/async`
- `GET /runs/{run_id}/trace`, WebSocket `/runs/{run_id}/stream`
- `GET /portfolio/ranking`, `GET /human-reviews/dashboard`, `GET /assets/{asset_id}/hypotheses/compare`
- `POST /generate-blueprint`, `POST /generate-blueprint/async`
- `GET /photon/health`, `POST /photon/notify`, `POST /photon/spectrum/webhook`
- `GET /spectrum/health`, `POST /spectrum/webhook` (legacy Spectrum router, if mounted)

Local Spectrum bridge: set webhook to **`{LAZARUS_BASE_URL}/photon/spectrum/webhook`** (see `openclaw/spectrum-local.ts`).

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

## HTTP API (mounted in `backend/app/main.py`)

These routes exist on the running app today:

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/` | Health |
| `GET` | `/api/candidates` | Ranked rescue candidates (`disease` query param today; optional `drug` filter planned) |
| `POST` | `/api/evaluate` | Start async evaluation run for a drug / asset |
| `POST` | `/run-analysis`, `/run-analysis/async` | Reasoning pipeline |
| `GET` | `/runs/{run_id}`, `/runs/{run_id}/trace`, `WS /runs/{run_id}/stream` | Run status and trace |
| `POST` | `/generate-blueprint`, `/generate-blueprint/async` | Blueprint generation |
| `GET` | `/blueprints/{id}`, `/blueprints/{id}/detail`, download routes | Blueprints |
| *varies* | `/openclaw/*` | Token-gated tool endpoints for OpenClaw / Eragon demos |
| `GET` | `/photon/health` | Photon / Spectrum bridge health |
| `POST` | `/photon/notify` | Manual notify via Spectrum |
| `POST` | `/photon/spectrum/webhook` | Inbound Spectrum webhook |

**Assets API:** `GET /assets`, `POST /assets`, etc. live in [`backend/app/api/assets.py`](backend/app/api/assets.py) and are mounted from `main.py` for the dashboard.

Other modules under `backend/app/api/` (`graph`, `hypotheses`, `spectrum`, …) are **not** mounted until explicitly wired.

---

## Demo narrative (2 minutes)

1. **Query** — disease rescue from `/` (rescue home) or shelved-asset work from `/dashboard`.
2. **Discovery** — ranked failed-trial / shelved-asset candidates (`/api/candidates`).
3. **Reasoning** — async evaluate → live trace (Gemini + K2 + judge visible in UI).
4. **Blueprint** — generate and show download path.
5. **Optional Photon** — only if Spectrum env and bridge are configured; otherwise skip and say “production would notify here.”

---

*HackPrinceton Spring 2026.*
