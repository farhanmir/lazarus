# Lazarus — Team Contracts

This file is the single source of truth for every interface between the four parallel workstreams. Read your member section completely before touching any code. Do not change anything defined here without a team sync — a broken contract breaks everyone else.

---

## Team Assignments

| Member | Owns | Directories / Files |
|---|---|---|
| **Member 1** | Go data layer + tool server + PDF + Photon client | `cmd/`, `internal/`, `data/`, `go.mod`, `go.sum` |
| **Member 2** | WebSocket hub + frontend live connection | `internal/websocket/`, `index.html` |
| **Member 3** | OpenClaw agent definitions | `openclaw/` |
| **Member 4** | Infrastructure + Photon TypeScript service + deployment | `docker-compose.yml`, `Dockerfile`, `photon-service/`, `scripts/`, `.env.example` |

**One rule:** never edit a file owned by another member without asking first. The only shared file is `cmd/lazarus/main.go` — the handoff protocol is defined in Contract 6.

---

## Environment Variables

All members depend on these. Member 4 creates `.env.example`. Everyone creates their own `.env` locally from it. For local dev outside Docker, replace Docker service hostnames with `localhost`.

| Variable | Used By | Purpose |
|---|---|---|
| `DEDALUS_API_KEY` | Members 1, 3, 4 | Dedalus dashboard API key — used for DCS machine management and as the API key for Unified API routing |
| `DEDALUS_ORG_ID` | Member 4 | Required for DCS machine operations (`X-Dedalus-Org-Id` header) |
| `GEMINI_API_KEY` | Member 3 | Google AI Studio key — passed as BYOK through Dedalus Unified API; never called directly |
| `K2_API_KEY` | Member 3 | MBZUAI K2 Think V2 key — passed as BYOK through Dedalus Unified API |
| `K2_PROVIDER_MODEL` | Member 3 | K2 model name string as Dedalus expects it (confirm from MBZUAI docs) |
| `PHOTON_PROJECT_ID` | Member 4 | From Photon dashboard — used to issue iMessage gRPC tokens |
| `PHOTON_PROJECT_SECRET` | Member 4 | From Photon dashboard — used in Basic auth for token issuance |
| `PHOTON_IMESSAGE_TARGET` | Members 1, 3, 4 | Exec's iMessage handle (phone number or Apple ID email) |
| `PHOTON_SERVICE_URL` | Member 1 | Internal URL of the photon-service (e.g. `http://photon-service:3001`) |
| `GO_SERVICE_URL` | Member 4 | URL the photon-service uses to POST inbound replies back to Go |
| `POSTGRES_DSN` | Member 1 | Full Postgres connection string |
| `REDIS_URL` | Member 1 | Redis connection string |
| `NEO4J_URI` | Member 1 | Neo4j bolt connection URI |
| `NEO4J_USER` | Member 1 | Neo4j username |
| `NEO4J_PASSWORD` | Member 1 | Neo4j password |
| `OPENCLAW_HOME` | Members 3, 4 | Path to the `openclaw/` workspace directory |
| `OPENCLAW_STATE_DIR` | Members 3, 4 | Path where OpenClaw stores its runtime state (e.g. `/home/machine/.openclaw` on DCS, container-local on Docker) |
| `NODE_COMPILE_CACHE` | Member 4 | Node.js compile cache directory — must point inside `/home/machine` on DCS machines to avoid root FS exhaustion |
| `OPENCLAW_NO_RESPAWN` | Member 4 | Set to `1` — disables OpenClaw's internal respawn loop so the process can be managed externally |
| `DEPLOY_TARGET` | Member 4 | `local` for Docker Compose, `dedalus` for DCS machines |
| `FALLBACK_MODE` | Member 1 | `true` causes every tool handler to return pre-scripted mock data without calling external APIs |
| `CONTROL_PLANE_IP` | Members 1, 4 | Public IP of the Dedalus Control Plane machine (set after provisioning, used by demo.sh) |

---

## Contract 1: LogEvent — WebSocket Message Shape

The LogEvent is the universal event object broadcast from Go to all connected WebSocket clients and replayed from the database on connect. It must be structurally identical in every system that produces or consumes it: the Go tool handlers (Member 1), the WebSocket hub (Member 2), and the fallback replay endpoint (Member 4). There is exactly one definition — Member 2 defines the Go type in `internal/websocket/hub.go` and Member 1 imports it.

### Fields

| Field | Type | Description |
|---|---|---|
| `timestamp` | string, RFC3339 | When the event occurred, e.g. `2026-04-19T08:15:22Z` |
| `agent_id` | string | One of the canonical Agent ID values listed below — exact string match required |
| `name` | string | Human-readable agent name corresponding to the agent_id |
| `category` | string | One of the canonical Category values listed below |
| `message` | string | The agent's log message to display in the dashboard |
| `confidence` | float, 0.0–1.0 | Statistical confidence score; use `0` when not applicable |
| `metadata` | object or null | Optional extra payload (e.g., `subgroup_size`, `p_value`) |

### Agent ID Values

Use exactly these strings. Any deviation breaks frontend CSS class mapping and the log display.

| agent_id | Human-readable name | Frontend CSS class |
|---|---|---|
| `THE_MORTICIAN` | The Mortician | `system` |
| `THE_DEFIBRILLATOR` | The Defibrillator (Gemini 4) | `advocate` |
| `THE_CORONER` | The Coroner (K2 Think V2) | `skeptic` |
| `THE_HIGH_PRIEST` | The High Priest | `judge` |
| `SYSTEM` | Lazarus Nexus | `system` |
| `PHOTON` | Photon Spectrum | `alert` |

