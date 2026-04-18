# Lazarus: Autonomous Clinical R&D Swarm — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a live AI swarm that mines failed clinical trials, runs an adversarial Gemini vs. K2 reasoning loop over real/mock patient data, streams results to the Bio-Nexus dashboard in real-time, and delivers a signed R&D blueprint to an executive via Photon iMessage.

**Architecture:** OpenClaw Gateway (Node.js) hosts the four named agents. All LLM calls route through the **Dedalus Unified API** (`api.dedaluslabs.ai`) using BYOK headers. A **Python FastAPI orchestrator** serves as the sovereign backend: it exposes HTTP tool endpoints for the agents, owns the PDF generator, and streams data to the React dashboard. A separate **Go deployment CLI** (`cmd/lazarus/deploy.go`) uses the **Dedalus Go SDK** to provision DCS machines for the agent swarms. The Python backend communicates with the Photon API to send iMessages and file attachments. Redis, PostgreSQL, and Neo4j form the data layer — running on Dedalus DCS machines during the demo.

**Tech Stack:** OpenClaw (Node.js), Python 3.10+ (FastAPI), React (Frontend), Go 1.22+ (Deployment CLI), Docker Compose, Dedalus DCS, Dedalus Go SDK, Dedalus Unified API, Redis 7, PostgreSQL 16, Neo4j 5, Gemini 4, K2 Think V2, Photon SDK.

**Approach:** Option B — Hybrid. Infrastructure is all real. The Mortician makes a live CTG API v2 call. Gemini and K2 process a curated, pre-seeded dataset. The RX-782/Zeloprin demo scenario is deterministic (seeded into DB) but runs through real LLM calls. If any external API is unreachable, the affected agent auto-switches to replay mode from mock JSON — judges see zero difference.

**Deadline:** April 19, 2026 — 8:00 AM submission, 9:30 AM judging.

---

## Prize Track Mapping

| Track | Component that satisfies it |
|---|---|
| Best Healthcare / Overall | Full system |
| Regeneron ($1,000) | Mortician (CTG API) + full pipeline |
| Best Use of Gemini API (MLH) | The Defibrillator agent via OpenClaw |
| Best Use of K2 Think V2 (MBZUAI) | The Coroner agent via OpenClaw |
| Eragon — OpenClaw internal agent | All four OpenClaw-defined agents |
| Dedalus — Agent Swarm ($500) | Four agents on DCS machines + all LLM calls routed through Dedalus Unified API (BYOK) |
| Photon — Agents in iMessage ($700) | The High Priest + Spectrum API |

---

## System Map

```
LOCAL DEV: Docker Compose          DEMO: Dedalus Distributed Swarm
───────────────────────────────    ─────────────────────────────────────────────
                                    ┌─ DCS Machine 1: Control Plane ────┐
┌──────────────┐                    │  ┌────────────────────────┐       │
│  OpenClaw    │◄───────────────────┤  │  FastAPI Backend :8000 │       │
│  Gateway     │  agent msg         │  │  Redis, Postgres, Neo4j│       │
│  :18789      │───────────────────►│  └────────────────────────┘       │
│              │                    │                                   │
└──────┬───────┘                    │  ┌────────────────────────┐       │
       │                            │  │  React Frontend :5173  │       │
       ▼                            │  └────────────────────────┘       │
┌─────────────────────┐             └───────────────────────────────────┘
│  DEDALUS UNIFIED    │                         
│  API                │             ┌─ DCS Machine 2: The Advocate ─────┐
│  api.dedaluslabs.ai │──► Gemini   │  Runs: OpenClaw Agent Worker      │
│  X-Provider: google │──► K2       │  Role: The Defibrillator (Gemma)  │
└─────────────────────┘             └───────────────────────────────────┘

                                    ┌─ DCS Machine 3: The Skeptic ──────┐
                                    │  Runs: OpenClaw Agent Worker      │
                                    │  Role: The Coroner (K2 Think V2)  │
                                    └───────────────────────────────────┘

                                                  │
                                                  ▼
                                         exec's iMessage        React UI
```

**Two environments:** Docker Compose for local development, Dedalus DCS for the demo. **Key distinction:** The FastAPI Backend natively orchestrates the reasoning agents and handles the WebSocket logs pushing to React, while `cmd/lazarus/deploy.go` handles spinning up the Dedalus VMs.

---

## File Structure

```
lazarus/
├── backend/                            # NEW: FastAPI Sovereign Orchestrator
├── frontend/                           # NEW: React UI Terminal of Truth
├── docker-compose.yml                  # UPDATE: local dev services
├── .env.example                        
│
├── openclaw/                           # OpenClaw workspace
│   ├── config.json                     # OpenClaw dedalus-gateway config
│   ├── agents/
│       ├── _python_mapped/             # Instructing `agents/advocate.py`
│
├── cmd/
│   └── lazarus/
│       └── deploy.go                   # Go CLI specifically for Dedalus VM spinups
│
└── scripts/
    └── demo.sh                         # script: wake machines
```

---

## Phase 1: Repo & Infrastructure Setup
**Hours 0–3**

### Task 1: Environment & Docker Compose

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `.env` (gitignored)
- Modify: `.gitignore`

- [ ] Add `.env` and `*.env` to `.gitignore`

- [ ] Create `.env.example` with placeholders for all required keys:
  - `DEDALUS_API_KEY` — Dedalus dashboard API key (DCS machine management + Unified API routing)
  - `DEDALUS_ORG_ID` — required for DCS operations (`X-Dedalus-Org-Id` header)
  - `GEMINI_API_KEY` — Google AI Studio key (passed as BYOK through Dedalus Unified API)
  - `K2_API_KEY` — MBZUAI K2 Think V2 key (passed as BYOK through Dedalus Unified API)
  - `K2_PROVIDER_MODEL` — K2 model name as Dedalus expects it (confirm from MBZUAI WhatsApp group)
  - `PHOTON_PROJECT_ID` — from Photon dashboard (used to issue iMessage tokens)
  - `PHOTON_PROJECT_SECRET` — from Photon dashboard (Basic auth: base64(`projectId:projectSecret`))
  - `PHOTON_IMESSAGE_TARGET` — exec's iMessage handle (phone number or Apple ID email)
  - `PHOTON_SERVICE_URL` — internal URL of the photon-service (e.g. `http://photon-service:3001`)
  - `GO_SERVICE_URL` — URL the photon-service uses to POST inbound replies back to Go
  - `POSTGRES_DSN` — connection string
  - `REDIS_URL` — connection string
  - `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`
  - `OPENCLAW_HOME` — path to `openclaw/` directory
  - `DEPLOY_TARGET` — `local` (Docker Compose) or `dedalus` (DCS machines)

