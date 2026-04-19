# Lazarus — Architecture

*Last updated: 2026-04-19*

This document is the deep dive that complements the high-level architecture
section in the root [`README.md`](../README.md). If you want the 90-second
pitch, stay in the README. If you want to change how the pipeline works,
read here.

---

## 1 · System overview

Lazarus is a FastAPI control plane wrapped around a multi-agent reasoning
engine, with two persistence stores (Postgres + Neo4j), a Redis slot reserved
for background jobs, and three operator surfaces (web UI, OpenClaw skill,
iMessage bridge).

```
            ┌─────────────────────────────────────────────────────┐
            │  Operator surfaces                                  │
            │  ─ React dashboard (Vite :5173)                     │
            │  ─ Reasoning lab (/agent-trace)                     │
            │  ─ OpenClaw skill pack                              │
            │  ─ Photon / Spectrum iMessage bridge                │
            └──────────────────┬──────────────────────────────────┘
                               │  REST + WebSocket + webhooks
                               ▼
            ┌─────────────────────────────────────────────────────┐
            │  FastAPI — backend.app.main                         │
            │  ─ routers: rescue_pipeline · discovery · runs ·    │
            │    blueprints · portfolio · reviews · graph ·       │
            │    photon · spectrum · openclaw                     │
            │  ─ reasoning_service (orchestrator)                 │
            │  ─ blueprint_service (Jinja + WeasyPrint)           │
            │  ─ discovery_service (CT.gov · PubMed · openFDA)    │
            └──────┬──────────────┬──────────────┬────────────────┘
                   │              │              │
                   ▼              ▼              ▼
         ┌─────────────┐ ┌────────────────┐ ┌──────────────┐
         │ PostgreSQL  │ │ Neo4j graph    │ │ LLM backends │
         │ runs, steps │ │ Drug · Target  │ │ OpenAI       │
         │ hypotheses  │ │ Disease · Evid │ │ Gemini       │
         │ reviews     │ │ Hypothesis     │ │ K2-Think     │
         │ blueprints  │ └────────────────┘ └──────────────┘
         └─────────────┘
```

Redis is provisioned in `docker-compose.yml` but not yet wired — see
[`ISSUES.md`](ISSUES.md) ISS-005.

---

## 2 · The reasoning engine

The orchestrator in `backend/app/services/reasoning_service.py` wires the
agents into an explicit, typed DAG. It is **not** a ReAct loop — every edge
is hand-coded, every output is a Pydantic model, every step writes an
`AgentStep` row before the next step runs.

```
┌──────────────────┐
│ Context Builder  │  pulls asset + CT.gov + PubMed + graph neighborhood
└────────┬─────────┘
         ▼
┌──────────────────┐
│ Advocate         │  proposes best repurposed indication, confidence score
│ (GPT-4o)         │
└────────┬─────────┘
         ▼
┌──────────────────┐
│ Skeptic          │  red-teams: mechanistic conflicts, hallucinated citations
│ (GPT-4o-mini)    │  (PubMed cross-check), safety pressure tests
└────────┬─────────┘
         ▼
┌──────────────────┐
│ Parallel Evidence│  runs N mechanistic branches concurrently
│ (Gemini / K2)    │
└────────┬─────────┘
         ▼
┌──────────────────┐
│ Evidence Curator │  structures supporting + contradicting lit into
│ (Gemini Flash)   │  a citable evidence set
└────────┬─────────┘
         ▼
┌──────────────────┐
│ Assessment       │  measures disagreement, coverage, citation density
└────────┬─────────┘
         ▼
┌──────────────────┐
│ Trial Strategist │  phase plan, endpoints, priority
│ (K2-Think v2)    │
└────────┬─────────┘
         ▼
┌──────────────────┐
│ Effort + Impact  │  $, months, patient pop, commercial band
└────────┬─────────┘
         ▼
┌──────────────────┐
│ Judge            │  final_confidence, final_recommendation
│ (GPT-4o)         │
└────────┬─────────┘
         ▼
  Hypothesis row + (optional) HumanReview row
         ▼
  Blueprint (on demand) → PDF artifact
```