### Category Values

Use exactly these strings:

- `SOURCING` — Mortician fetching trial candidates
- `HYPOTHESIS_GENERATION` — Defibrillator forming a repurposing hypothesis
- `VERIFICATION` — Coroner running falsification analysis
- `JUDGMENT` — High Priest rendering final verdict
- `ALERT` — Photon iMessage events
- `SYSTEM` — Internal infrastructure events

---

## Contract 2: Go HTTP Tool Endpoints

Member 1 implements all of these. Member 3's OpenClaw TOOLS.md files call them. Member 4's Photon service calls `/inbound`. Do not rename or restructure these URLs.

All endpoints accept and return `application/json`. On failure, they return an object with a single `error` string field and an appropriate 4xx or 5xx status. All listen on port `8080`.

When `FALLBACK_MODE=true`, every handler must return pre-scripted mock data and skip all external API calls and database queries. This check must happen at the top of each handler before any other logic.

---

### POST /tools/ctg-fetch

**Called by:** The Mortician (OpenClaw)

**Request:** Empty body — no parameters needed.

**Behavior:** Fetches terminated and withdrawn trials from the ClinicalTrials.gov API v2. Upserts results into the `clinical_trials` Postgres table. Applies a demo guard: if `NCT04782234` (the Zeloprin trial) is not in the live response, it is injected from the pre-seeded database record. The demo scenario must always be present in the response regardless of live API results.

**Response:** A JSON array of trial objects. Each entry contains:
- `nct_id` — the NCT identifier string
- `title` — study title
- `phase` — trial phase (e.g. `PHASE2`)
- `status` — `TERMINATED` or `WITHDRAWN`
- `condition` — disease/condition name
- `sponsor` — sponsoring organization
- `failure_reason` — reason for discontinuation

---

### POST /tools/patient-data

**Called by:** The Defibrillator (OpenClaw)

**Request fields:**
- `nct_id` — string, required — the trial to analyze
- `subgroup_filter` — object or null — when null, all subgroup breakdowns are returned

**CRITICAL RIGOR CONTRACT:** The Go backend must calculate the `p_value` for each subgroup using a deterministic Fisher's Exact Test algorithm applied to the target cohort vs. the control cohort. The LLM must not generate or infer this value. The mock dataset must be constructed so the calculation natively produces `p < 0.001` for the target cluster (Female, age 65+, LBXCRP > 3.0).

**Response fields:**
- `total_patients` — integer count of all patients in the dataset
- `cohort_summary` — object containing `mean_lbxgh`, `mean_lbxcrp`, `mean_efficacy_delta` across the full cohort
- `subgroups` — array of subgroup breakdown objects, each containing:
  - `label` — human-readable subgroup name
  - `n` — patient count
  - `riagendr` — gender code (1=male, 2=female)
  - `min_age` — minimum age cutoff
  - `crp_threshold` — minimum CRP level cutoff
  - `mean_lbxgh`, `mean_lbxcrp`, `mean_efficacy_delta` — mean biomarker values
  - `p_value` — deterministically calculated; not LLM-generated

---

### POST /tools/neo4j-query

**Called by:** The Defibrillator, The Coroner (OpenClaw)

**Request fields:**
- `cypher` — string — a read-only Cypher query
- `params` — object — query parameters (can be empty)

**Safety constraint:** The handler rejects any query containing `CREATE`, `MERGE`, `DELETE`, or `SET` with a 400 error. Only `MATCH` queries are permitted. Agents cannot corrupt the knowledge graph.

**Response fields:**
- `results` — array of result objects, one per row returned by Neo4j

---

### POST /tools/save-hypothesis

**Called by:** The Defibrillator (OpenClaw)

**Request fields:**
- `trial_nct_id` — string — the source trial's NCT ID
- `title` — string — short hypothesis title
- `summary` — string — one-paragraph narrative of the repurposing argument
- `subgroup_definition` — string — human-readable description of the target patient cluster
- `advocate_score` — float (0.0–1.0) — Defibrillator's confidence in the hypothesis

**Behavior:** Writes a new record to the `hypotheses` Postgres table with `status = PENDING`. Creates a `RepurposingHypothesis` node in Neo4j linked to the relevant Drug, Disease, and Target nodes. Returns the new `hypothesis_id` UUID.

**Response fields:**
- `hypothesis_id` — UUID string of the newly created hypothesis

---

### PATCH /tools/update-hypothesis

**Called by:** The Coroner and The High Priest (OpenClaw)

**Request fields (all optional except `hypothesis_id`):**
- `hypothesis_id` — UUID string, required
- `advocate_score` — float (0.0–1.0)
- `skeptic_score` — float (0.0–1.0)
- `judge_score` — float (0.0–1.0)
- `final_confidence` — float (0.0–1.0)
- `status` — string, one of: `PENDING`, `ADVOCATED`, `VERIFIED`, `RESCUED`, `REJECTED`

**Behavior:** Updates both the Postgres `hypotheses` table and the corresponding Neo4j node. Only provided fields are updated.

**Response:** A success acknowledgement object with field `ok: true`.

---

### POST /tools/generate-pdf

**Called by:** The High Priest (OpenClaw)

**Request fields:**
- `hypothesis_id` — UUID string of the hypothesis to render

**Behavior:** Looks up the hypothesis by ID from Postgres (including all scores and subgroup data). Generates a one-page PDF blueprint using the `gofpdf` library. Writes the PDF to `/tmp/blueprints/blueprint-{hypothesis_id}.pdf` — this path is on the shared Docker volume (see Contract 5).

**Response fields:**
- `pdf_path` — full file path of the generated PDF