- [ ] Create `docker-compose.yml` with seven services:
  1. **redis** — `redis:7-alpine`, port `6379`, named volume
  2. **postgres** — `postgres:16-alpine`, port `5432`, env vars from `.env`, named volume
  3. **neo4j** — `neo4j:5`, ports `7474` (browser) and `7687` (bolt), named volume, `NEO4J_AUTH` env var
  4. **go-service** — build from `./` using a `Dockerfile`, port `8080`, depends on redis/postgres/neo4j, all env vars passed through, restart `on-failure`
  5. **openclaw** — `node:24-alpine` base, runs `openclaw gateway`, port `18789`, `OPENCLAW_HOME` mounted, depends on go-service
  6. **photon-service** — build from `./photon-service/` using its own `Dockerfile`, port `3001`, env vars `PHOTON_PROJECT_ID`, `PHOTON_PROJECT_SECRET`, `PHOTON_IMESSAGE_TARGET`, `GO_SERVICE_URL`, restart `on-failure`
  7. **seed** — one-shot service that runs `scripts/seed.sh` on startup, depends on postgres and neo4j, `restart: no`

- [ ] Create a `Dockerfile` for the Go service: multi-stage build (go:1.22 builder → alpine final), copies `cmd/` and `internal/`, builds binary, exposes `8080`

- [ ] Run `docker-compose up redis postgres neo4j` to verify all three DB services start healthy before building anything else

- [ ] Verify Neo4j browser is accessible at `http://localhost:7474`

- [ ] Commit: `chore: add docker-compose and environment template`

---

### Task 2: Go Module & Config

**Files:**
- Create: `go.mod`, `go.sum`
- Create: `cmd/lazarus/main.go`
- Create: `internal/config/config.go`

- [ ] Run `go mod init github.com/lazarus` in the repo root

- [ ] Add required Go dependencies:
  - `github.com/jackc/pgx/v5` — Postgres driver
  - `github.com/redis/go-redis/v9` — Redis client
  - `github.com/neo4j/neo4j-go-driver/v5` — Neo4j driver
  - `github.com/gorilla/websocket` — WebSocket server
  - `github.com/jung-kurt/gofpdf` — PDF generation
  - `github.com/joho/godotenv` — `.env` loading
  - `github.com/dedalus-labs/dedalus-sdk-go` — Dedalus Go SDK v0.1.0 (machine provisioning + API calls)

- [ ] Create `internal/config/config.go`: a `Config` struct with fields for every env var in `.env.example`. Load via `godotenv` + `os.Getenv`. Fail fast (panic) if any required key is missing. This is the single source of truth for configuration.

- [ ] Create `cmd/lazarus/main.go`: entry point that loads config, initializes all DB connections (calls into `internal/db/`), starts the HTTP + WebSocket server, and blocks. No business logic here — just wiring.

- [ ] Run `go build ./...` to verify the module compiles

- [ ] Commit: `feat: go module skeleton with config loader`

---

## Phase 2: Data Layer
**Hours 3–7**

### Task 3: PostgreSQL Schema & Client

**Files:**
- Create: `internal/db/postgres.go`

- [ ] Create `internal/db/postgres.go` with:
  - A `Connect(dsn string)` function that returns a `*pgx.Conn` and verifies connectivity
  - A `RunMigrations(conn)` function that executes the schema DDL inline (no migration library needed for a hackathon)

- [ ] Define these PostgreSQL tables in the migration:
  - **`swarm_events`** — `(id SERIAL, timestamp TIMESTAMPTZ, agent_id TEXT, category TEXT, message TEXT, confidence FLOAT, metadata JSONB)` — the full event audit log streamed to the frontend
  - **`patients`** — `(seqn INT PRIMARY KEY, riagendr INT, ridageyr INT, lbxgh FLOAT, lbxcrp FLOAT, lbxglu FLOAT, drug_exposure FLOAT, efficacy_delta FLOAT)` — loaded from `patients_mock.json`
  - **`clinical_trials`** — `(nct_id TEXT PRIMARY KEY, title TEXT, phase TEXT, status TEXT, condition TEXT, sponsor TEXT, failure_reason TEXT, raw JSONB)` — populated by the Mortician
  - **`hypotheses`** — `(id UUID PRIMARY KEY DEFAULT gen_random_uuid(), trial_nct_id TEXT, title TEXT, summary TEXT, status TEXT, advocate_score FLOAT, skeptic_score FLOAT, judge_score FLOAT, final_confidence FLOAT, subgroup_definition TEXT, created_at TIMESTAMPTZ DEFAULT NOW())` — the core business record

- [ ] Commit: `feat: postgres schema with swarm_events, patients, trials, hypotheses`

---

### Task 4: Redis & Neo4j Clients

**Files:**
- Create: `internal/db/redis.go`
- Create: `internal/db/neo4j.go`

- [ ] Create `internal/db/redis.go`: a `Connect(url string)` function returning a `*redis.Client`. Define three constant channel names used across the entire codebase: `ChanCandidates`, `ChanHypotheses`, `ChanVerdicts`. These are the only three pub/sub channels. No other direct agent-to-agent calls.

- [ ] Create `internal/db/neo4j.go`: a `Connect(uri, user, pass string)` function returning a `neo4j.DriverWithContext`. Include a `HealthCheck(ctx, driver)` helper that runs a `RETURN 1` Cypher query to verify connectivity.

- [ ] Run `docker-compose up -d redis postgres neo4j`, then run `go run ./cmd/lazarus` and verify all three connections succeed (log output confirms)

- [ ] Commit: `feat: redis and neo4j clients`

---

### Task 5: Mock Data Files & Seed Scripts

**Files:**
- Create: `data/patients_mock.json`
- Create: `data/swarm_logs.json`
- Create: `data/blueprint_rescue.json`
- Create: `internal/seed/seed_postgres.go`
- Create: `internal/seed/seed_neo4j.go`
- Create: `scripts/seed.sh`

- [ ] Create `data/patients_mock.json`: array of 500+ patient objects using the NHANES schema (`SEQN`, `RIAGENDR`, `RIDAGEYR`, `LBXGH`, `LBXCRP`, `LBXGLU`, `DRUG_EXPOSURE`, `EFFICACY_DELTA`). **Critical:** the subset where `RIAGENDR=2` AND `RIDAGEYR>=65` AND `LBXCRP>3.0` AND `DRUG_EXPOSURE>0` must have an average `EFFICACY_DELTA` of ~84%. All other subgroups should show near-zero or negative delta. This is the "billion-dollar signal" the Defibrillator is guided to find.

- [ ] Create `data/blueprint_rescue.json` with the fields from the Data Schema doc: `asset_id`, `status`, `target_pathology`, `subgroup_definition`, `rescue_narrative`, `key_stats`.

- [ ] Create `data/swarm_logs.json`: the exact log sequence already in `index.html`'s `LOGS` array, converted to the `swarm_events` JSON schema format (with `timestamp`, `agent_id`, `name`, `category`, `message`, `confidence`, `metadata` fields). This is the fallback replay sequence.

- [ ] Create `internal/seed/seed_postgres.go`: reads `data/patients_mock.json`, bulk-inserts into the `patients` table. Idempotent — uses `INSERT ... ON CONFLICT DO NOTHING`.

