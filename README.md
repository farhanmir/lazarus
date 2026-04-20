<div align="center">

<img src="logo.png" alt="Lazarus" width="160" />

# Lazarus

### Autonomous Clinical R&D Swarm for Rescuing Failed Drug Programs

*A live multi-agent control plane that discovers shelved clinical assets, reasons over them with a structured swarm of LLM agents, and emits executive-ready repurposing blueprints.*

<p>
  <img alt="FastAPI"    src="https://img.shields.io/badge/FastAPI-0.136-009688?logo=fastapi&logoColor=white" />
  <img alt="React"      src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black" />
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql&logoColor=white" />
  <img alt="Neo4j"      src="https://img.shields.io/badge/Neo4j-5-008CC1?logo=neo4j&logoColor=white" />
  <img alt="Redis"      src="https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white" />
  <img alt="Python"     src="https://img.shields.io/badge/Python-3.13-3776AB?logo=python&logoColor=white" />
  <img alt="Vite"       src="https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white" />
  <img alt="License"    src="https://img.shields.io/badge/status-research%20preview-black" />
  <img alt="HackPrinceton Spring 2026" src="https://img.shields.io/badge/HackPrinceton-Winner-gold?logo=powerpoint&logoColor=white" />
</p>

<sub>🏆 Winner: <b>Best Use of AI & Tech for Clinical Trials</b> @ HackPrinceton Spring 2026</sub>

</div>

---

## 🧬 Overview

Lazarus is a full-stack research platform that tackles a trillion-dollar problem in pharma: **most drug programs fail — but the molecules themselves are rarely the real reason**. Assets get shelved because of business pivots, portfolio cuts, adverse events in the *wrong* indication, or regulatory timing. Somewhere inside every large biopharma is a graveyard of viable chemistry waiting for the right disease.

Lazarus turns that graveyard into a live, searchable, rank-ordered R&D opportunity surface. It:

1. **Discovers** candidate assets from public clinical sources (ClinicalTrials.gov, PubMed, openFDA).
2. **Reasons** over each asset with a multi-agent swarm — an **Advocate**, a **Skeptic**, an **Evidence Curator**, an **Impact/Effort** pair, a **Trial Strategist**, and a final **Judge** — streamed live to the UI over WebSocket.
3. **Ranks** the portfolio across confidence, commercial impact, execution effort, and human-review drag.
4. **Produces** an executive-grade PDF *blueprint* (Jinja + WeasyPrint) for the winning hypothesis.
5. **Notifies** stakeholders over optional iMessage/Spectrum channels, and can be driven end-to-end from a conversational OpenClaw agent.

It is architected as a **live control plane**, not a notebook — async Postgres-backed runs, a streaming trace model, a graph-backed knowledge layer in Neo4j, HITL review queues, watchlists, multi-disease scans, and a dual UI (operator dashboard + reasoning lab).

---

## ✨ Highlights

| | |
|---|---|
| 🧠 **Multi-agent reasoning pipeline** | Nine specialized agents spanning OpenAI GPT-4o, Google Gemini, and MBZUAI K2-Think, coordinated by an explicit orchestration service with structured JSON outputs and deterministic fallbacks. |
| 📡 **Streaming runs, not one-shots** | Each run is persisted as `agent_runs` + `agent_steps` and streamed to the client via WebSocket (`/runs/{id}/stream`) with polling fallback, so the UI watches agents think in real time. |
| 🕸️ **Dual store — SQL + Graph** | Postgres holds operational truth (runs, hypotheses, blueprints, reviews). Neo4j holds the biological knowledge graph (Drug ↔ Target ↔ Disease ↔ Evidence ↔ Hypothesis ↔ Strategy). |
| 📄 **Executive blueprint generator** | Jinja + WeasyPrint produce a downloadable PDF dossier with exec + technical summaries, citations, and effort/impact economics. |
| 👩‍⚖️ **Human-in-the-loop by design** | Low-confidence or high-disagreement hypotheses automatically raise `HumanReview` records and flow into a review dashboard before blueprinting. |
| 📱 **Agentic surfaces** | Optional **Photon/Spectrum** bridge (iMessage) and **OpenClaw** skill pack let operators drive Lazarus from chat or desktop automation. |
| 🧪 **Offline demo mode** | `LAZARUS_DISCOVERY_DEMO_CACHE=true` serves a canned ClinicalTrials.gov-shaped payload so live demos never depend on venue Wi-Fi. |
| 🎨 **Premium frontend** | React 18 + Vite + Cytoscape + Three.js globe, with Framer Motion transitions and a terminal-grade operator aesthetic. |