---

### POST /tools/photon-send

**Called by:** The High Priest (OpenClaw)

**Request fields:**
- `target` — string — the exec's iMessage handle (phone number or Apple ID)
- `message` — string — the alert message text
- `pdf_path` — string or null — null for the initial alert; the Go service handles PDF delivery separately via `/inbound`

**Behavior:** Calls the Photon TypeScript service's `/send-alert` endpoint over HTTP. The Go service does not touch gRPC or the Photon SDK — that is entirely Member 4's concern. When `pdf_path` is null, only the text alert is sent.

**Response:** A success acknowledgement object with field `ok: true`.

---

### POST /tools/replay

**Called by:** Demo operator (browser or curl) — fallback only

**Request:** Empty body.

**Behavior:** Reads `data/swarm_logs.json` and spawns a background goroutine that broadcasts each event to the WebSocket hub with a 2.4-second delay between events. Returns immediately without waiting for the replay to complete. This is the nuclear fallback for total network outage — the dashboard fills as if agents are running live.

**Response fields:**
- `status` — string `"replay_started"`
- `events` — integer count of events scheduled for broadcast

---

### POST /trigger and GET /trigger

**Called by:** Browser, demo script (not OpenClaw)

**Behavior:**
1. Broadcasts a SYSTEM category LogEvent to all WebSocket clients announcing the start of swarm iteration 083
2. POSTs to the OpenClaw gateway at `http://openclaw:18789/v1/chat/completions` with model `openclaw/mortician` and the start command to begin a CTG scan
3. Returns immediately — the rest of the pipeline is asynchronous

`GET /trigger` exists for browser convenience (open URL in a tab). It has identical behavior to `POST /trigger`.

**Response fields:**
- `status` — string `"triggered"`
- `iteration` — integer `83`

---

### POST /inbound

**Called by:** Photon TypeScript service (Member 4) when exec replies "DRAFT"

**Request fields:**
- `chat` — string — the chat identifier from the incoming iMessage event
- `sender` — string — the sender handle

**Behavior:**
1. Looks up the most recent hypothesis with `status = RESCUED` from Postgres
2. Calls the PDF generator to produce the blueprint
3. Calls `internal/photon/client.go`'s `SendFile` method to deliver the PDF via the Photon service
4. Broadcasts a PHOTON category LogEvent to the WebSocket hub confirming delivery

**Response:** A success acknowledgement object with field `ok: true`.

---

### GET /ws

**Called by:** `index.html` (Member 2)

**Behavior:** Upgrades the HTTP connection to WebSocket. On connect, queries the `swarm_events` Postgres table for the last 20 rows ordered by timestamp descending and sends each as an individual JSON frame to the new client. The client is then subscribed to all live broadcasts. Frame format is the LogEvent shape from Contract 1.

---

### GET /

**Called by:** Browser

**Behavior:** Serves `index.html` as a static file. No JSON.

---

## Contract 3: Photon Service HTTP API

Member 4 implements this TypeScript service. Member 1 calls it from `internal/photon/client.go`. The service runs on port `3001`. Member 1 must not know anything about gRPC, token issuance, or the Photon SDK — that is entirely encapsulated inside the photon-service.

---

### POST /send-alert

**Called by:** Go service (`internal/photon/client.go`)

**Request fields:**
- `target` — string, required — iMessage handle (phone number or Apple ID)
- `message` — string, required — alert text

**Behavior:** Uses the already-initialized Photon gRPC client to send an iMessage to `target`. Returns 400 if `target` is missing. Returns 502 if the underlying gRPC call fails.

**Response fields:**
- `ok` — boolean `true` on success
- `error` — string describing the failure (only present on failure)

---

### POST /send-file

**Called by:** Go service (`internal/photon/client.go`)

**Request fields:**
- `target` — string, required — iMessage handle
- `file_path` — string, required — absolute path to the PDF on the shared volume

**Behavior:** Uploads the file at `file_path` as an iMessage attachment, then sends it to `target`. The `file_path` must be accessible from the photon-service container — it reads from the shared `blueprints` Docker volume mounted at `/tmp/blueprints`. Returns 400 if either field is missing.

**Response:** Same shape as `/send-alert`.

---

### GET /health

**Called by:** Go service startup check, demo operators

**Response fields:**
- `status` — string `"ok"`
- `photon_connected` — boolean — `false` if gRPC token issuance failed at startup

**Behavior:** The Go service logs a startup warning if `photon_connected` is `false`.

---

## Contract 4: OpenClaw Tool URL Format

Member 3 writes tool URLs in each agent's `TOOLS.md` file. The Go service host inside Docker Compose is `go-service`. The base URL inside the Docker network is always `http://go-service:8080`.

**Tool URL reference (for TOOLS.md files):**

| Tool name | Method | URL |
|---|---|---|
| `ctg-fetch` | POST | `http://go-service:8080/tools/ctg-fetch` |
| `patient-data` | POST | `http://go-service:8080/tools/patient-data` |
| `neo4j-query` | POST | `http://go-service:8080/tools/neo4j-query` |
| `save-hypothesis` | POST | `http://go-service:8080/tools/save-hypothesis` |
| `update-hypothesis` | PATCH | `http://go-service:8080/tools/update-hypothesis` |
| `generate-pdf` | POST | `http://go-service:8080/tools/generate-pdf` |
| `photon-send` | POST | `http://go-service:8080/tools/photon-send` |

**Distributed topology note:** For local Docker Compose testing, `go-service:8080` is correct. For the Dedalus multi-VM deployment where agents run on separate DCS machines, Member 4's provisioning script injects the Control Plane's public IP into each agent machine's OpenClaw environment config in place of `go-service`.