**Key invariant:** every agent has a *deterministic fallback*. If the LLM
call fails or the API key is absent, the fallback produces a structurally
identical output so downstream agents never see a hole. This is what makes
the offline demo mode work.

---

## 3 · Data model — Postgres

Compact, hackathon-friendly schema; still enforces real relationships.
Migrations are applied on app boot by `db.apply_runtime_migrations()` —
there is no Alembic yet.

```
CompanyAsset ─┬─< AgentRun ────< AgentStep
              │       │
              │       └────< Hypothesis ──< Blueprint ──< Notification
              │                │
              │                ├─< EffortAnalysis
              │                └─< ImpactAnalysis
              │
              ├─< AssetMemory
              └─< HumanReview

DiseaseWatchlist ──< WatchlistAlert
Message (iMessage inbound/outbound)
RunMemory (short-term, per-run)
```

### Primary tables

| Table | Purpose |
|---|---|
| `company_assets` | The portfolio — shelved drugs with original indication, sponsor, failure reason, modality. |
| `agent_runs` | One row per `/run-analysis` call. Carries status, asset, trigger, timings. |
| `agent_steps` | The streaming trace. One row per agent invocation with score, input/output summaries, citations. |
| `hypotheses` | Terminal output of a run. Joins back to the asset and the run that produced it. |
| `effort_analyses` · `impact_analyses` | Structured economics attached to a hypothesis. |
| `blueprints` | PDF artifacts. Stores signed-URL metadata, not the bytes — bytes live on disk in `artifacts/blueprints/`. |
| `notifications` | Outbound deliveries (iMessage, webhook) with provider + status. |
| `human_reviews` | HITL queue. Created when confidence or disagreement crosses thresholds. |
| `messages` | Raw inbound/outbound iMessage records from Spectrum. |
| `run_memories` · `asset_memories` | Short-term (per-run) and long-term (per-asset) memory columns; vector retrieval is roadmap (ISS-100). |
| `disease_watchlists` · `watchlist_alerts` | Multi-disease scan scheduling. |

---

## 4 · Data model — Neo4j

Biological knowledge lives here because traversal is the dominant access
pattern and the reasoning engine needs to walk "give me every disease
that shares a target with drug X."

### Nodes

| Label | Required properties |
|---|---|
| `Drug` | `drug_id`, `name`, `mechanism_of_action`, `modality`, `development_stage`, `status`, `failure_reason`, `company` |
| `Disease` | `disease_id`, `name`, `category`, `icd_code`, `description` |
| `Target` | `target_id`, `name`, `symbol`, `target_type`, `organism` |
| `ClinicalTrial` | `trial_id`, `title`, `phase`, `status`, `enrollment`, `start_date`, `end_date`, `failure_reason`, `sponsor` |
| `Evidence` | `evidence_id`, `title`, `source`, `source_ref`, `snippet`, `confidence_score`, `url`, `published_date` |
| `RepurposingHypothesis` | `hypothesis_id`, `title`, `summary`, `status`, `advocate_score`, `skeptic_score`, `judge_score`, `final_confidence`, `created_at` |

### Relationships

```
(:Drug)-[:FAILED_FOR]->(:Disease)
(:Drug)-[:ORIGINALLY_INDICATED_FOR]->(:Disease)
(:Drug)-[:TARGETS]->(:Target)
(:Drug)-[:TESTED_IN]->(:ClinicalTrial)
(:ClinicalTrial)-[:FOR_DISEASE]->(:Disease)
(:Drug|:Disease|:Target|:ClinicalTrial)-[:SUPPORTED_BY]->(:Evidence)
(:RepurposingHypothesis)-[:PROPOSES_REPURPOSING_OF]->(:Drug)
(:RepurposingHypothesis)-[:FROM_DISEASE]->(:Disease)
(:RepurposingHypothesis)-[:TO_DISEASE]->(:Disease)
```