---

## 🧱 Tech Stack

| Layer | Stack |
|---|---|
| **Backend** | FastAPI · Starlette · Pydantic v2 · SQLAlchemy 2 · Uvicorn · Jinja2 · WeasyPrint · ReportLab · httpx · `websockets` |
| **Data** | PostgreSQL 16 (operational store) · Neo4j 5 (knowledge graph) · Redis 7 (queues / cache) |
| **LLM providers** | OpenAI (`gpt-4o`, `gpt-4o-mini`) · Google Gemini (`gemini-2.5-flash`) · MBZUAI K2-Think v2 · Anthropic (optional) |
| **External APIs** | ClinicalTrials.gov · PubMed E-Utils · openFDA · Photon/Spectrum · BlueBubbles (iMessage fallback) |
| **Frontend** | React 18 · Vite 7 · React Router 7 · Framer Motion · Tailwind 3 · Cytoscape + `cytoscape-cola` · Three.js / R3F / drei · D3 · GSAP |
| **Agent surface** | OpenClaw skill pack · Photon iMessage Kit · local Spectrum bridge (`tsx`) |
| **DevOps** | Docker Compose (Postgres + Neo4j + Redis) · Render (backend) · Vercel (frontend) |

---

## 🏗️ Architecture

```mermaid
flowchart LR
    subgraph Clients["Operator Surfaces"]
        UI["React Dashboard<br/>(Rescue · Graph · Analysis · Ops · Blueprint)"]
        LAB["/agent-trace reasoning lab/"]
        IM["iMessage / Spectrum<br/>(Photon bridge)"]
        OC["OpenClaw skill pack<br/>(desktop agent)"]
    end

    subgraph API["FastAPI · backend.app.main"]
        R1["rescue_pipeline"]
        R2["discovery · scan"]
        R3["runs · hypotheses"]
        R4["blueprints"]
        R5["portfolio · reviews"]
        R6["graph · strategy · memories"]
        R7["photon · spectrum · openclaw"]
    end

    subgraph Reason["Reasoning Engine"]
        ORCH["reasoning_service<br/>orchestrator"]
        A1["Advocate<br/>(GPT-4o)"]
        A2["Skeptic<br/>(GPT-4o-mini)"]
        A3["Evidence Curator<br/>(Gemini)"]
        A4["Parallel Evidence<br/>branches"]
        A5["Trial Strategist<br/>(K2-Think)"]
        A6["Effort + Impact<br/>estimators"]
        A7["Judge"]
    end

    subgraph Ext["External Sources"]
        CT["ClinicalTrials.gov"]
        PM["PubMed"]
        FDA["openFDA"]
    end

    subgraph Store["Persistence"]
        PG[("PostgreSQL<br/>runs · steps · hypotheses<br/>blueprints · reviews")]
        NEO[("Neo4j<br/>Drug / Target / Disease<br/>Evidence / Hypothesis")]
        RD[("Redis<br/>queue · cache")]
        PDF["PDF artifacts<br/>WeasyPrint + Jinja"]
    end

    UI  -- REST + WS --> API
    LAB -- REST + WS --> API
    IM  -- webhook    --> API
    OC  -- token API  --> API

    API --> ORCH
    ORCH --> A1 --> A2 --> A3
    A3 --> A4
    A4 --> A5 --> A6 --> A7

    API --> CT & PM & FDA
    ORCH --> PG
    ORCH --> NEO
    API --> RD
    API --> PDF
```

### End-to-end request flow

```mermaid
sequenceDiagram
    autonumber
    participant U as Operator UI
    participant API as FastAPI
    participant ORCH as reasoning_service
    participant LLM as LLM providers<br/>(OpenAI · Gemini · K2)
    participant EXT as Clinical APIs<br/>(CT.gov · PubMed · FDA)
    participant DB as Postgres
    participant WS as WebSocket

    U->>API: POST /api/evaluate (asset_id)
    API->>DB: create AgentRun (status=running)
    API-->>U: run_id
    U->>WS: subscribe /runs/{id}/stream
    ORCH->>EXT: fetch context (trials, pubs, adverse events)
    ORCH->>LLM: Advocate → Skeptic → Curator → Judge
    loop per agent step
        ORCH->>DB: persist AgentStep (score, citations)
        ORCH-->>WS: push trace frame
    end
    ORCH->>DB: write Hypothesis + HITL flag
    U->>API: POST /generate-blueprint
    API->>API: render Jinja → WeasyPrint PDF
    API->>DB: store Blueprint artifact
    API-->>U: signed download URL
```

---

## 🧠 The Agent Swarm