---

## Contract 5: Shared Volume for PDF Files

Both `go-service` and `photon-service` must be able to read and write from the same path for PDF handoff. Member 4 defines a named Docker volume called `blueprints` and mounts it at `/tmp/blueprints` on both services. Member 1 writes all generated PDFs to `/tmp/blueprints/blueprint-{hypothesis_id}.pdf`. Member 4's `/send-file` endpoint reads from the same path using the same volume mount. No other sharing mechanism is used.

---

## Contract 6: `cmd/lazarus/main.go` Handoff

Member 1 owns `main.go` but Member 2 needs to wire in the WebSocket hub. To avoid blocking either member:

**Member 1** writes `main.go` with a clearly marked stub comment block in the exact location where the hub wires in. The stub is three commented-out lines showing the intended wiring pattern, preceded by a `TODO(member2)` marker. Member 1 defines a `Deps` struct that includes a `Hub` field typed as the `HubBroadcaster` interface (defined by Member 2). Every call to `deps.Hub.Broadcast()` throughout the codebase is guarded by a nil check so the service compiles and runs before Member 2's code is merged.

**Member 2** submits a single targeted PR that replaces only the stub comment block with the real hub initialization and wiring. Member 2 does not touch anything else in `main.go`.

**The `Deps` struct** (defined by Member 1) contains: a Postgres connection, a Redis client, a Neo4j driver, the loaded Config, and a `Hub` field of type `HubBroadcaster`.

**The `HubBroadcaster` interface** (defined by Member 2 in `internal/websocket/hub.go`) exposes a single `Broadcast` method that accepts a LogEvent. Member 1 imports this interface type. This allows Member 1 to compile without Member 2's concrete implementation.

---

## Contract 7: Go Module Path

The Go module is `github.com/lazarus`. All internal packages use this as the import path prefix, for example `github.com/lazarus/internal/db` or `github.com/lazarus/internal/websocket`. Member 1 initializes the module and commits `go.mod` before anyone else begins writing Go. The module path must not change.

**Required Go dependencies** (Member 1 adds all of these):
- `github.com/jackc/pgx/v5` — Postgres driver
- `github.com/redis/go-redis/v9` — Redis client
- `github.com/neo4j/neo4j-go-driver/v5` — Neo4j driver
- `github.com/gorilla/websocket` — WebSocket server
- `github.com/jung-kurt/gofpdf` — PDF generation
- `github.com/joho/godotenv` — `.env` loading
- `github.com/dedalus-labs/dedalus-sdk-go` — Dedalus Go SDK for DCS machine provisioning

---

## Contract 8: OpenClaw Agent IDs and Gateway API

Member 3 registers these agent IDs in `openclaw/config.json`. These exact strings are what the Go `/trigger` endpoint uses when POSTing to the OpenClaw gateway, and what agents use when routing messages to each other via `agentToAgent`. Do not rename them.

**Agent IDs:**
- `mortician`
- `defibrillator`
- `coroner`
- `highpriest`

**Gateway API:** The OpenClaw gateway listens on port `18789` and exposes an OpenAI-compatible completions endpoint at `POST /v1/chat/completions`. The `model` field in the request body uses the `openclaw/<agent-id>` prefix format — for example, the trigger endpoint sends model `openclaw/mortician` to activate the Mortician. This prefix is required by OpenClaw's model routing and differs from passing the raw agent ID.

**All four model targets:**
- `openclaw/mortician`
- `openclaw/defibrillator`
- `openclaw/coroner`
- `openclaw/highpriest`

**Gateway configuration requirements** (Member 3 sets in `config.json`):
- `gateway.mode` must be `"local"`
- `gateway.bind` must be `"0.0.0.0"` so Go can reach the gateway from another container or machine
- `gateway.port` must be `18789`
- `gateway.http.endpoints.chatCompletions.enabled` must be `true` — without this, the HTTP completions endpoint is not exposed and the trigger will fail silently
- `agents.agentToAgent.enabled` must be `true` in defaults
- Agent-to-agent routing is unidirectional: `mortician → defibrillator → coroner → highpriest` only
- Both LLM providers (`gemini-via-dedalus` and `k2-via-dedalus`) route through `https://api.dedaluslabs.ai/v1` using BYOK headers (`X-Provider`, `X-Provider-Key`, `X-Provider-Model`)

---

## Contract 9: Postgres Table Names

Member 1 creates these tables. Member 4's seed script references them by name. Do not rename.

| Table | Purpose |
|---|---|
| `swarm_events` | Full event audit log — every LogEvent broadcast is persisted here asynchronously |
| `patients` | Mock NHANES-structured patient dataset loaded from `data/patients_mock.json` |
| `clinical_trials` | Terminated/withdrawn trial records fetched by the Mortician and upserted here |
| `hypotheses` | Core business record — one row per repurposing hypothesis with all agent scores and status |

**Event persistence requirement:** Every call to `hub.Broadcast()` must also write the LogEvent to `swarm_events` asynchronously (in a goroutine). This enables the replay-on-connect feature in the WebSocket handler and provides a queryable audit trail for judges.

---

## Contract 10: Docker Compose Service Names

Member 4 defines these service names. All other members reference them by name inside the Docker network.