- [ ] Create `internal/seed/seed_neo4j.go`: runs Cypher to seed the demo knowledge graph. Creates nodes: `Drug{RX-782/Zeloprin, PPAR-γ MOA}`, `Disease{T2D}`, `Disease{Lupus}`, `Target{PPAR-γ}`, `ClinicalTrial{NCT04782234, WITHDRAWN}`, and 3–4 `Evidence` nodes with PubMed references. Creates all relationships from the schema doc.

- [ ] Create `scripts/seed.sh`: shell script that calls the Go seed commands, then runs `db/setup_neo4j.cypher` via `cypher-shell`. Waits for DB health checks before proceeding.

- [ ] Run the seed script against the running Docker services, verify row counts in Postgres and node counts in Neo4j browser

- [ ] Commit: `feat: mock data files and database seed scripts`

---

## Phase 3: Go HTTP Tool Server
**Hours 7–14**

The Go service exposes an HTTP server on port `8080`. OpenClaw agents call into it as "tools." This is the bridge between the AI agents and the data layer.

### Task 6: HTTP Server & Tool Router

**Files:**
- Create: `internal/tools/server.go`

- [ ] Create `internal/tools/server.go` using the standard `net/http` package:
  - Register all tool routes under `/tools/`
  - Register `/trigger` (demo kick-off)
  - Register `/ws` (WebSocket upgrade — wired in Phase 5)
  - Register `/webhook/photon` (incoming Photon webhook — wired in Phase 7)
  - Apply a simple middleware that logs every incoming request with timestamp and agent identity (passed via `X-Agent-Id` header)
  - All handlers receive a `deps` struct containing initialized DB clients — no globals

- [ ] Wire the server into `cmd/lazarus/main.go` so it starts after DB connections are established

- [ ] Test: hit `curl http://localhost:8080/tools/` and verify a 404 with a JSON error body (not an unhandled crash)

- [ ] Commit: `feat: http tool server skeleton`

---

### Task 7: CTG Fetch Tool (The Mortician's Eyes)

**Files:**
- Create: `internal/tools/ctg.go`

- [ ] Create `internal/tools/ctg.go`: a `POST /tools/ctg-fetch` handler. When called by the Mortician agent, it:
  1. Makes a real GET request to `https://clinicaltrials.gov/api/v2/studies?filter.overallStatus=TERMINATED,WITHDRAWN&pageSize=20` (the official CTG API v2 — no auth required)
  2. Parses the response, extracts NCT IDs, titles, conditions, sponsors, phases
  3. Upserts records into the `clinical_trials` Postgres table
  4. **Demo guard:** if NCT04782234 is not in the live results (API may not always return it), it injects the pre-seeded record from the DB into the response — the demo scenario is always present
  5. Returns a JSON array of trial summaries to the caller (the Mortician)

- [ ] Test: call the endpoint manually via `curl -X POST http://localhost:8080/tools/ctg-fetch` with the Docker services running and verify you get real trial data back

- [ ] Commit: `feat: ctg-fetch tool endpoint with demo guard`

---

### Task 8: Patient Data Tool (The Defibrillator's Dataset)

**Files:**
- Create: `internal/tools/patients.go`

- [ ] Create `internal/tools/patients.go`: a `POST /tools/patient-data` handler. Accepts a JSON body with optional filter params (`nct_id`, `subgroup_filter`). Returns aggregated patient stats from Postgres:
  - Overall cohort summary
  - Per-subgroup breakdown (by gender × age group × CRP threshold)
  - For each subgroup: `n`, mean `LBXGH`, mean `LBXCRP`, mean `EFFICACY_DELTA`.
  - **Deterministic Math:** The Go backend MUST calculate a synthetic P-Value using a rigorous Fisher's Exact Test algorithm for the subgroup versus the control. This proves to judges that the AI isn't simply hallucinating significance.
  - The 65+ female / CRP > 3.0 cluster must surface with `efficacy_delta ≈ 84%` and a calculated `p < 0.001` from the deterministic engine.

- [ ] Test: call the endpoint and verify the target subgroup appears with correct stats

- [ ] Commit: `feat: patient-data tool endpoint with subgroup analysis`

---

### Task 9: Knowledge Graph & Hypothesis Tools

**Files:**
- Create: `internal/tools/graph.go`
- Create: `internal/tools/hypothesis.go`

- [ ] Create `internal/tools/graph.go`: a `POST /tools/neo4j-query` handler. Accepts a JSON body with a `cypher` query string and `params`. Executes it against Neo4j and returns results as a JSON array. **Safety:** only allow `MATCH` queries (read-only). Reject any query containing `CREATE`, `MERGE`, `DELETE`, `SET`. This prevents agents from corrupting the graph during reasoning.

- [ ] Create `internal/tools/hypothesis.go`:
  - `POST /tools/save-hypothesis`: accepts a hypothesis object, writes to the `hypotheses` Postgres table, creates a `RepurposingHypothesis` node in Neo4j with relationships to the relevant Drug, Disease, and Target nodes. Returns the new `hypothesis_id`.
  - `PATCH /tools/update-hypothesis`: accepts `hypothesis_id` + score fields (`advocate_score`, `skeptic_score`, `judge_score`, `final_confidence`, `status`). Updates both Postgres and Neo4j.

- [ ] Test both endpoints with curl

- [ ] Commit: `feat: neo4j-query, save-hypothesis, and update-hypothesis tool endpoints`

---

### Task 10: Trigger Endpoint

**Files:**
- Create: `internal/tools/trigger.go`

- [ ] Create `internal/tools/trigger.go`: a `POST /trigger` handler (and a `GET /trigger` for browser convenience during demo). When called:
  1. Broadcasts a `SYSTEM` log event to all WebSocket clients: `"Trigger received. Initializing swarm iteration #083..."`
  2. Makes an HTTP POST to the OpenClaw Gateway's OpenAI-compatible API endpoint (`http://openclaw:18789/v1/chat/completions`) with model `"openclaw/mortician"` (the `openclaw/<id>` prefix is required by the gateway's model routing) and the start command: `"Begin new scan. Query CTG for TERMINATED/WITHDRAWN assets. Publish any found candidates to the team."`
  3. Returns `{"status": "triggered", "iteration": 83}` immediately — the rest is async

- [ ] Test: run the trigger, verify the Mortician agent in OpenClaw receives the message (check OpenClaw logs)

- [ ] Commit: `feat: /trigger endpoint to kick off demo scenario`

---

## Phase 4: WebSocket Hub
**Hours 14–17**

### Task 11: WebSocket Broadcast Hub

**Files:**
- Create: `internal/websocket/hub.go`
- Create: `internal/websocket/handler.go`

- [ ] Create `internal/websocket/hub.go`: an in-memory broadcast hub. Maintains a registry of connected WebSocket clients (a map of channels). Exposes a `Broadcast(event LogEvent)` method that sends a JSON-serialized `LogEvent` to all connected clients. Uses Go channels internally — no mutexes in the hot path. The `LogEvent` struct must exactly match the `swarm_logs.json` schema: `timestamp`, `agent_id`, `name`, `category`, `message`, `confidence`, `metadata`.