The reasoning pipeline is not a single "LLM call" — it is an explicit, auditable DAG of specialized agents. Each step writes an `AgentStep` row with a score, input/output summaries, and citations, which is what the UI renders live.

| Agent | Role | Default provider |
|---|---|---|
| **Advocate** | Proposes the best repurposed indication with a confidence score. | OpenAI `gpt-4o` |
| **Skeptic** | Red-teams the proposal: mechanistic conflicts, hallucinated citations (PubMed cross-check), safety pressure tests. | OpenAI `gpt-4o-mini` |
| **Evidence Curator** | Structures supporting + contradicting literature into a citable evidence set. | Gemini `2.5-flash` |
| **Parallel Evidence Branches** | Explores multiple mechanistic rationales concurrently and merges the strongest into context. | Gemini / K2 |
| **Trial Strategist** | Designs a pragmatic phase plan, endpoints, and priority level. | MBZUAI K2-Think v2 |
| **Effort Estimator** | Estimates $, months, and trial complexity. | Deterministic + LLM assist |
| **Impact Predictor** | Estimates patient population, breakthrough score, commercial band. | Deterministic + LLM assist |
| **Judge** | Synthesizes a single `final_confidence` and `final_recommendation`. | OpenAI `gpt-4o` |
| **Follow-up Assistant** | Answers operator questions grounded in the run trace and graph context. | OpenAI |

Every agent has a **deterministic fallback** so the pipeline continues to produce a coherent trace even when an API key is absent — critical for offline demos and CI.

---

## 📦 Repository Structure

```
lazarus/
├─ backend/
│  ├─ app/
│  │  ├─ main.py                 # FastAPI entrypoint · router mounting · CORS
│  │  ├─ models.py               # SQLAlchemy models (runs, steps, hypotheses, blueprints…)
│  │  ├─ schemas.py              # Pydantic response / request contracts
│  │  ├─ db.py                   # engine, SessionLocal, runtime migrations
│  │  ├─ crud.py                 # persistence helpers
│  │  ├─ seed.py                 # demo portfolio bootstrap
│  │  ├─ agents/                 # advocate · skeptic · curator · judge · effort · impact · follow-up
│  │  ├─ api/                    # rescue_pipeline · discovery · runs · blueprints · portfolio …
│  │  ├─ services/               # reasoning · blueprint · discovery · graph · photon · spectrum …
│  │  └─ templates/              # Jinja + CSS for blueprint PDF
│  └─ graph/                     # Neo4j schema, seed data, Cypher queries
├─ frontend/
│  ├─ src/
│  │  ├─ App.jsx                 # operator dashboard shell (8 tabs + streaming run state)
│  │  ├─ pages/                  # Landing · AgentTrace (reasoning lab)
│  │  ├─ components/             # Cytoscape graph, globe, panels, gauges, messaging
│  │  ├─ hooks/                  # useGraphData · useRunStatus
│  │  └─ services/api.js         # REST + WebSocket client
│  └─ vite.config.js             # dev proxy → :8000
├─ openclaw/                     # OpenClaw skill pack + local Spectrum/iMessage bridge
├─ docs/                         # strategy, schema, implementation notes
├─ docker-compose.yml            # postgres + neo4j + redis
├─ render.yaml                   # backend deployment config
└─ requirements.txt
```

---

## 🗃️ Data Model

The operational store is a compact, hackathon-friendly schema that still enforces real relationships.

```mermaid
erDiagram
    CompanyAsset ||--o{ AgentRun       : "runs"
    CompanyAsset ||--o{ Hypothesis     : "hypotheses"
    CompanyAsset ||--o{ AssetMemory    : "memories"
    CompanyAsset ||--o{ HumanReview    : "reviews"
    AgentRun     ||--o{ AgentStep      : "trace"
    AgentRun     ||--o{ Hypothesis     : "produces"
    AgentRun     ||--o{ RunMemory      : "short-term"
    Hypothesis   ||--o{ Blueprint      : "dossiers"
    Hypothesis   ||--o{ EffortAnalysis : "costs"
    Hypothesis   ||--o{ ImpactAnalysis : "value"
    Blueprint    ||--o{ Notification   : "deliveries"
    DiseaseWatchlist ||--o{ WatchlistAlert : "fires"
```

Key tables: `company_assets`, `agent_runs`, `agent_steps`, `hypotheses`, `blueprints`, `notifications`, `run_memories`, `asset_memories`, `human_reviews`, `effort_analyses`, `impact_analyses`, `messages`, `disease_watchlists`, `watchlist_alerts`. Runtime migrations are applied in `db.apply_runtime_migrations()` on app startup.