| Service | Internal address | Purpose |
|---|---|---|
| `redis` | `redis:6379` | In-memory pub/sub and caching |
| `postgres` | `postgres:5432` | Primary relational database |
| `neo4j` | `neo4j:7687` (bolt), `neo4j:7474` (browser) | Knowledge graph |
| `go-service` | `go-service:8080` | Go orchestrator — HTTP tool server + WebSocket hub |
| `openclaw` | `openclaw:18789` | OpenClaw gateway — hosts all four agents |
| `photon-service` | `photon-service:3001` | Photon TypeScript sidecar — handles all iMessage gRPC |
| `seed` | one-shot, exits after seeding | Runs DB seed on startup; `restart: no` |

**Named volumes:** `blueprints` (shared PDF storage), `postgres_data`, `neo4j_data`, `redis_data`, `openclaw_home` (OpenClaw runtime state persistence across container restarts).

---

## Contract 11: OpenClaw on Dedalus Machines

This contract governs how Member 4 provisions and manages OpenClaw on DCS machines. The canonical reference is `openclaw.ts` in https://github.com/annyzhou/openclaw-ddls.

**Machine specifications:**
- Advocate node (Defibrillator): 2 vCPU, 4096 MiB RAM, 10 GiB storage
- Skeptic node (Coroner): 2 vCPU, 4096 MiB RAM, 10 GiB storage

**Critical constraint — storage layout:** The root filesystem on Dedalus machines is 60–70% OS-reserved. All packages, npm globals, and OpenClaw state must be installed under `/home/machine`, not under system paths. Violating this causes install failures.

**Required environment variables on each agent machine** (set before starting the gateway):
- `PATH` must include `/home/machine/.npm-global/bin`
- `HOME` must be `/home/machine`
- `OPENCLAW_STATE_DIR` must be `/home/machine/.openclaw`
- `NODE_COMPILE_CACHE` must be `/home/machine/.compile-cache`
- `OPENCLAW_NO_RESPAWN` must be `1`

**Node.js installation:** Use NodeSource to install Node.js 22 (minimum; 24 recommended), with npm globals, cache, and temp directories all redirected to `/home/machine`. This must be done before installing openclaw.

**Gateway startup:** No systemd is available. Start the gateway using `setsid openclaw gateway` as a detached foreground process. Write a persistent startup script to `/home/machine/start-gateway.sh` that re-exports all required env vars and re-starts the gateway — this script is called again on every machine wake.

**Gateway health verification:** After starting, verify the gateway is up by checking that port 18789 is bound and that an HTTP request to `http://127.0.0.1:18789/` returns HTTP 200. Also run `openclaw gateway call health` via the RPC interface.

**Wake-after-sleep behavior (critical):** When a Dedalus machine wakes from sleep, only `/home/machine` (binary, config, data) persists. The root filesystem resets — Node.js is gone. The `WakeMachines` function must therefore do more than change machine state to "running": it must SSH into each agent machine, re-run the full Node.js installation, and re-execute the gateway startup script. Simply calling `Machines.Update` is not sufficient. Member 4 must test the full wake-reinstall-restart sequence on Saturday to confirm it works within the demo time budget.

**MACHINE_IDS file:** After initial provisioning, `deploy.go` writes all machine IDs to a gitignored `MACHINE_IDS` file. The `wake` and `sleep` subcommands read from this file so machines are not re-provisioned on every run.

---

## Member 1 — Full Briefing

You are building the Go backend. This is the most critical workstream — everything else depends on your HTTP endpoints being up.

### Your files

- `cmd/lazarus/main.go` — entry point, wiring only
- `cmd/lazarus/deploy.go` — `deploy`, `wake`, `sleep` subcommands
- `go.mod` / `go.sum`
- `internal/config/config.go` — env var loading, Config struct
- `internal/db/postgres.go` — Postgres client + inline schema migrations
- `internal/db/redis.go` — Redis client + channel name constants
- `internal/db/neo4j.go` — Neo4j client + health check
- `internal/seed/seed_postgres.go` — bulk insert from `patients_mock.json`
- `internal/seed/seed_neo4j.go` — Cypher seed for knowledge graph
- `internal/tools/server.go` — HTTP server setup, route registration
- `internal/tools/ctg.go` — `/tools/ctg-fetch` handler
- `internal/tools/patients.go` — `/tools/patient-data` handler with Fisher's Exact Test
- `internal/tools/graph.go` — `/tools/neo4j-query` handler
- `internal/tools/hypothesis.go` — `/tools/save-hypothesis` and `/tools/update-hypothesis` handlers
- `internal/tools/trigger.go` — `/trigger` handler
- `internal/tools/replay.go` — `/tools/replay` fallback handler (coordinated with Member 4)
- `internal/pdf/generator.go` — blueprint PDF renderer
- `internal/photon/client.go` — thin HTTP client to photon-service
- `internal/dedalus/client.go` — Dedalus SDK wrapper (coordinated with Member 4)
- `internal/dedalus/machines.go` — DCS provisioning functions (coordinated with Member 4)
- `data/patients_mock.json` — 500+ mock NHANES patient records
- `data/swarm_logs.json` — scripted fallback log sequence
- `data/blueprint_rescue.json` — RX-782 blueprint metadata template

### Do not touch

`index.html`, `internal/websocket/`, `openclaw/`, `photon-service/`, `docker-compose.yml`, `Dockerfile`

### Key behavioral requirements

**`main.go` stub:** Write with the `TODO(member2)` comment block exactly as described in Contract 6. Define the `Deps` struct including a `Hub HubBroadcaster` field. Guard every `deps.Hub.Broadcast()` call with a nil check so the service compiles and runs without Member 2's code present.

**FALLBACK_MODE:** When `FALLBACK_MODE=true`, every tool handler returns pre-scripted mock data and skips all external API calls and database queries. This check must be the first thing in each handler. Non-negotiable for demo safety.