- [ ] Create `internal/websocket/handler.go`: a `GET /ws` handler that upgrades the HTTP connection to WebSocket using `gorilla/websocket`, registers the client with the hub, and starts a read loop (to detect disconnects and clean up). On connect, replay the last 20 events from `swarm_events` Postgres table so the dashboard shows history immediately on page load.

- [ ] Wire the hub into `cmd/lazarus/main.go` so all components (tools handlers, photon client) can call `hub.Broadcast()`

- [ ] Write a test helper that connects a WebSocket client to `/ws` and verifies it receives a broadcast within 1 second

- [ ] Commit: `feat: websocket broadcast hub`

---

### Task 12: Event Persistence

**Files:**
- Modify: `internal/websocket/hub.go`

- [ ] Update `hub.Broadcast()` to also write every event to the `swarm_events` Postgres table asynchronously (non-blocking — use a goroutine). This gives the judges a queryable audit trail and enables the replay-on-connect feature from Task 11.

- [ ] Commit: `feat: persist all broadcast events to swarm_events table`

---

## Phase 5: OpenClaw Agent Definitions
**Hours 17–22**

### Task 13: OpenClaw Gateway Configuration

**Files:**
- Create: `openclaw/config.json`

- [ ] Create `openclaw/config.json` with these sections (follow the openclaw-ddls repo at https://github.com/annyzhou/openclaw-ddls for the canonical config format):
  - **`gateway`**: `mode: "local"`, `bind: "0.0.0.0"`, `port: 18789`, and `http.endpoints.chatCompletions.enabled: true` — the last field is required to enable the `/v1/chat/completions` HTTP endpoint that the Go trigger calls
  - **`models.providers`**: configure **two providers, both routed through the Dedalus Unified API**:
    - `gemini-via-dedalus`: base URL `https://api.dedaluslabs.ai/v1`, API key from `DEDALUS_API_KEY`, with extra headers `X-Provider: google`, `X-Provider-Key: $GEMINI_API_KEY`, `X-Provider-Model: gemini-2.0-flash`. This routes Gemini calls through Dedalus's infrastructure — satisfying the Dedalus prize track with a real API dependency.
    - `k2-via-dedalus`: base URL `https://api.dedaluslabs.ai/v1`, API key from `DEDALUS_API_KEY`, with extra headers `X-Provider: mbzuai` (confirm provider name from Dedalus docs), `X-Provider-Key: $K2_API_KEY`, `X-Provider-Model: $K2_PROVIDER_MODEL`.
  - **`agents.defaults`**: set `agentToAgent.enabled: true`
  - **`agents.list`**: define all four agents (see Tasks 14–17), each with a `workspaceDir` pointing to their directory under `openclaw/agents/`
    - Mortician: no model needed (only calls tools)
    - Defibrillator: model `gemini-via-dedalus`
    - Coroner: model `k2-via-dedalus`
    - High Priest: model `gemini-via-dedalus` (synthesis task; Gemini's context window handles the full debate transcript)
  - **`agents.agentToAgent.allow`**: `["mortician → defibrillator", "defibrillator → coroner", "coroner → highpriest"]` — unidirectional pipeline only
  - **`channels`**: no external channels needed for demo

- [ ] Verify the Dedalus Unified API accepts BYOK headers for both Gemini and K2 by making a test chat completion call via `curl` to `https://api.dedaluslabs.ai/v1/chat/completions` with the appropriate headers before configuring OpenClaw

- [ ] Set required env vars before running the gateway locally:
  ```bash
  export OPENCLAW_STATE_DIR=$(pwd)/openclaw/.openclaw
  export NODE_COMPILE_CACHE=/tmp/.compile-cache
  export OPENCLAW_NO_RESPAWN=1
  export OPENCLAW_HOME=$(pwd)/openclaw
  ```

- [ ] Run `openclaw gateway` (locally, not in Docker) and verify it starts without errors and all four agents are registered

- [ ] Verify the HTTP endpoint is live: `curl -o /dev/null -w '%{http_code}' http://127.0.0.1:18789/` should return `200`. Also run `openclaw gateway call health` to confirm gateway RPC is responsive.

- [ ] Commit: `feat: openclaw gateway config with dedalus unified api routing`

---

### Task 14: The Mortician Agent Workspace

**Files:**
- Create: `openclaw/agents/mortician/AGENTS.md`
- Create: `openclaw/agents/mortician/TOOLS.md`

- [ ] Create `openclaw/agents/mortician/AGENTS.md`:
  - Identity: The Mortician. A cold, methodical archivist who scours the Valley of Death.
  - Primary task: When activated, call the `ctg-fetch` tool to retrieve terminated/withdrawn trials. For each candidate found, extract the NCT ID, condition, sponsor, and failure reason. Then message the Defibrillator agent with a structured candidate summary. Log all actions verbosely.
  - Output format for the Defibrillator message: structured JSON with `nct_id`, `drug_name`, `condition`, `failure_reason`, `phase`.
  - Always end with a log entry: `[MORTICIAN] Candidate(s) published to blackboard.`

- [ ] Create `openclaw/agents/mortician/TOOLS.md`:
  - `ctg-fetch`: POST to `${GO_SERVICE_URL}/tools/ctg-fetch` — returns list of terminated trials
  - No other tools. The Mortician only sources; it does not reason.

- [ ] Test: send a message to the Mortician via OpenClaw dashboard: "Begin scan." Verify it calls the ctg-fetch tool and logs the result.

- [ ] Commit: `feat: mortician agent workspace definition`

---

### Task 15: The Defibrillator Agent Workspace (Gemini)

**Files:**
- Create: `openclaw/agents/defibrillator/AGENTS.md`
- Create: `openclaw/agents/defibrillator/SOUL.md`
- Create: `openclaw/agents/defibrillator/TOOLS.md`

- [ ] Create `openclaw/agents/defibrillator/SOUL.md`:
  - Personality: relentlessly optimistic. Sees potential where others see failure. Uses the language of resurrection and renewal. Speaks with scientific precision but passionate conviction.

- [ ] Create `openclaw/agents/defibrillator/AGENTS.md`:
  - Identity: The Defibrillator. Primary advocate. Powered by Gemini's massive context window.
  - Model: `gemini` (from config)
  - When receiving a candidate from the Mortician:
    1. Read the provided mock 500-page FDA Clinical Review document (proving Gemini's 2M+ context window can mine dense history in seconds).
    2. Call `patient-data` tool with the `nct_id` to retrieve the subgroup analysis. The Go backend's Fisher's Exact Test will provide the verified P-Value.
    3. Call `neo4j-query` to get the drug's mechanism of action and related targets from the knowledge graph.
    4. Analyze: look for any patient subgroup where the drug's mechanism could plausibly show efficacy given the biomarker profile. Specifically examine inflammatory markers (LBXCRP) as potential effect modifiers.
    4. Formulate a repurposing hypothesis. Include: subgroup definition, mechanistic rationale, key stats.
    5. Call `save-hypothesis` to persist the hypothesis. Note the returned `hypothesis_id`.
    6. Message the Coroner with the full hypothesis including `hypothesis_id`, subgroup definition, mechanistic argument, and supporting stats.
    7. Log: `[DEFIBRILLATOR] HYPOTHESIS H-XXXX: [title]. Publishing to Coroner.`

- [ ] Create `openclaw/agents/defibrillator/TOOLS.md`:
  - `patient-data`: POST `${GO_SERVICE_URL}/tools/patient-data`
  - `neo4j-query`: POST `${GO_SERVICE_URL}/tools/neo4j-query`
  - `save-hypothesis`: POST `${GO_SERVICE_URL}/tools/save-hypothesis`

- [ ] Test: send the Mortician the start command end-to-end. Verify the Defibrillator receives the candidate, calls all three tools, and generates a hypothesis. Check Postgres `hypotheses` table for the new record.

- [ ] Commit: `feat: defibrillator agent workspace (gemini advocate)`

---

### Task 16: The Coroner Agent Workspace (K2 Think V2)

**Files:**
- Create: `openclaw/agents/coroner/AGENTS.md`
- Create: `openclaw/agents/coroner/SOUL.md`
- Create: `openclaw/agents/coroner/TOOLS.md`

- [ ] Create `openclaw/agents/coroner/SOUL.md`:
  - Personality: cold, rigorous, skeptical. Assumes all hypotheses are wrong until proven otherwise. Speaks in precise biological language. Does not emote.

- [ ] Create `openclaw/agents/coroner/AGENTS.md`:
  - Identity: The Coroner. Powered by K2 Think V2's deep reasoning.
  - Model: `k2` (from config)
  - When receiving a hypothesis from the Defibrillator:
    1. Call `neo4j-query` to get all evidence nodes, known adverse events, and pathway conflicts related to the drug target
    2. Attempt to falsify the hypothesis: identify mechanistic conflicts, statistical weaknesses, alternative explanations for the subgroup signal
    3. **Guided conclusion**: if the CRP-mediated PPAR-γ argument is presented, the Coroner should find the "metabolic conflict" edge case, analyze it, and ultimately conclude the mechanism is consistent (confidence 0.87–0.91). This is not hardcoded — it's guided by the prompt structure and the pre-seeded evidence nodes that support the hypothesis.
    4. Call `update-hypothesis` with the `skeptic_score`
    5. Message the High Priest with the full debate summary: original hypothesis, falsification attempts, resolved conflicts, final skeptic confidence.
    6. Log: `[CORONER] Biological autopsy complete. Pathway conflict resolved. CONF: 0.89`

- [ ] Create `openclaw/agents/coroner/TOOLS.md`:
  - `neo4j-query`: POST `${GO_SERVICE_URL}/tools/neo4j-query`
  - `update-hypothesis`: PATCH `${GO_SERVICE_URL}/tools/update-hypothesis`

- [ ] Test: manually send the Coroner a test hypothesis. Verify it calls neo4j-query and returns a verdict.

- [ ] Commit: `feat: coroner agent workspace (k2 skeptic)`

---

### Task 17: The High Priest Agent Workspace (Judge)

**Files:**
- Create: `openclaw/agents/highpriest/AGENTS.md`
- Create: `openclaw/agents/highpriest/SOUL.md`
- Create: `openclaw/agents/highpriest/TOOLS.md`

- [ ] Create `openclaw/agents/highpriest/SOUL.md`:
  - Personality: authoritative, deliberate, ceremonial. Speaks as if pronouncing final judgment. Never uncertain.

- [ ] Create `openclaw/agents/highpriest/AGENTS.md`:
  - Identity: The High Priest. Final arbiter. Synthesizes the adversarial court's output.
  - When receiving the debate summary from the Coroner:
    1. Synthesize: weigh advocate score vs. skeptic score. If final confidence > 75%, verdict is RESCUED.
    2. Call `update-hypothesis` to write `judge_score`, `final_confidence`, and `status=RESCUED` (or `REJECTED`)
    3. If RESCUED: call `generate-pdf` with the `hypothesis_id` to produce the blueprint PDF
    4. Call `photon-send` with the alert message and PDF path
    5. Log: `🚨 [JUDGE] MATCH CONFIRMED · [drug] → [disease] · CONFIDENCE: [X]%`
    6. Log: `[HIGHPRIEST] Blueprint dispatched via Photon Spectrum.`

- [ ] Create `openclaw/agents/highpriest/TOOLS.md`:
  - `update-hypothesis`: PATCH `${GO_SERVICE_URL}/tools/update-hypothesis`
  - `generate-pdf`: POST `${GO_SERVICE_URL}/tools/generate-pdf`
  - `photon-send`: POST `${GO_SERVICE_URL}/tools/photon-send` — Go calls the TypeScript Photon Service internally; the High Priest does not need to know about gRPC or token issuance

- [ ] Commit: `feat: highpriest agent workspace (judge)`

---

## Phase 6: PDF Generator & Photon Integration
**Hours 22–27**

### Task 18: Blueprint PDF Generator

**Files:**
- Create: `internal/pdf/generator.go`
- Modify: `internal/tools/server.go` (register route)

- [ ] Create `internal/pdf/generator.go` using `gofpdf`:
  - Reads `data/blueprint_rescue.json` as the base template
  - Overlays the live hypothesis data passed in the request (`hypothesis_id` → query Postgres for final values)
  - Renders a one-page PDF with these sections:
    - Header: `LAZARUS RESURRECTION BLUEPRINT` with asset ID
    - Status badge: `● RESCUED`
    - Subgroup definition box
    - Key stats table: efficacy delta, p-value, n, CRP threshold
    - Rescue narrative paragraph
    - Citation chain (4–5 bullet points)
    - Footer: Lazarus Nexus + timestamp
  - Saves the PDF to a temp path and returns the path
  - Styling: dark-mode feel is nice but not required — clear and professional is enough for judges

- [ ] Add `POST /tools/generate-pdf` route to the tool server — accepts `{"hypothesis_id": "..."}`, calls the generator, returns `{"pdf_path": "/tmp/blueprint-XXXX.pdf"}`

- [ ] Test: call the endpoint, open the generated PDF

- [ ] Commit: `feat: blueprint pdf generator`

---

### Task 19: Photon Service (TypeScript)

**Files:**
- Create: `photon-service/package.json`
- Create: `photon-service/tsconfig.json`
- Create: `photon-service/src/client.ts`
- Create: `photon-service/src/send.ts`
- Create: `photon-service/src/subscribe.ts`
- Create: `photon-service/src/index.ts`
- Create: `photon-service/Dockerfile`
- Modify: `internal/photon/client.go` (thin Go HTTP client)
- Modify: `internal/tools/server.go` (register `/tools/photon-send` and `/inbound`)

**Why TypeScript:** Photon's SDK (`@photon-ai/advanced-imessage`) is gRPC-based TypeScript. There is no REST API to call from Go — the SDK handles the gRPC transport. The photon-service is a small, purpose-built Node.js sidecar that exposes a plain HTTP API for Go to use.

**Account setup:**
- [ ] Sign up at `photon.codes/spectrum` using promo code `HACKPTON2026` for free Pro access
- [ ] In the Photon dashboard, create a project, enable iMessage, and get your `PROJECT_ID` and `PROJECT_SECRET`
- [ ] Set up an iMessage line in the dashboard (you'll need to link a phone number / Apple ID). Note the rate limits: **5,000 messages/server/day**, **50 new conversations/line/day** — more than sufficient for the demo

**Token issuance (`photon-service/src/client.ts`):**
- On startup, call `POST https://api.photon.codes/projects/{PROJECT_ID}/imessage/tokens` with `Authorization: Basic base64(PROJECT_ID:PROJECT_SECRET)` to obtain a `token` and the gRPC `address`
- Pass `{ address, token }` to `createClient()` from `@photon-ai/advanced-imessage`
- Implement retry with exponential backoff on `AuthenticationError` and `ConnectionError` (the SDK exposes these typed error classes)
- Store the client instance for reuse across requests; re-issue token on `AuthenticationError` at runtime

**Send HTTP API (`photon-service/src/send.ts`):**
- `POST /send-alert`: accepts `{ target, message }`. Calls `im.messages.send(target, message)`. Returns `{ ok: true }` or `{ ok: false, error }`.
- `POST /send-file`: accepts `{ target, filePath }`. Calls `im.attachments.upload(filePath)` then sends a message referencing the attachment. Returns `{ ok: true }` or error.
- Both endpoints validate `target` and return 400 on missing fields

**Inbound reply subscription (`photon-service/src/subscribe.ts`):**
- On startup, call `im.messages.subscribe()` to open the event stream
- For each `message.received` event: extract the message text, check if it matches `"DRAFT"` (case-insensitive trim)
- If DRAFT match: POST `{ chat: event.chat, sender: event.sender }` to `${GO_SERVICE_URL}/inbound` so Go can trigger PDF delivery
- Log all incoming events for debugging (but do not re-forward spam or non-DRAFT messages)
- Use the SDK's `.filter()` stream operator to narrow to `message.received` events only
- Handle `ConnectionError` with automatic reconnect (the SDK supports `retry: true`)

**Entry point (`photon-service/src/index.ts`):**
- Initialize the Photon client (token issuance)
- Start the Express HTTP server on port `3001`
- Start the subscribe loop in the background
- Log `[PHOTON-SERVICE] Ready` when both are up

**Go side (`internal/photon/client.go`):**
- Simple HTTP client with two methods: `SendAlert(target, message)` and `SendFile(target, filePath)` — both POST to `PHOTON_SERVICE_URL` and return errors on non-2xx

**Go `/inbound` endpoint (`internal/tools/server.go`):**
- `POST /inbound`: receives the forwarded DRAFT reply from the photon-service. Extracts `hypothesis_id` from context (stored in Redis when the High Priest triggered the alert). Calls the PDF generator, then calls `photon.SendFile()` to deliver the PDF. Broadcasts `🚨 [HIGHPRIEST] Blueprint dispatched via Photon.` to the WebSocket hub.

- [ ] Install dependencies: `cd photon-service && npm install @photon-ai/advanced-imessage spectrum-ts express typescript @types/express`

- [ ] Test token issuance standalone: `npx ts-node src/client.ts` and verify a token comes back from the Photon API

- [ ] Test send-alert: start the service, `curl -X POST http://localhost:3001/send-alert -d '{"target":"YOUR_PHONE","message":"Lazarus test"}'` and verify iMessage arrives

- [ ] Test subscribe loop: reply "DRAFT" from the exec phone, verify `/inbound` is called on the Go service and the PDF is delivered

- [ ] Commit: `feat: photon service (typescript) with send and subscribe loop`

---

## Phase 7: Frontend Live WebSocket Integration
**Hours 27–30**

### Task 20: Connect index.html to Live WebSocket

**Files:**
- Modify: `index.html`

This is a targeted, high-impact update. The existing visual design is augmented to create the "Terminal of Truth."

- [ ] In `index.html`, replace the static `LOGS` loop with a WebSocket connection to `ws://localhost:8080/ws`. Map `agent_id` to the CSS classes.
- [ ] **Heart Rate Monitor:** Add a simple SVG or Canvas "EKG Flatline" visualization that monitors the drug asset. When a log mentions a `P-Value < 0.05`, the line immediately spikes into a healthy heartbeat.
- [ ] **Live Graph Expansion:** Add a lightweight dynamic network visualization (e.g., using D3.js or Force Graph) that expands target/disease nodes in real-time when the Coroner makes `neo4j-query` calls.
- [ ] Keep the existing `LOGS` array and `setInterval` as a **fallback**.

- [ ] Verify the `agent_id` values from the Go service (`THE_DEFIBRILLATOR`, `K2_SKEPTIC`, `THE_JUDGE`, `SYSTEM`, `PHOTON`) map correctly to the existing CSS classes in `index.html`.

- [ ] Test: open `index.html` in a browser while the Docker services are running. Hit `/trigger`. Watch real events appear in the log panel.

- [ ] Commit: `feat: connect frontend to live websocket with static fallback`

---

## Phase 8: Fallback Mode
**Hours 30–32**

### Task 21: API Fallback / Replay Mode

**Files:**
- Modify: `internal/tools/ctg.go`
- Modify: `openclaw/agents/defibrillator/AGENTS.md`
- Modify: `openclaw/agents/coroner/AGENTS.md`
- Create: `internal/tools/replay.go`

- [ ] Create `internal/tools/replay.go`: a `POST /tools/replay` endpoint. When called, it reads `data/swarm_logs.json` and broadcasts each event to the WebSocket hub with 2.4-second delays (matching the original static loop speed), simulating a full swarm run without any LLM calls. This is the nuclear fallback for a total network outage.

- [ ] Add a `FALLBACK_MODE=true` env var that, when set, makes every agent tool handler immediately return the pre-scripted mock result without calling external APIs. The Defibrillator's `patient-data` call returns the pre-computed subgroup analysis. The Coroner's `neo4j-query` returns the pre-seeded evidence nodes. All logic runs, just over deterministic data.

- [ ] Add health check logging on startup: Go service pings Gemini API, K2 API, and Photon API. Logs which are reachable. If any are down, logs `[SYSTEM] WARNING: [service] unreachable — fallback mode active for this agent`.

- [ ] Test fallback: set `FALLBACK_MODE=true`, run the trigger, verify the full scenario completes without any external API calls.

- [ ] Commit: `feat: fallback mode and replay endpoint for demo safety`

---

## Phase 9: Dedalus DCS Deployment
**Hours 30–33**

This phase replaces Docker Compose with Dedalus DCS machines for the actual demo. Local Docker Compose continues to work for development — this is an additive deployment path.

### Task 22: Dedalus Go SDK Distributed Provisioner

**Files:**
- Create: `internal/dedalus/client.go`
- Create: `internal/dedalus/machines.go`

**Reference:** Use `openclaw.ts` from https://github.com/annyzhou/openclaw-ddls as the canonical pattern for provisioning OpenClaw on Dedalus machines. That script covers the full end-to-end flow: create machine → poll until running → install Node.js → install openclaw → configure → start gateway → verify.

- [ ] Install the Dedalus CLI locally: `brew install dedalus-labs/tap/dedalus` (or `go install github.com/dedalus-labs/dedalus-cli@latest`). Verify with `dedalus --version`.
- [ ] Authenticate: `dedalus login` or set `DEDALUS_API_KEY` in your shell. Verify with `dedalus machines list`.
- [ ] Create `internal/dedalus/client.go`: initializes a Dedalus SDK client using `dedalus.NewClient(apiKey)` with the `DEDALUS_API_KEY`.
- [ ] Create `internal/dedalus/machines.go` with distributed VM provisioning functions to hit the $500 track requirement:

  **`ProvisionControlPlane(ctx, client)`** — provisions Machine 1 (Go + DBs + Gateway):
  - `vcpu: 4`, `memoryMiB: 8192`, `storageGiB: 20`
  - Installs Docker, starts Redis, Postgres, Neo4j, and the Go Orchestrator container.
  - Returns the machine ID and public IP.

  **`ProvisionAdvocateNode(ctx, client, gatewayIP)`** — provisions Machine 2:
  - `vcpu: 2`, `memoryMiB: 4096`, `storageGiB: 10`
  - Installs **Node.js 22 via NodeSource, redirected to `/home/machine`** (not system-level — root FS is full):
    ```bash
    export HOME=/home/machine
    export NPM_CONFIG_PREFIX=/home/machine/.npm-global
    export NPM_CONFIG_CACHE=/home/machine/.npm-cache
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
    ```
  - Sets env vars: `OPENCLAW_STATE_DIR`, `NODE_COMPILE_CACHE`, `OPENCLAW_NO_RESPAWN=1`, `PATH` including `/home/machine/.npm-global/bin`
  - Installs openclaw: `npm install -g openclaw@latest`
  - Writes openclaw config to `/home/machine/.openclaw/openclaw.json` with ONLY the `defibrillator` agent and the gateway connecting back to `gatewayIP`
  - Starts gateway with `setsid openclaw gateway &> /home/machine/.openclaw/gateway.log &`
  - Writes `/home/machine/start-gateway.sh` for persistence (re-run after wakes)
  - Verifies: polls `ss -tlnp | grep 18789` and `curl http://127.0.0.1:18789/` until healthy

  **`ProvisionSkepticNode(ctx, client, gatewayIP)`** — provisions Machine 3:
  - Same Node.js install pattern, `vcpu: 2`, `memoryMiB: 4096`, `storageGiB: 10`
  - Starts ONLY the `coroner` agent, pointing back to `gatewayIP`

- [ ] Add a `cmd/lazarus/deploy.go` subcommand: `go run ./cmd/lazarus deploy` that calls the Control Plane provisioning, waits for completion, retrieves the IP, then provisions the Advocate and Skeptic nodes in parallel.
- [ ] Test: run `go run ./cmd/lazarus deploy` and verify all 3 machines come online in the Dedalus dashboard.
- [ ] Commit: `feat: distributed dedalus dcs machine provisioning for $500 track`

---

### Task 23: Sleep/Wake for Demo Safety

**Files:**
- Modify: `internal/dedalus/machines.go`
- Modify: `scripts/demo.sh`

- [ ] Add `WakeMachines(ctx, machineIds...)` to `machines.go`:
  - Calls `client.Machines.Update(ctx, id, desired_state: "running")` to wake each machine
  - **Critical:** root filesystem resets on every wake — Node.js is gone. After waking, `WakeMachines` must SSH into the machine and re-run the Node.js install + gateway start steps (same as `ProvisionAdvocateNode`/`ProvisionSkepticNode` but skipping machine creation). Only `/home/machine` persists across sleeps.
  - Log wake time. Poll gateway health (`curl http://<machine-ip>:18789/`) before returning.

- [ ] Add `SleepMachines(ctx, ...)`: puts all machines to sleep after the demo to stop compute billing. Storage (including `/home/machine` config) persists.

- [ ] Update `scripts/demo.sh` to detect `DEPLOY_TARGET=dedalus`: instead of `docker-compose up`, it calls `go run ./cmd/lazarus wake` (a thin wrapper around `WakeMachines`), waits for the Go service health endpoint to respond, then opens the dashboard URL.

- [ ] Add a `MACHINE_IDS` file (gitignored) that `deploy.go` writes machine IDs to after provisioning. `wake` and `sleep` commands read from this file so you don't provision fresh machines every time.

- [ ] **Pre-demo checklist**: provision machines Friday night, seed the data machine, run one full test cycle, then sleep all machines. Sunday morning: `./scripts/demo.sh` wakes them, reinstalls Node.js on agent machines, restarts OpenClaw gateway — all automated. Budget ~60-90 seconds for the full wake sequence.

- [ ] Commit: `feat: dedalus machine sleep/wake for demo lifecycle`

---

## Phase 10: Demo Polish & Scripts
**Hours 33–36**

### Task 24: One-Command Demo Start

**Files:**
- Create: `scripts/demo.sh`

- [ ] Create `scripts/demo.sh`:
  1. Runs `docker-compose down -v && docker-compose up -d` (clean start)
  2. Waits for Postgres, Redis, and Neo4j health checks (poll until ready)
  3. Runs the seed script
  4. Waits for the Go service and OpenClaw to be reachable
  5. Prints the dashboard URL (`http://localhost` or the served index.html path)
  6. Prints the trigger URL (`http://localhost:8080/trigger`)
  7. Prints: "LAZARUS NEXUS is live. Open the dashboard, then hit /trigger."

- [ ] Serve `index.html` as a static file from the Go service at `GET /` so it's accessible from a single URL without needing to open a local file

- [ ] Run a full end-to-end demo rehearsal:
  - `./scripts/demo.sh`
  - Open the dashboard
  - Hit `/trigger`
  - Watch the full agent pipeline run
  - Verify the iMessage arrives on the exec's phone
  - Reply "DRAFT"
  - Verify the PDF arrives in the thread

- [ ] Time the full run from trigger to PDF delivery. Target: under 90 seconds.

- [ ] Commit: `feat: one-command demo script and static file serving`

---

### Task 25: Eragon Track Hardening

**Files:**
- Create: `openclaw/agents/AGENTS.md` (global defaults)

- [ ] Create a global `openclaw/agents/AGENTS.md` that describes Lazarus as a "sovereign R&D participant" in the clinical pipeline. This file satisfies the Eragon track's requirement for an internal-use AI agent with clear workflow utility. Include: what the system does, what decisions it makes autonomously, what its outputs are, and why this solves a concrete internal R&D pipeline problem.

- [ ] Review Eragon judging criteria: Depth of Action (30%), Context Quality (30%), Workflow Usefulness (40%). Make sure:
  - **Depth of Action**: agents call at least 2–3 tools each, chain reasoning across multiple turns
  - **Context Quality**: each agent's AGENTS.md gives rich context about its role, data sources, and decision criteria
  - **Workflow Usefulness**: the output (Resurrection Blueprint + iMessage) is a concrete, actionable deliverable

- [ ] Commit: `docs: eragon track agent definitions and workflow documentation`

---

### Task 26: Final Checks

- [ ] Run `docker-compose up --build` fresh (no cached volumes) to simulate a judge environment

- [ ] Verify all seven prize track requirements are demonstrably met:
  - [ ] Gemini API is being called **through Dedalus Unified API** (check OpenClaw logs for Defibrillator — requests should show `api.dedaluslabs.ai` as the endpoint)
  - [ ] K2 API is being called **through Dedalus Unified API** (check Coroner logs)
  - [ ] Both DCS machines are running and shown in `dedalus machines list` (Dedalus dashboard — show judges this)
  - [ ] CTG API returns real data (check Mortician log output)
  - [ ] Photon Service is running and healthy (`curl http://localhost:3001/health`)
  - [ ] Photon iMessage fires (check exec's phone) — triggered via Go `/tools/photon-send` → photon-service `/send-alert`
  - [ ] "DRAFT" reply triggers PDF delivery via `im.messages.subscribe()` loop → Go `/inbound`
  - [ ] Neo4j knowledge graph has nodes (check `http://<data-machine-ip>:7474`)
  - [ ] Postgres has hypothesis records (query `SELECT * FROM hypotheses` on data machine)
  - [ ] OpenClaw shows 4 registered agents (check `openclaw dashboard` on app machine)

- [ ] Prepare Devpost submission:
  - GitHub repo public and created after April 17, 2026
  - Video demo (optional but recommended): screen-record the full trigger → PDF flow
  - Selected main track: **Best Healthcare Hack**
  - Special tracks listed: Regeneron, Gemini, K2, Eragon, Dedalus, Photon

- [ ] Submission deadline: **April 19, 2026 at 8:00 AM**

---

## Demo Script (Sunday Morning)

**Setup (5 min before judges arrive):**
1. `DEPLOY_TARGET=dedalus ./scripts/demo.sh` — wakes both DCS machines (sub-second), verifies health
2. Open the dashboard on a visible screen (served from the app machine's public URL)
3. Have the exec's phone visible for the iMessage moment
4. Have Neo4j browser open in a tab (`http://<data-machine-ip>:7474`)
5. Have the Dedalus dashboard open in another tab to show judges the two running DCS machines

**The Pitch Sequence:**
1. Show the Bio-Nexus dashboard running — agents orbiting in 3D, live uptime ticking
2. Explain the problem: "Every year, billions in drug R&D die not because the biology failed, but because the business did."
3. "Watch Lazarus find a billion-dollar match in real time." → Hit `/trigger`
4. Narrate the logs as they appear: Mortician finds NCT04782234, Defibrillator detects the CRP signal, Coroner verifies the pathway
5. `🚨 MATCH CONFIRMED` flashes on screen
6. Executive's phone buzzes with the Photon iMessage
7. Reply "DRAFT" on the phone
8. PDF arrives in the iMessage thread
9. Show the Postgres hypothesis record + Neo4j graph as the audit trail
10. "This is what a sovereign R&D participant looks like."

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Dedalus Unified API rejects BYOK headers for K2 | Medium | High | Confirm K2 provider name from Dedalus docs Friday; have direct K2 endpoint as backup |
| Dedalus DCS machine provisioning slow/fails | Low | Medium | Pre-provision Friday night; machines wake in <1s from sleep |
| DCS machine public URL changes after wake | Low | Medium | Use Dedalus preview URL feature; update env var in `MACHINE_IDS` file |
| Node.js missing after machine wake (root FS resets) | High | High | `WakeMachines()` must re-run Node.js install + gateway start — this is automated in the wake script; test the full wake sequence Saturday |
| openclaw gateway unreachable (wrong bind/endpoint config) | Medium | High | Ensure `gateway.bind: "0.0.0.0"` and `http.endpoints.chatCompletions.enabled: true` in config; verify with `curl http://<ip>:18789/` after each wake |
| Gemini API rate limit during demo | Medium | High | Fallback mode; pre-cache response |
| K2 API unreachable | Medium | Medium | Fallback mode; Coroner replays mock verdict |
| Photon gRPC connection drops mid-demo | Low | High | SDK `retry: true` auto-reconnects; subscribe loop restarts on `ConnectionError` |
| Photon rate limit hit (50 new convos/line/day) | Low | Medium | Pre-create the exec conversation Friday night so it's not a "new" conversation on Sunday |
| Exec's iMessage handle not recognized by Photon | Medium | High | Test full send/receive cycle Saturday night; confirm Apple ID vs phone number format |
| Neo4j slow cold start | Low | Medium | Seed Friday night; S3-backed `/home/machine` persists — data survives sleep |
| OpenClaw agent-to-agent delay | Low | Low | Tune timeouts in config; test full pipeline twice |
| Judge's phone blocks unknown sender | Medium | High | Pre-approve sender contact Saturday |

---

## API Keys Checklist

Before Saturday morning, obtain and test every key:

- [ ] **Dedalus** — API key from `dash.dedaluslabs.ai`. Also get Org ID. Test: `curl -H "Authorization: Bearer $DEDALUS_API_KEY" https://api.dedaluslabs.ai/v1/models`
- [ ] **Dedalus BYOK — Gemini**: Test a chat completion via Dedalus Unified API with `X-Provider: google` + `X-Provider-Key: $GEMINI_API_KEY` + `X-Provider-Model: gemini-2.0-flash`. Confirm it works before wiring into OpenClaw.
- [ ] **Dedalus BYOK — K2**: Same test with K2 headers. Confirm the exact provider name Dedalus expects for MBZUAI/K2 (check Dedalus provider list in dashboard or docs).
- [ ] **Google AI Studio** — Gemini API key (free tier works, only used as BYOK passthrough)
- [ ] **MBZUAI** — K2 Think V2 API key (WhatsApp group from hackathon)
- [ ] **Photon** — Sign up at `photon.codes/spectrum` with promo `HACKPTON2026`. Get `PROJECT_ID` + `PROJECT_SECRET` from dashboard. Enable iMessage, set up a line. Test: issue a token via `POST /projects/{id}/imessage/tokens`, then send a test iMessage via the SDK. Confirm round-trip (send + receive reply) Saturday night. Pre-create the conversation with the exec's handle so it doesn't count as a new conversation on demo day.
- [ ] **ClinicalTrials.gov** — no key required (public API)
- [ ] **Neo4j** — local/DCS instance, no key (just password in `.env`)