The **Neo4j** side models `Drug`, `Target`, `Disease`, `Evidence`, `Hypothesis`, and `Strategy` nodes — the UI exposes this through the Cytoscape graph tab.

---

## 🔌 HTTP API (selected)

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/` | Liveness |
| `GET`  | `/assets` · `/assets/{id}/patient-data` | Portfolio assets |
| `GET`  | `/api/candidates` | Ranked rescue candidates (disease query) |
| `POST` | `/api/evaluate` · `/run-analysis` · `/run-analysis/async` | Kick off a reasoning run |
| `GET`  | `/runs/{id}` · `/runs/{id}/trace` | Poll run state + agent trace |
| `WS`   | `/runs/{id}/stream` | Live-stream reasoning trace frames |
| `POST` | `/generate-blueprint` · `/generate-blueprint/async` | Generate PDF dossier |
| `GET`  | `/blueprints/{id}` · `/blueprints/{id}/detail` · download | Retrieve dossier |
| `GET`  | `/portfolio/ranking` | Confidence × impact × effort × HITL drag |
| `GET`  | `/human-reviews/dashboard` | HITL escalation queue |
| `GET`  | `/assets/{id}/hypotheses/compare` | Multi-hypothesis comparison |
| `GET/POST` | `/photon/*` · `/spectrum/*` | Messaging bridge (iMessage) |
| *varies* | `/openclaw/*` | Token-gated endpoints for OpenClaw agents |

---

## 🚀 Quick Start

### 1 · Clone & configure

```bash
git clone https://github.com/your-org/lazarus.git
cd lazarus
cp .env.example .env   # fill in DATABASE_URL, OPENAI_API_KEY, GEMINI_API_KEY, K2_API_KEY…
```

### 2 · Boot infra (Postgres · Neo4j · Redis)

```bash
docker compose up -d
```

### 3 · Backend

```bash
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python -m backend.app.seed                                # seed demo portfolio
uvicorn backend.app.main:app --reload --port 8000
```

### 4 · Frontend

```bash
cd frontend
npm install
npm run dev                                               # Vite dev server @ :5173 (proxies /api → :8000)
```

### 5 · (Optional) local Spectrum / iMessage bridge

```bash
cd openclaw
npm install
npm run spectrum:local                                    # exposes the iMessage bridge on :8765
```

Set the Spectrum webhook to `${LAZARUS_BASE_URL}/photon/spectrum/webhook`.

---

## ⚙️ Configuration

Most knobs are environment-driven. The most important ones:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres DSN (e.g. `postgresql+psycopg2://postgres:postgres@127.0.0.1:55432/lazarus_db`) |
| `NEO4J_URI` · `NEO4J_USERNAME` · `NEO4J_PASSWORD` | Neo4j connection (local Docker or Aura) |
| `REDIS_URL` | Redis connection string |
| `OPENAI_API_KEY` + `OPENAI_ADVOCATE_MODEL` / `OPENAI_JUDGE_MODEL` / `OPENAI_SKEPTIC_MODEL` | OpenAI agent routing |
| `GEMINI_API_KEY` · `RESCUE_GEMINI_MODEL` | Gemini-backed evidence + rescue pipeline |
| `K2_API_KEY` · `K2_API_BASE_URL` · `K2_MODEL` | MBZUAI K2-Think v2 reasoning |
| `SPECTRUM_PROJECT_ID` · `SPECTRUM_SECRET_KEY` · `SPECTRUM_BASE_URL` · `SPECTRUM_RECIPIENT` | Photon/Spectrum iMessage bridge |
| `BLUEBUBBLES_SERVER_URL` · `BLUEBUBBLES_PASSWORD` · `BLUEBUBBLES_CHAT_GUID` | Fallback iMessage provider |
| `OPENCLAW_HOME` · `OPENCLAW_SHARED_TOKEN` | OpenClaw skill pack wiring |
| `LAZARUS_DISCOVERY_DEMO_CACHE` | `true` ⇒ serve canned CT.gov payload (offline demo) |
| `CORS_ORIGINS` | Comma-separated origin allowlist for the deployed frontend |

---

## 🧪 Quality & Reliability

- **Deterministic fallbacks** on every LLM agent ensure the pipeline always produces a coherent trace, even with missing API keys.
- **PubMed citation cross-check** in the Skeptic catches hallucinated references before they reach the Judge.
- **HITL gate** — low-confidence / high-disagreement hypotheses write `HumanReview` rows and are blocked from downstream blueprinting until resolved.
- **Runtime migrations** — schema drift is applied on startup via `apply_runtime_migrations()` so deploys stay idempotent.
- **CORS allowlist** is environment-driven, with safe local defaults.
- **Demo-cache mode** (`LAZARUS_DISCOVERY_DEMO_CACHE=true`) removes the only non-deterministic external dependency during live demos.

---

## 🌐 Deployment

A minimal zero-to-prod path is included:

- **Backend →** [Render](https://render.com) via [`render.yaml`](render.yaml): `pip install -r requirements.txt` → `uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT`.
- **Frontend →** [Vercel](https://vercel.com) via [`frontend/vercel.json`](frontend/vercel.json) — a standard Vite build (`npm run build`) with an env-injected `VITE_API_BASE_URL` pointing at the Render service.
- **Datastores →** swap the Docker Postgres/Neo4j for managed equivalents (Neon / Supabase / Aura) by updating `DATABASE_URL` and `NEO4J_URI`.

---

## 🧭 Design Decisions & Tradeoffs

- **Two stores, on purpose.** Postgres is the source of truth for *operational* state (runs, steps, reviews, blueprints) where ACID matters. Neo4j is reserved for the *knowledge graph* where traversal is the primary access pattern. Trying to push either store into the other's job is a known failure mode for this kind of system.
- **Explicit orchestration > ReAct.** The reasoning service wires agents as a typed DAG with Pydantic contracts instead of a free-form ReAct loop. This costs some flexibility but buys reliable, auditable traces — which is the actual product.
- **Streaming as a first-class feature.** Every agent step is persisted *and* pushed to the client. The UI doesn't guess what the pipeline is doing; it renders what actually happened.
- **Provider pluralism.** Advocate / Judge are optimized for reasoning (GPT-4o), Skeptic is cost-optimized (gpt-4o-mini), Evidence is cheap-and-fast (Gemini Flash), Trial Strategy leans on K2-Think. Each role uses the model best suited to it, not a monoculture.
- **Deterministic fallbacks everywhere.** An API outage during a live demo should degrade, not crash. This is enforced at the agent layer, not bolted on at the edge.

---

## 🗺️ Roadmap Opportunities

- Backfill **Redis-backed Celery / RQ workers** for long-running async runs (currently threaded).
- First-class **auth** (currently hackathon-mode; OpenClaw endpoints are shared-token gated).
- **Vector memory** for `AssetMemory` / `RunMemory` to enable cross-run retrieval.
- **Formal evals** for each agent (hallucination rate, citation grounding, skeptic precision).
- **Graph-native ranking** using Neo4j GDS for portfolio-scale similarity search.
- **Multi-tenant** portfolios with row-level security.

---

## 🧾 Docs & Further Reading

- [Product requirements (PRD)](docs/PRD.md) — what Lazarus is, who it serves, scope in/out
- [User stories](docs/USER_STORIES.md) — the operator, reviewer, and executive journeys
- [Architecture](docs/ARCHITECTURE.md) — data model, agent DAG, graph schema, runtime
- [Issue tracker](docs/ISSUES.md) — known limitations, hackathon cut-lines, roadmap
- Sub-READMEs: [`backend/app/README.md`](backend/app/README.md) · [`backend/app/README_OPENCLAW.md`](backend/app/README_OPENCLAW.md) · [`backend/app/README_PHOTON.md`](backend/app/README_PHOTON.md) · [`backend/app/README_SPECTRUM.md`](backend/app/README_SPECTRUM.md) · [`backend/graph/README.md`](backend/graph/README.md) · [`openclaw/README.md`](openclaw/README.md)

---

## 👥 Team — HackPrinceton Spring 2026

Built in 36 hours by:

| | Name | Links |
|---|---|---|
| 🧬 | **Dimural Murat** | [GitHub](https://github.com/Dimural) · [LinkedIn](https://linkedin.com/in/dimural) |
| 🧠 | **Nikhil Juluri** | [GitHub](https://github.com/DoSomethingGreat07) · [LinkedIn](https://linkedin.com/in/nikhil-juluri-001a98178) |
| ⚗️ | **Fayzan Malik** | [GitHub](https://github.com/fayzan123) · [LinkedIn](https://linkedin.com/in/fayzan-malik) |
| 🚀 | **Farhan Mir** | [GitHub](https://github.com/farhanmir) · [LinkedIn](https://linkedin.com/in/farhan-mir) |

---

<div align="center">

**Lazarus — giving shelved science a second life.**

<sub>FastAPI · Postgres · Neo4j · React · OpenAI · Gemini · K2-Think · Photon · OpenClaw</sub>

</div>

</div>