**PDF path:** Write all generated PDFs to `/tmp/blueprints/blueprint-{hypothesis_id}.pdf`. Not bare `/tmp/`. The blueprints Docker volume is mounted there by Member 4.

**Photon client (`internal/photon/client.go`):** Thin HTTP client only. Calls `PHOTON_SERVICE_URL/send-alert` and `PHOTON_SERVICE_URL/send-file`. Does not know anything about gRPC, token issuance, or the Photon SDK.

**Demo guard in `/tools/ctg-fetch`:** After fetching live CTG data, check if `NCT04782234` is present. If not, inject it from the pre-seeded `clinical_trials` table. The demo scenario must always be present.

**`/inbound` handler:** On DRAFT reply from exec, look up the most recent `status = RESCUED` hypothesis from Postgres, generate the PDF, call `photon.SendFile()`, then broadcast a PHOTON LogEvent to the hub.

**`patients_mock.json` constraint:** At least 500 patient records. The subset where `RIAGENDR=2` AND `RIDAGEYR>=65` AND `LBXCRP>3.0` AND `DRUG_EXPOSURE>0` must have average `EFFICACY_DELTA` ≈ 84%. All other subgroups must show near-zero or negative delta. Validate the mock data so Fisher's Exact Test natively produces `p < 0.001` for the target cluster.

**Event persistence:** Every `hub.Broadcast()` call must also write the LogEvent to `swarm_events` in a non-blocking goroutine.

### All HTTP endpoints you must implement

See Contract 2 for full behavioral specifications:
- `POST /tools/ctg-fetch`
- `POST /tools/patient-data`
- `POST /tools/neo4j-query`
- `POST /tools/save-hypothesis`
- `PATCH /tools/update-hypothesis`
- `POST /tools/generate-pdf`
- `POST /tools/photon-send`
- `POST /tools/replay`
- `POST /trigger` and `GET /trigger`
- `POST /inbound`
- `GET /ws` (route registration — Member 2 implements the hub, you register the route)
- `GET /` (serve `index.html` as static file)

---

## Member 2 — Full Briefing

You are building the WebSocket broadcast hub and connecting the frontend to it.

### Your files

- `internal/websocket/hub.go` — broadcast hub + LogEvent type + HubBroadcaster interface
- `internal/websocket/handler.go` — WebSocket upgrade handler
- `index.html` — targeted changes only (see below)

### Do not touch

Anything in `cmd/`, `internal/config/`, `internal/db/`, `internal/tools/`, `internal/pdf/`, `internal/photon/`, `internal/seed/`, `internal/dedalus/`, `openclaw/`, `photon-service/`, `docker-compose.yml`

### Key behavioral requirements

**`HubBroadcaster` interface:** Define this in `internal/websocket/hub.go`. It exposes a single `Broadcast(event LogEvent)` method. Member 1 imports this interface — it must be in this package, named exactly `HubBroadcaster`.

**LogEvent type:** Also define the LogEvent struct in `internal/websocket/hub.go`, matching exactly the field names, types, and JSON tags from Contract 1. Member 1 imports and uses this type.

**Hub internals:** Use Go channels for broadcast fan-out — no mutexes in the hot path. The hub maintains a registry of connected client channels. `Broadcast()` sends to each channel non-blocking: if a client channel is full, the event is dropped for that client rather than blocking all others.

**WebSocket handler:** The `GET /ws` handler upgrades the connection, queries `swarm_events` for the last 20 rows ordered by timestamp descending, sends each as a JSON frame to the new client, then subscribes the client to live broadcasts. Requires access to the Postgres connection via the `Deps` struct.

**`main.go` handoff:** After Member 1 commits their stub, submit a PR replacing only the `TODO(member2)` block with hub initialization and wiring (instantiate the hub, start its goroutine, assign it to `deps.Hub`). Touch nothing else in `main.go`.

**`index.html` changes — minimal and targeted:**

The existing `index.html` has a static `LOGS` array and a `setInterval` loop. Replace that mechanism with a live WebSocket connection while keeping the existing array as a fallback:

1. Add a WebSocket connection to `ws://localhost:8080/ws`, configurable via a constant at the top of the script block
2. On `ws.onmessage`: parse the JSON frame as a LogEvent, map `agent_id` to CSS class using the table in Contract 1, call the existing log-rendering function
3. On `ws.onclose` or `ws.onerror`: fall back to the existing `setInterval` loop
4. Add a Heart Rate Monitor — a Canvas or SVG EKG visualization that flatlines until a LogEvent with a significant `p_value` in its metadata is received, at which point it spikes to a heartbeat
5. Add a Live Graph — a real-time node visualization (D3.js or Force Graph) that expands target and disease nodes when `neo4j-query` log messages arrive

**AgentID to CSS class mapping:**

| agent_id | CSS class |
|---|---|
| `THE_MORTICIAN` | `system` |
| `THE_DEFIBRILLATOR` | `advocate` |
| `THE_CORONER` | `skeptic` |
| `THE_HIGH_PRIEST` | `judge` |
| `SYSTEM` | `system` |
| `PHOTON` | `alert` |

**Testing without Member 1:** Write a minimal local Go file (not committed to the repo) that serves a WebSocket on `:8080/ws` and broadcasts a test LogEvent every 2 seconds. Use this to develop and verify frontend changes independently.

---

## Member 3 — Full Briefing

You are building all OpenClaw agent definitions. No Go code, no TypeScript — just configuration and Markdown files.

### Your files