### Constraints (enforced at load time)

`Drug.drug_id`, `Disease.disease_id`, `Target.target_id`,
`ClinicalTrial.trial_id`, `Evidence.evidence_id`, and
`RepurposingHypothesis.hypothesis_id` are all unique.

The seed data at `backend/graph/seed_data.py` uses `MERGE`, so re-running the
loader is idempotent. The pipeline currently *reads* from Neo4j but does not
write `RepurposingHypothesis` nodes — see [`ISSUES.md`](ISSUES.md) ISS-002.

---

## 5 · Streaming

`POST /run-analysis` enqueues a run and returns immediately with a `run_id`.
Two surfaces are available for watching it:

- `GET /runs/{id}/trace` — polled, returns the full trace so far.
- `WS /runs/{id}/stream` — pushes each new `AgentStep` as a JSON frame.

The front-end (`frontend/src/hooks/useRunStatus.js`) prefers WS and
transparently falls back to polling every 800 ms if the socket fails to open
or drops. Frames are idempotent — each carries its step ordinal, so the UI
can dedupe on reconnect.

---

## 6 · LLM provider routing

| Agent | Primary provider | Why |
|---|---|---|
| Advocate, Judge | OpenAI `gpt-4o` | Need the strongest general-purpose reasoning. |
| Skeptic | OpenAI `gpt-4o-mini` | Pattern-match + citation cross-check — cost-optimized. |
| Evidence Curator, Parallel Evidence | Gemini `2.5-flash` | Cheap-and-fast long-context ingest. |
| Trial Strategist | MBZUAI K2-Think v2 | Structured multi-step clinical planning. |
| Effort / Impact | Deterministic + LLM assist | Heuristics produce a floor; LLM refines. |

Every agent has a deterministic fallback that runs when the provider is
unreachable or the API key is unset. Those fallbacks are what make the
`LAZARUS_DISCOVERY_DEMO_CACHE=true` path rock-solid for live demos.

---

## 7 · External integrations

| Integration | Role | Failure mode |
|---|---|---|
| ClinicalTrials.gov v2 | Authoritative trial metadata | Falls back to canned payload when `LAZARUS_DISCOVERY_DEMO_CACHE=true`. |
| PubMed E-Utils | Literature search + Skeptic citation cross-check | Skeptic continues with reduced confidence. |
| openFDA | Adverse-event signal | Optional — pipeline logs and continues. |
| Photon / Spectrum | Outbound iMessage delivery | Fall through to BlueBubbles. |
| BlueBubbles | Fallback iMessage provider | Optional — notification row still written. |
| OpenClaw | Desktop conversational surface | Shared-token gated bridge routes. |

---

## 8 · Deployment topology

- **Backend →** Render (`render.yaml`): `pip install -r requirements.txt` →
  `uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT`.
- **Frontend →** Vercel (`frontend/vercel.json`): Vite build with
  `VITE_API_BASE_URL` pointing at the Render service.
- **Datastores →** Docker for local dev; managed Postgres (Neon / Supabase)
  and Neo4j Aura for production.

---

## 9 · Where to read the code

```
backend/app/main.py                  — FastAPI app, CORS, router mounting
backend/app/agents/                  — per-agent LLM wrappers + fallbacks
backend/app/services/
    reasoning_service.py             — the orchestrator DAG
    blueprint_service.py             — Jinja + WeasyPrint
    discovery_service.py             — CT.gov · PubMed · openFDA fetchers
    graph_service.py                 — Neo4j driver + cypher queries
backend/app/api/                     — HTTP routers (rescue, runs, blueprints…)
backend/graph/                       — Neo4j schema, seed, cypher
frontend/src/pages/AgentTrace.jsx    — reasoning lab
frontend/src/hooks/useRunStatus.js   — WS-with-polling-fallback reader
openclaw/skills/lazarus/SKILL.md     — OpenClaw skill manifest
```