- `openclaw/config.json` — gateway + model provider + agent list configuration
- `openclaw/agents/AGENTS.md` — global agent context (Eragon prize track)
- `openclaw/agents/mortician/AGENTS.md` and `TOOLS.md`
- `openclaw/agents/defibrillator/AGENTS.md`, `SOUL.md`, and `TOOLS.md`
- `openclaw/agents/coroner/AGENTS.md`, `SOUL.md`, and `TOOLS.md`
- `openclaw/agents/highpriest/AGENTS.md`, `SOUL.md`, and `TOOLS.md`

### Do not touch

Anything outside `openclaw/`

### Key behavioral requirements

**Tool URLs:** All tool URLs use `http://go-service:8080` as the base (Contract 4). For local testing outside Docker, substitute `localhost:8080`.

**Gateway config (`config.json`):** Follow the openclaw-ddls deployment spec exactly. The gateway must run in `local` mode, bind to all interfaces (`0.0.0.0`), expose the HTTP chat completions endpoint, and enable agent-to-agent routing. Both LLM providers route through the Dedalus Unified API as BYOK passthrough. See Contract 8 for the full list of required fields.

**Agent pipeline flow (hard requirement):**

- Mortician calls `ctg-fetch` → messages Defibrillator with a structured candidate containing `nct_id`, `drug_name`, `condition`, `failure_reason`, `phase`
- Defibrillator calls `patient-data` + `neo4j-query` + `save-hypothesis` → messages Coroner with the hypothesis including `hypothesis_id`
- Coroner calls `neo4j-query` + `update-hypothesis` → messages High Priest with the full debate summary
- High Priest calls `update-hypothesis` + `generate-pdf` + `photon-send` → pipeline complete

**The Mortician:** Tool-only — no LLM model. Calls `ctg-fetch`, extracts NCT IDs, and messages the Defibrillator with one candidate per activation.

**The Defibrillator:** Uses `gemini-via-dedalus`. Personality: relentlessly optimistic. Must be explicitly instructed to examine `LBXCRP` (C-Reactive Protein) as a potential effect modifier. This is what guides Gemini to find the target signal. Must also simulate reading a mock FDA Clinical Review document to demonstrate Gemini's 2M+ context window.

**The Coroner:** Uses `k2-via-dedalus`. Personality: cold, rigorous, skeptical. Tries to falsify. When confronted with a PPAR-γ / CRP argument and supporting p-values, it must find the "metabolic pathway conflict" edge case, analyze it, and ultimately conclude the mechanism is consistent (confidence 0.87–0.91). This outcome is guided by prompt structure and pre-seeded Neo4j evidence nodes — not hardcoded.

**The High Priest:** Uses `gemini-via-dedalus`. If `(advocate_score + skeptic_score) / 2 > 0.75`, verdict is RESCUED. Calls `generate-pdf` then `photon-send` in sequence. Uses `PHOTON_IMESSAGE_TARGET` env var as the `target` field in the `photon-send` call.

**Global `openclaw/agents/AGENTS.md`:** Satisfies the Eragon prize track. Must describe Lazarus as a "sovereign internal R&D participant." Include: what the system does autonomously, what decisions it makes, what its outputs are, and why this solves a concrete internal R&D pipeline problem. Eragon judges on Depth of Action (30%), Context Quality (30%), Workflow Usefulness (40%).

**Testing without Member 1:** Point tool URLs at a mock server (Mockoon or a minimal Express app) that returns the shapes from Contract 2. Verify each agent calls the correct tools in the correct order.

---

## Member 4 — Full Briefing

You are building infrastructure (Docker Compose), the Photon TypeScript sidecar, fallback mode wiring, Dedalus DCS deployment, and all scripts.

### Your files

- `docker-compose.yml`
- `Dockerfile` — Go service multi-stage build
- `.env.example`
- `photon-service/package.json`, `tsconfig.json`, `Dockerfile`
- `photon-service/src/index.ts`, `client.ts`, `send.ts`, `subscribe.ts`
- `scripts/seed.sh`
- `scripts/demo.sh`

You also write these Go files in `internal/` — coordinate with Member 1 so there is no overlap:
- `internal/tools/replay.go` — fallback replay endpoint
- `internal/dedalus/client.go` — Dedalus SDK client initialization
- `internal/dedalus/machines.go` — DCS provisioning, wake, sleep functions

### Do not touch

`index.html`, `internal/websocket/`, `openclaw/`, `cmd/`, `internal/config/`, `internal/db/`, `internal/tools/server.go`, `internal/tools/ctg.go`, `internal/tools/patients.go`, `internal/tools/graph.go`, `internal/tools/hypothesis.go`, `internal/tools/trigger.go`, `internal/pdf/`, `internal/photon/`, `internal/seed/`

### Key behavioral requirements

**Docker Compose — 7 services:**

Define the following services. All services that need env vars use `env_file: .env`. Services that need Dedalus/Photon credentials are listed under the appropriate section.

1. **redis** — Redis 7 Alpine, port 6379, named volume
2. **postgres** — Postgres 16 Alpine, port 5432, named volume, credentials from env
3. **neo4j** — Neo4j 5, ports 7474 and 7687, named volume, auth from env
4. **go-service** — built from the root `Dockerfile`, port 8080, depends on redis/postgres/neo4j, `restart: on-failure`, `blueprints` volume mounted at `/tmp/blueprints`
5. **openclaw** — Node.js 22 slim image, working directory set to `/home/machine`, installs openclaw globally on container start, port 18789, mounts `./openclaw` at `/workspace/openclaw` and `openclaw_home` volume at `/home/machine`, requires env vars `HOME=/home/machine`, `OPENCLAW_HOME`, `OPENCLAW_STATE_DIR`, `NODE_COMPILE_CACHE`, `OPENCLAW_NO_RESPAWN=1`, depends on go-service
6. **photon-service** — built from `./photon-service/Dockerfile`, port 3001, `restart: on-failure`, `blueprints` volume mounted at `/tmp/blueprints`
7. **seed** — built from the root `Dockerfile`, runs the seed subcommand, depends on postgres and neo4j, `restart: no`

Named volumes: `blueprints`, `postgres_data`, `neo4j_data`, `redis_data`, `openclaw_home`

**Go Dockerfile:** Multi-stage build. Builder stage: Go 1.22 Alpine, downloads dependencies, builds the binary. Final stage: Alpine 3.19, copies the binary, `data/` directory, and `index.html`. Exposes port 8080.

**Photon TypeScript service:**

Sign up at `photon.codes/spectrum` with promo code `HACKPTON2026` for free Pro access. Get `PROJECT_ID` and `PROJECT_SECRET` from the dashboard.

- `src/client.ts` — on startup, issues a gRPC token by POSTing to the Photon token endpoint with Basic auth (`base64(PROJECT_ID:PROJECT_SECRET)`). The response contains `token` and `address` which are passed to `createClient()` from `@photon-ai/advanced-imessage`. Implements retry with exponential backoff on auth and connection errors.

- `src/send.ts` — implements two Express route handlers: `/send-alert` calls `im.messages.send(target, message)` and `/send-file` calls `im.attachments.upload(filePath)` then sends the attachment. Both validate that `target` is present and return 400 if missing.

- `src/subscribe.ts` — calls `im.messages.subscribe()` on startup to open a persistent event stream. For each `message.received` event where the message text (trimmed, lowercased) equals `"draft"`, POSTs the chat and sender fields to `${GO_SERVICE_URL}/inbound`. Uses the SDK's filter operator to narrow to `message.received` events only. Handles connection errors with `retry: true`.

- `src/index.ts` — initializes the Photon client, starts the Express server on port 3001, starts the subscribe loop in the background. Logs a ready message when both are up. Exposes `GET /health` returning status and connection state.

- `photon-service/Dockerfile` — Node.js 18 slim base, installs dependencies, compiles TypeScript, runs the compiled output.

**`internal/tools/replay.go`:** Implements `POST /tools/replay`. Reads `data/swarm_logs.json`, spawns a goroutine that broadcasts each event to the WebSocket hub with 2.4-second delays, returns immediately with status and event count. See Contract 2 for the full behavioral spec.

**Dedalus DCS provisioning (`internal/dedalus/machines.go`):**

Reference `openclaw.ts` from https://github.com/annyzhou/openclaw-ddls for the canonical provisioning sequence. Implement three functions:

- `ProvisionControlPlane` — creates Machine 1 (4 vCPU, 8192 MiB, 20 GiB), installs Docker, starts Redis, Postgres, Neo4j, and the Go orchestrator container. Returns machine ID and public IP.

- `ProvisionAdvocateNode` — creates Machine 2 (2 vCPU, 4096 MiB, 10 GiB), installs Node.js 22 via NodeSource redirected to `/home/machine`, installs openclaw globally, writes a config pointing only the `defibrillator` agent at the Control Plane IP, sets all required env vars, starts the gateway with `setsid`, writes the startup script.

- `ProvisionSkepticNode` — same pattern as Advocate but for the `coroner` agent only.

**`WakeMachines` function:** Changes machine state to running, then — because the root filesystem resets on every wake — SSH into each agent machine and re-run the Node.js install + gateway startup sequence. Poll gateway health before returning. Simply changing state to "running" is not sufficient.

**`SleepMachines` function:** Puts all machines to sleep after the demo. `/home/machine` config and data persists; compute billing stops.

**`demo.sh` script behavior:**

When `DEPLOY_TARGET=local`: tear down and restart all Docker Compose services cleanly, wait for database health checks, wait for Go service to be reachable, print the dashboard and trigger URLs.

When `DEPLOY_TARGET=dedalus`: run the `wake` subcommand (which re-installs Node.js and restarts gateways on agent machines), poll until the Go service on the Control Plane is reachable, print the public dashboard URL.

Both modes end by printing a visible confirmation that Lazarus Nexus is live.

**Pre-demo Photon checklist:**
- Pre-create the conversation with the exec's iMessage handle on Saturday night so it does not count as a new conversation on demo day (limit: 50 new conversations per line per day)
- Confirm full send-and-receive round-trip works before Sunday

---

## Merge Order

Follow this order on Sunday morning to avoid conflicts:

1. **Member 4** merges `docker-compose.yml` + `.env.example` first — everyone can now run the stack
2. **Member 1** merges Go core — all tool endpoints respond
3. **Member 2** merges WebSocket hub + `main.go` stub replacement + `index.html` changes
4. **Member 3** merges OpenClaw config + all agent definitions
5. **Member 4** merges Photon service + `scripts/` — final integration layer

Steps 2 and 3 can merge in either order — they touch different directories.

---

## Quick Conflict Checklist

Before pushing, verify you have not edited any file outside your ownership:

| File | Owner |
|---|---|
| `cmd/lazarus/main.go` | Member 1 (Member 2 may submit one targeted PR — see Contract 6) |
| `go.mod` / `go.sum` | Member 1 |
| `data/*` | Member 1 |
| `internal/websocket/*` | Member 2 |
| `index.html` | Member 2 |
| `openclaw/*` | Member 3 |
| `docker-compose.yml` | Member 4 |
| `Dockerfile` | Member 4 |
| `photon-service/*` | Member 4 |
| `scripts/*` | Member 4 |
| `.env.example` | Member 4 |
