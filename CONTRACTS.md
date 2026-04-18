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

**One rule:** never edit a file owned by another member without asking first. The only shared file is `cmd/lazarus/main.go` — the handoff protocol for that file is in the Member 1 and Member 2 sections below.

---

## Environment Variables

All members depend on these. Member 4 creates `.env.example`. Everyone creates their own `.env` locally from it.

```
# Dedalus
DEDALUS_API_KEY=
DEDALUS_ORG_ID=

# LLM BYOK (passed through Dedalus Unified API)
GEMINI_API_KEY=
K2_API_KEY=
K2_PROVIDER_MODEL=

# Photon
PHOTON_PROJECT_ID=
PHOTON_PROJECT_SECRET=
PHOTON_IMESSAGE_TARGET=

# Internal service URLs
PHOTON_SERVICE_URL=http://photon-service:3001
GO_SERVICE_URL=http://go-service:8080

# Databases
POSTGRES_DSN=postgres://lazarus:lazarus@postgres:5432/lazarus?sslmode=disable
REDIS_URL=redis://redis:6379
NEO4J_URI=bolt://neo4j:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=lazarus

# OpenClaw
OPENCLAW_HOME=/workspace/openclaw

# Deployment
DEPLOY_TARGET=local
FALLBACK_MODE=false
```

For local dev outside Docker, replace service hostnames with `localhost`.

---

## Contract 1: LogEvent (WebSocket + Go shared struct)

This struct is used by Member 1 (Go broadcasts it), Member 2 (frontend consumes it), and Member 4 (fallback replay emits it). It must be identical everywhere.

### Go struct (Member 1 defines in `internal/websocket/hub.go`)

```go
type LogEvent struct {
    Timestamp  string                 `json:"timestamp"`  // RFC3339, e.g. "2026-04-19T08:15:22Z"
    AgentID    string                 `json:"agent_id"`   // see Agent ID values below
    Name       string                 `json:"name"`       // human-readable agent name
    Category   string                 `json:"category"`   // see Category values below
    Message    string                 `json:"message"`
    Confidence float64                `json:"confidence"` // 0.0–1.0, use 0 if not applicable
    Metadata   map[string]interface{} `json:"metadata"`   // optional, can be null
}
```

### Agent ID values — use exactly these strings

| AgentID | Name | Frontend CSS class |
|---|---|---|
| `THE_MORTICIAN` | `The Mortician` | `system` |
| `THE_DEFIBRILLATOR` | `The Defibrillator (Gemini 4)` | `advocate` |
| `THE_CORONER` | `The Coroner (K2 Think V2)` | `skeptic` |
| `THE_HIGH_PRIEST` | `The High Priest` | `judge` |
| `SYSTEM` | `Lazarus Nexus` | `system` |
| `PHOTON` | `Photon Spectrum` | `alert` |

### Category values

```
SOURCING
HYPOTHESIS_GENERATION
VERIFICATION
JUDGMENT
ALERT
SYSTEM
```

### Example JSON (what crosses the WebSocket wire)

```json
{
  "timestamp": "2026-04-19T08:15:22Z",
  "agent_id": "THE_DEFIBRILLATOR",
  "name": "The Defibrillator (Gemini 4)",
  "category": "HYPOTHESIS_GENERATION",
  "message": "Applying 1.21 gigawatts to Patient_Cluster_B (Females 65+)... Detected CRP-mediated synergy. Resurrection possible.",
  "confidence": 0.92,
  "metadata": {
    "subgroup_size": 412,
    "p_value": 0.004
  }
}
```

---

## Contract 2: Go HTTP Tool Endpoints

Member 1 implements these. Member 3 (OpenClaw agent TOOLS.md files) calls them. Member 4 (Photon service) calls `/inbound`. Do not rename or restructure these URLs.

All endpoints:
- Accept `Content-Type: application/json`
- Return `Content-Type: application/json`
- Return `{"error": "message"}` with appropriate 4xx/5xx on failure
- Listen on port `8080`

---

### `POST /tools/ctg-fetch`

Called by: The Mortician (OpenClaw)

Request body: `{}` (empty — no params needed)

Response:
```json
[
  {
    "nct_id": "NCT04782234",
    "title": "A Study of Zeloprin in Adults With Type 2 Diabetes",
    "phase": "PHASE2",
    "status": "WITHDRAWN",
    "condition": "Type 2 Diabetes Mellitus",
    "sponsor": "Nexagen Biopharma",
    "failure_reason": "Strategic portfolio reprioritization"
  }
]
```

---

### `POST /tools/patient-data`

Called by: The Defibrillator (OpenClaw)

Request body:
```json
{
  "nct_id": "NCT04782234",
  "subgroup_filter": null
}
```
`subgroup_filter` is optional. When null, returns all subgroup breakdowns.

**CRITICAL RIGOR CONTRACT:** The Go backend MUST calculate the `p_value` directly using Fisher's Exact Test algorithm for the target cohort compared to the control cohort. The LLM must not hallucinate this value.

Response:
```json
{
  "total_patients": 512,
  "cohort_summary": {
    "mean_lbxgh": 7.4,
    "mean_lbxcrp": 2.1,
    "mean_efficacy_delta": 0.03
  },
  "subgroups": [
    {
      "label": "Female 65+ CRP>3",
      "n": 412,
      "riagendr": 2,
      "min_age": 65,
      "crp_threshold": 3.0,
      "mean_lbxgh": 6.1,
      "mean_lbxcrp": 5.8,
      "mean_efficacy_delta": 0.84,
      "p_value": 0.0008
    }
  ]
}
```

---

### `POST /tools/neo4j-query`

Called by: The Defibrillator, The Coroner (OpenClaw)

Request body:
```json
{
  "cypher": "MATCH (d:Drug {drug_id: 'RX-782'})-[:TARGETS]->(t:Target) RETURN t",
  "params": {}
}
```

Only `MATCH` queries are allowed. The handler rejects any query containing `CREATE`, `MERGE`, `DELETE`, or `SET` with a 400 error.

Response:
```json
{
  "results": [
    { "t": { "target_id": "TGT-001", "name": "PPAR-gamma", "symbol": "PPARG" } }
  ]
}
```

---

### `POST /tools/save-hypothesis`

Called by: The Defibrillator (OpenClaw)

Request body:
```json
{
  "trial_nct_id": "NCT04782234",
  "title": "Zeloprin Repurposing: Inflammatory T2D Subgroup",
  "summary": "PPAR-gamma agonism shows 84% efficacy in high-CRP post-menopausal females",
  "subgroup_definition": "Female, age>=65, LBXCRP>3.0",
  "advocate_score": 0.92
}
```

Response:
```json
{
  "hypothesis_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

### `PATCH /tools/update-hypothesis`

Called by: The Coroner, The High Priest (OpenClaw)

Request body (all fields optional except `hypothesis_id`):
```json
{
  "hypothesis_id": "550e8400-e29b-41d4-a716-446655440000",
  "advocate_score": 0.92,
  "skeptic_score": 0.89,
  "judge_score": 0.91,
  "final_confidence": 0.91,
  "status": "RESCUED"
}
```

Valid `status` values: `PENDING`, `ADVOCATED`, `VERIFIED`, `RESCUED`, `REJECTED`

Response:
```json
{ "ok": true }
```

---

### `POST /tools/generate-pdf`

Called by: The High Priest (OpenClaw)

Request body:
```json
{
  "hypothesis_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

Response:
```json
{
  "pdf_path": "/tmp/blueprint-550e8400.pdf"
}
```

The PDF is written to `/tmp/` on the Go service container. The path is passed to `/tools/photon-send` in the same request chain.

---

### `POST /tools/photon-send`

Called by: The High Priest (OpenClaw)

Request body:
```json
{
  "target": "+15551234567",
  "message": "🚨 Lazarus unburied a pulse in Zeloprin. 84% efficacy signature detected in High-CRP females. Reply DRAFT for the blueprint.",
  "pdf_path": null
}
```

`pdf_path` is null for the initial alert. When the exec replies "DRAFT", the Go `/inbound` handler calls the Photon service directly with the PDF path — the High Priest does not need to call this again.

Response:
```json
{ "ok": true }
```

---

### `POST /trigger`

Called by: browser / demo script (not OpenClaw)

Request body: `{}` (empty)

Response:
```json
{ "status": "triggered", "iteration": 83 }
```

Side effects: broadcasts a SYSTEM log event to all WebSocket clients, then POSTs to OpenClaw to activate the Mortician.

---

### `GET /trigger`

Identical effect to `POST /trigger`. Exists for browser convenience (open URL in tab to trigger).

---

### `POST /inbound`

Called by: Photon TypeScript service (Member 4) when exec replies "DRAFT"

Request body:
```json
{
  "chat": "+15551234567",
  "sender": "+15551234567"
}
```

The Go service looks up the most recent RESCUED hypothesis from Postgres, generates the PDF, and calls the Photon service's `/send-file` endpoint. Then broadcasts the `PHOTON` alert to the WebSocket hub.

Response:
```json
{ "ok": true }
```

---

### `GET /ws`

WebSocket upgrade endpoint. Called by: `index.html` (Member 2).

On connect: replays last 20 events from `swarm_events` Postgres table as individual JSON frames, then subscribes to live broadcasts.

Frame format: the `LogEvent` JSON from Contract 1.

---

### `GET /`

Serves `index.html` as a static file. No JSON — just HTML.

---

## Contract 3: Photon Service HTTP API

Member 4 implements this. Member 1 calls it from `internal/photon/client.go`. The service runs on port `3001`.

---

### `POST /send-alert`

Called by: Go service (`internal/photon/client.go`)

Request body:
```json
{
  "target": "+15551234567",
  "message": "🚨 Lazarus unburied a pulse in Zeloprin. 84% efficacy signature detected in High-CRP females. Reply DRAFT for the blueprint."
}
```

Response (success):
```json
{ "ok": true }
```

Response (failure):
```json
{ "ok": false, "error": "description" }
```

HTTP status: 200 on success, 400 on bad input, 502 on Photon gRPC failure.

---

### `POST /send-file`

Called by: Go service (`internal/photon/client.go`)

Request body:
```json
{
  "target": "+15551234567",
  "file_path": "/tmp/blueprint-550e8400.pdf"
}
```

The `file_path` must be a path that the Photon service container can read. In Docker Compose, `/tmp/` on the Go service container is not automatically shared — Member 4 must add a shared Docker volume for `/tmp/blueprints/` in `docker-compose.yml` so both containers can access the generated PDF. Member 1 must write PDFs to `/tmp/blueprints/` (not bare `/tmp/`).

Response: same shape as `/send-alert`.

---

### `GET /health`

Response:
```json
{ "status": "ok", "photon_connected": true }
```

`photon_connected` is false if the gRPC token issuance failed. Go service startup logs a warning if this endpoint returns `photon_connected: false`.

---

## Contract 4: OpenClaw Tool URL Format

Member 3 writes these in `openclaw/agents/*/TOOLS.md`. The Go service host inside Docker Compose is `go-service`. The base URL is always `http://go-service:8080`.

Full tool URL list for OpenClaw TOOLS.md files:

```
ctg-fetch:         POST http://go-service:8080/tools/ctg-fetch
patient-data:      POST http://go-service:8080/tools/patient-data
neo4j-query:       POST http://go-service:8080/tools/neo4j-query
save-hypothesis:   POST http://go-service:8080/tools/save-hypothesis
update-hypothesis: PATCH http://go-service:8080/tools/update-hypothesis
generate-pdf:      POST http://go-service:8080/tools/generate-pdf
photon-send:       POST http://go-service:8080/tools/photon-send
```

**Note on Distributed Topology:** For local testing (`docker-compose`), `go-service:8080` or `localhost:8080` is correct. However, for the final Dedalus multi-VM deployment (where agents run on separate dedicated Dedalus Machines), Member 4's provisioning script will pass the Control Plane IP into the OpenClaw worker's environment config instead.

---

## Contract 5: Shared Docker Volume for PDFs

Member 4 adds this to `docker-compose.yml`:

```yaml
volumes:
  blueprints:
    driver: local
```

And mounts it in both services:

```yaml
go-service:
  volumes:
    - blueprints:/tmp/blueprints

photon-service:
  volumes:
    - blueprints:/tmp/blueprints
```

Member 1 writes all generated PDFs to `/tmp/blueprints/blueprint-{hypothesis_id}.pdf`.
Member 4's `/send-file` endpoint reads from the same path.

---

## Contract 6: `cmd/lazarus/main.go` Handoff

Member 1 owns `main.go` but Member 2 needs to wire in the WebSocket hub. Protocol:

**Member 1** writes `main.go` with this exact stub comment where the hub wires in:

```go
// TODO(member2): register websocket hub here
// hub := websocket.NewHub(deps)
// go hub.Run()
// deps.Hub = hub
```

**Member 2** submits a PR that replaces only those comment lines with the real wiring. Member 2 does not touch anything else in `main.go`.

The `Deps` struct that Member 1 defines in `main.go` or `internal/tools/server.go` must include a `Hub` field:

```go
type Deps struct {
    DB     *pgx.Conn
    Redis  *redis.Client
    Neo4j  neo4j.DriverWithContext
    Config *config.Config
    Hub    HubBroadcaster  // interface, defined by Member 2
}
```

Member 2 defines this interface in `internal/websocket/hub.go`:

```go
type HubBroadcaster interface {
    Broadcast(event LogEvent)
}
```

Member 1 imports `internal/websocket` and uses `HubBroadcaster` in the `Deps` struct. This way Member 1 can compile without Member 2's implementation — `deps.Hub` is nil until Member 2's code is merged, and all `hub.Broadcast()` calls are guarded:

```go
if deps.Hub != nil {
    deps.Hub.Broadcast(event)
}
```

---

## Contract 7: Go Module Path

The Go module is `github.com/lazarus`. All internal imports use this prefix:

```go
import "github.com/lazarus/internal/db"
import "github.com/lazarus/internal/websocket"
import "github.com/lazarus/internal/tools"
```

Member 1 runs `go mod init github.com/lazarus` and commits `go.mod` before anyone else starts writing Go. Do not change the module path.

---

## Contract 8: OpenClaw Agent IDs

Member 3 sets these in `openclaw/config.json`. These exact strings are what the Mortician uses when calling `agentToAgent`, and what the Go `/trigger` endpoint POSTs to OpenClaw. Do not rename them.

```
mortician
defibrillator
coroner
highpriest
```

The OpenClaw gateway listens on port `18789`. The trigger endpoint POSTs to:
```
POST http://openclaw:18789/v1/chat/completions
```
with body `{ "model": "mortician", "messages": [...] }`.

---

## Contract 9: Postgres Table Names

Member 1 creates these. Member 4's seed script references them. Do not rename.

```
swarm_events
patients
clinical_trials
hypotheses
```

---

## Contract 10: Docker Compose Service Names

Member 4 defines these. Everyone else references them by name inside Docker network.

```
redis          → redis:6379
postgres       → postgres:5432
neo4j          → neo4j:7687 (bolt), neo4j:7474 (browser)
go-service     → go-service:8080
openclaw       → openclaw:18789
photon-service → photon-service:3001
seed           → one-shot, exits after seeding
```

---

## Member 1 — Full Briefing

You are building the Go backend. This is the most critical workstream — everything else depends on your HTTP endpoints being up.

### Your files
```
cmd/lazarus/main.go
cmd/lazarus/deploy.go
go.mod / go.sum
internal/config/config.go
internal/db/postgres.go
internal/db/redis.go
internal/db/neo4j.go
internal/seed/seed_postgres.go
internal/seed/seed_neo4j.go
internal/tools/server.go
internal/tools/ctg.go
internal/tools/patients.go
internal/tools/graph.go
internal/tools/hypothesis.go
internal/tools/trigger.go
internal/tools/replay.go
internal/pdf/generator.go
internal/photon/client.go
internal/dedalus/client.go
internal/dedalus/machines.go
data/patients_mock.json
data/swarm_logs.json
data/blueprint_rescue.json
```

### Do not touch
`index.html`, `internal/websocket/`, `openclaw/`, `photon-service/`, `docker-compose.yml`, `Dockerfile`

### Key implementation notes

**`main.go` stub:** Write `main.go` with the `TODO(member2)` comment block exactly as shown in Contract 6. Define the `Deps` struct with a `Hub HubBroadcaster` field. Guard every `deps.Hub.Broadcast()` call with a nil check so the service compiles and runs without Member 2's code.

**PDF shared volume:** Write all generated PDFs to `/tmp/blueprints/blueprint-{hypothesis_id}.pdf` (not bare `/tmp/`). This path is shared with the Photon container via a Docker volume (Member 4 sets this up).

**`internal/photon/client.go`:** This is a thin HTTP client. It calls `PHOTON_SERVICE_URL/send-alert` and `PHOTON_SERVICE_URL/send-file`. It does not know anything about gRPC or Photon's SDK — that is Member 4's concern.

**`FALLBACK_MODE` env var:** When `FALLBACK_MODE=true`, every tool handler must return pre-scripted mock data instead of calling external APIs or querying databases. Check this flag at the top of each handler. This is non-negotiable for demo safety.

**Demo guard in `/tools/ctg-fetch`:** After fetching live CTG data, always check if `NCT04782234` is in the results. If not, inject it from the `clinical_trials` Postgres table. The demo scenario must always be present.

**`/inbound` endpoint:** When called by the Photon service (exec replied "DRAFT"), look up the most recent hypothesis with `status = 'RESCUED'` from Postgres, call `internal/pdf/generator.go` to generate the PDF, then call `internal/photon/client.go`'s `SendFile()`. Then broadcast a `PHOTON` `LogEvent` to the hub.

**patients_mock.json critical constraint:** The subset where `RIAGENDR=2` AND `RIDAGEYR>=65` AND `LBXCRP>3.0` AND `DRUG_EXPOSURE>0` must have average `EFFICACY_DELTA` ≈ 0.84 (84%). All other subgroups must show average `EFFICACY_DELTA` near 0 or negative. Generate at least 500 patient records total.

**Deterministic Math Requirement:** In `/tools/patient-data`, the Go backend must calculate the `p_value` representing statistical significance of the subgroup delta using Fisher's Exact Test (or similar deterministic biostatistics equation). DO NOT rely on the LLM to verify significance. Validate the mock dataset so the calculation natively passes `p < 0.001` for the target cluster.

**Go module:** Run `go mod init github.com/lazarus` first. All imports use `github.com/lazarus/internal/...`.

**Required Go dependencies:**
```
github.com/jackc/pgx/v5
github.com/redis/go-redis/v9
github.com/neo4j/neo4j-go-driver/v5
github.com/gorilla/websocket
github.com/jung-kurt/gofpdf
github.com/joho/godotenv
github.com/dedalus-labs/dedalus-sdk-go
```

### All HTTP endpoints you must implement

See Contract 2 for full request/response shapes:
- `POST /tools/ctg-fetch`
- `POST /tools/patient-data`
- `POST /tools/neo4j-query`
- `POST /tools/save-hypothesis`
- `PATCH /tools/update-hypothesis`
- `POST /tools/generate-pdf`
- `POST /tools/photon-send`
- `POST /trigger` and `GET /trigger`
- `POST /inbound`
- `GET /ws` (registers the hub handler — Member 2 implements the hub, you register the route)
- `GET /` (serve `index.html` as static file)

---

## Member 2 — Full Briefing

You are building the WebSocket broadcast hub and connecting the frontend to it.

### Your files
```
internal/websocket/hub.go
internal/websocket/handler.go
index.html  (targeted changes only — see below)
```

### Do not touch
Anything in `cmd/`, `internal/config/`, `internal/db/`, `internal/tools/`, `internal/pdf/`, `internal/photon/`, `internal/seed/`, `internal/dedalus/`, `openclaw/`, `photon-service/`, `docker-compose.yml`

### Key implementation notes

**`HubBroadcaster` interface:** Define this in `internal/websocket/hub.go`. It is imported by Member 1:

```go
type HubBroadcaster interface {
    Broadcast(event LogEvent)
}
```

Also define `LogEvent` in the same file using the exact struct from Contract 1. Member 1 imports and uses this type.

**Hub internals:** Use Go channels for the broadcast fan-out — no mutexes in the hot path. The hub maintains a `map[chan LogEvent]struct{}` of connected clients. `Broadcast()` sends to each channel non-blocking (use a `select` with a `default` to drop slow clients rather than blocking).

**`handler.go`:** The `GET /ws` upgrade handler. On connect, query the `swarm_events` Postgres table for the last 20 rows ordered by timestamp desc, then send each as a JSON frame to the new client before subscribing them to live broadcasts. This requires a `*pgx.Conn` — accept it via the `Deps` struct (Member 1 passes it in).

**`main.go` handoff:** Once Member 1 commits their stub `main.go`, submit a PR that replaces only the `TODO(member2)` comment block with:
```go
hub := websocket.NewHub(deps.DB)
go hub.Run()
deps.Hub = hub
```
Touch nothing else in `main.go`.

**`index.html` changes — minimal and targeted:**

The existing `index.html` has a `LOGS` array (around line 869) and a `setInterval(addLog, 2400)` loop. You are replacing that mechanism with a WebSocket connection while keeping the existing array as a fallback.

1. Find the `setInterval` call and the WebSocket connection point (if any).
2. Add a WebSocket connection to `ws://localhost:8080/ws` (configurable via a `const WS_URL` at the top of the script block).
3. On `ws.onmessage`: parse the JSON frame as a `LogEvent`, map `agent_id` to CSS class using this table (from Contract 1), and call the existing log-rendering function with the mapped data.
4. On `ws.onclose` or `ws.onerror`: fall back to the existing `setInterval(addLog, 2400)` loop.
5. **Heart Rate Monitor:** Add a visual HTML/Canvas EKG element that flatlines until a message with a significant `P-Value` is received, at which point it spikes to a heartbeat.
6. **Live Graph:** Add a real-time expanding Neo4j-style node visualization (e.g., using Force Graph) connected to the `neo4j-query` logs.

AgentID → CSS class mapping for the frontend:
```javascript
const AGENT_CLASS = {
  THE_MORTICIAN:      'system',
  THE_DEFIBRILLATOR:  'advocate',
  THE_CORONER:        'skeptic',
  THE_HIGH_PRIEST:    'judge',
  SYSTEM:             'system',
  PHOTON:             'alert',
};
```

**Testing without Member 1:** Write a minimal Go file (not committed) that upgrades a WebSocket on `:8080/ws` and broadcasts a test `LogEvent` every 2 seconds. Use this to develop and test your frontend changes independently.

---

## Member 3 — Full Briefing

You are building all OpenClaw agent definitions. No Go code, no TypeScript — just configuration and markdown files.

### Your files
```
openclaw/config.json
openclaw/agents/AGENTS.md
openclaw/agents/mortician/AGENTS.md
openclaw/agents/mortician/TOOLS.md
openclaw/agents/defibrillator/AGENTS.md
openclaw/agents/defibrillator/SOUL.md
openclaw/agents/defibrillator/TOOLS.md
openclaw/agents/coroner/AGENTS.md
openclaw/agents/coroner/SOUL.md
openclaw/agents/coroner/TOOLS.md
openclaw/agents/highpriest/AGENTS.md
openclaw/agents/highpriest/SOUL.md
openclaw/agents/highpriest/TOOLS.md
```

### Do not touch
Anything outside `openclaw/`

### Key implementation notes

**Tool URLs:** All tool URLs use `http://go-service:8080` as the base (Contract 4). For local testing outside Docker, substitute `localhost:8080`.

**Agent IDs in config.json:** Use exactly `mortician`, `defibrillator`, `coroner`, `highpriest` (Contract 8). These are the IDs Member 1's trigger endpoint POSTs to OpenClaw.

**`config.json` model providers:** Both LLM providers route through the Dedalus Unified API:

```json
{
  "gateway": { "host": "0.0.0.0", "port": 18789 },
  "models": {
    "providers": {
      "gemini-via-dedalus": {
        "base_url": "https://api.dedaluslabs.ai/v1",
        "api_key": "${DEDALUS_API_KEY}",
        "extra_headers": {
          "X-Provider": "google",
          "X-Provider-Key": "${GEMINI_API_KEY}",
          "X-Provider-Model": "gemini-2.0-flash"
        }
      },
      "k2-via-dedalus": {
        "base_url": "https://api.dedaluslabs.ai/v1",
        "api_key": "${DEDALUS_API_KEY}",
        "extra_headers": {
          "X-Provider": "mbzuai",
          "X-Provider-Key": "${K2_API_KEY}",
          "X-Provider-Model": "${K2_PROVIDER_MODEL}"
        }
      }
    }
  },
  "agents": {
    "defaults": { "agentToAgent": { "enabled": true } },
    "agentToAgent": {
      "allow": [
        "mortician → defibrillator",
        "defibrillator → coroner",
        "coroner → highpriest"
      ]
    },
    "list": {
      "mortician":      { "workspaceDir": "agents/mortician" },
      "defibrillator":  { "workspaceDir": "agents/defibrillator", "model": "gemini-via-dedalus" },
      "coroner":        { "workspaceDir": "agents/coroner",        "model": "k2-via-dedalus" },
      "highpriest":     { "workspaceDir": "agents/highpriest",     "model": "gemini-via-dedalus" }
    }
  }
}
```

**Agent pipeline flow (hard requirement):**

```
Mortician → calls ctg-fetch → messages defibrillator with candidate
Defibrillator → calls patient-data + neo4j-query + save-hypothesis → messages coroner with hypothesis
Coroner → calls neo4j-query + update-hypothesis → messages highpriest with verdict
High Priest → calls update-hypothesis + generate-pdf + photon-send → pipeline complete
```

**The Mortician:** Does not use an LLM model — it is tool-only. Its AGENTS.md must instruct it to call `ctg-fetch`, extract NCT IDs, and message the Defibrillator with a structured JSON candidate containing `nct_id`, `drug_name`, `condition`, `failure_reason`, `phase`.

**The Defibrillator:** Uses `gemini-via-dedalus`. Personality: relentlessly optimistic, sees resurrection potential in data. It must be instructed to look specifically at `LBXCRP` (C-Reactive Protein) as a potential effect modifier when analyzing subgroups. This is what guides Gemini to find the billion-dollar signal.

**The Coroner:** Uses `k2-via-dedalus`. Personality: cold, rigorous, skeptical. It tries to falsify. Its AGENTS.md must guide it such that when confronted with a PPAR-γ / CRP mechanistic argument and supporting p-values, it finds the "metabolic pathway conflict" edge case, analyzes it, and ultimately concludes the mechanism is consistent (confidence 0.87–0.91). This outcome is guided by the seeded Neo4j evidence nodes — not hardcoded.

**The High Priest:** Uses `gemini-via-dedalus`. If `advocate_score + skeptic_score / 2 > 0.75`, verdict is RESCUED. Then calls `generate-pdf` and `photon-send` in sequence. The `photon-send` call uses the `PHOTON_IMESSAGE_TARGET` env var for the `target` field (the agent reads this from its environment via OpenClaw config).

**Global `openclaw/agents/AGENTS.md`:** This satisfies the Eragon prize track. It must describe Lazarus as a "sovereign internal R&D participant." Include: what the system does autonomously, what decisions it makes, what its outputs are, and why this solves a concrete pipeline problem. Eragon judges on Depth of Action (30%), Context Quality (30%), Workflow Usefulness (40%).

**Testing without Member 1:** You can test agent definitions by pointing tool URLs at a mock server (e.g., `mockoon` or a simple Express app that returns the shapes from Contract 2). Test that each agent calls the right tools in the right order before declaring it done.

---

## Member 4 — Full Briefing

You are building infrastructure (Docker Compose), the Photon TypeScript sidecar, fallback mode wiring, Dedalus DCS deployment, and all scripts.

### Your files
```
docker-compose.yml
Dockerfile                     (Go service multi-stage build)
.env.example
photon-service/package.json
photon-service/tsconfig.json
photon-service/Dockerfile
photon-service/src/index.ts
photon-service/src/client.ts
photon-service/src/send.ts
photon-service/src/subscribe.ts
scripts/seed.sh
scripts/demo.sh
```

You also write two Go files in `internal/` (coordinate with Member 1 so there is no overlap):
```
internal/tools/replay.go       (fallback replay endpoint)
internal/dedalus/client.go
internal/dedalus/machines.go
```

### Do not touch
`index.html`, `internal/websocket/`, `openclaw/`, `cmd/`, `internal/config/`, `internal/db/`, `internal/tools/server.go`, `internal/tools/ctg.go`, `internal/tools/patients.go`, `internal/tools/graph.go`, `internal/tools/hypothesis.go`, `internal/tools/trigger.go`, `internal/pdf/`, `internal/photon/`, `internal/seed/`

### Key implementation notes

**Docker Compose — 7 services:**

```yaml
services:
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  postgres:
    image: postgres:16-alpine
    ports: ["5432:5432"]
    environment:
      POSTGRES_USER: lazarus
      POSTGRES_PASSWORD: lazarus
      POSTGRES_DB: lazarus

  neo4j:
    image: neo4j:5
    ports: ["7474:7474", "7687:7687"]
    environment:
      NEO4J_AUTH: neo4j/lazarus

  go-service:
    build: .
    ports: ["8080:8080"]
    depends_on: [redis, postgres, neo4j]
    env_file: .env
    restart: on-failure
    volumes:
      - blueprints:/tmp/blueprints

  openclaw:
    image: node:24-alpine
    command: openclaw gateway
    ports: ["18789:18789"]
    volumes:
      - ./openclaw:/workspace/openclaw
    environment:
      OPENCLAW_HOME: /workspace/openclaw
    depends_on: [go-service]

  photon-service:
    build: ./photon-service
    ports: ["3001:3001"]
    env_file: .env
    restart: on-failure
    volumes:
      - blueprints:/tmp/blueprints

  seed:
    build: .
    command: ["/app/lazarus", "seed"]
    depends_on: [postgres, neo4j]
    env_file: .env
    restart: "no"

volumes:
  blueprints:
  postgres_data:
  neo4j_data:
  redis_data:
```

**Dockerfile (Go multi-stage):**
```dockerfile
FROM golang:1.22-alpine AS builder
WORKDIR /build
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o lazarus ./cmd/lazarus

FROM alpine:3.19
WORKDIR /app
COPY --from=builder /build/lazarus .
COPY data/ ./data/
COPY index.html .
EXPOSE 8080
CMD ["./lazarus"]
```

**PDF shared volume:** The `blueprints` named volume is mounted at `/tmp/blueprints` on both `go-service` and `photon-service`. This is how the PDF generated by Go gets read by the Photon service for attachment upload. See Contract 5.

**Photon TypeScript service:**

Sign up at `photon.codes/spectrum` with promo code `HACKPTON2026` for free Pro access. Get `PROJECT_ID` and `PROJECT_SECRET` from the dashboard.

`src/client.ts` — on startup:
1. POST to `https://api.photon.codes/projects/{PROJECT_ID}/imessage/tokens` with header `Authorization: Basic base64(PROJECT_ID:PROJECT_SECRET)`
2. Response contains `{ token, address }` — pass to `createClient({ address, token })` from `@photon-ai/advanced-imessage`
3. Implement retry with exponential backoff on `AuthenticationError` and `ConnectionError`

`src/send.ts` — HTTP handlers:
- `POST /send-alert`: calls `im.messages.send(target, message)`
- `POST /send-file`: calls `im.attachments.upload(filePath)` then sends a message with the attachment
- Both validate `target` is present, return 400 if not

`src/subscribe.ts` — persistent event loop:
- Call `im.messages.subscribe()` on startup
- For each `message.received` event: if message text (trimmed, lowercased) equals `"draft"`, POST `{ chat, sender }` to `${GO_SERVICE_URL}/inbound`
- Use SDK's `.filter()` for `message.received` events only
- Handle `ConnectionError` with `retry: true` on the subscribe call

`src/index.ts`:
- Init client (token issuance)
- Start Express on port 3001
- Start subscribe loop in background
- Log `[PHOTON-SERVICE] Ready` when both are up
- Add `GET /health` that returns `{ status: "ok", photon_connected: boolean }`

`photon-service/Dockerfile`:
```dockerfile
FROM node:18-slim
WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm install
COPY src/ ./src/
RUN npx tsc
CMD ["node", "dist/index.js"]
```

**`internal/tools/replay.go`** (your Go file):

Implement `POST /tools/replay`. When called:
1. Read `data/swarm_logs.json`
2. Spawn a goroutine that broadcasts each event to the WebSocket hub with a 2.4-second delay between each
3. Return `{ "status": "replay_started", "events": N }` immediately

This is the nuclear fallback for total network outage — the demo log panel fills as if agents are running.

**`scripts/demo.sh`:**

```bash
#!/bin/bash
set -e

if [ "$DEPLOY_TARGET" = "dedalus" ]; then
  go run ./cmd/lazarus deploy
  echo "Waiting for Go service health on Control Plane..."
  until curl -sf http://$CONTROL_PLANE_IP:8080/ > /dev/null; do sleep 1; done
else
  docker-compose down -v
  docker-compose up -d redis postgres neo4j
  echo "Waiting for databases..."
  until docker-compose exec postgres pg_isready -U lazarus > /dev/null 2>&1; do sleep 1; done
  docker-compose up -d go-service openclaw photon-service seed
  echo "Waiting for Go service..."
  until curl -sf http://localhost:8080/ > /dev/null; do sleep 1; done
fi

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║    LAZARUS NEXUS IS LIVE                 ║"
echo "║    Dashboard: http://localhost:8080      ║"
echo "║    Trigger:   http://localhost:8080/trigger ║"
echo "╚══════════════════════════════════════════╝"
```

**Testing the Photon service standalone:**
```bash
cd photon-service
npm install
PHOTON_PROJECT_ID=xxx PHOTON_PROJECT_SECRET=yyy PHOTON_IMESSAGE_TARGET=+15551234567 GO_SERVICE_URL=http://localhost:8080 npx ts-node src/index.ts
```

Then: `curl -X POST http://localhost:3001/send-alert -H 'Content-Type: application/json' -d '{"target":"+15551234567","message":"Lazarus test"}'`

**Pre-demo Photon checklist:**
- Pre-create the conversation with the exec's iMessage handle on Saturday night so it does not count as a "new conversation" on demo day (limit: 50 new conversations/line/day)
- Confirm send + receive round-trip works before Sunday

---

## Merge Order

Follow this order on Sunday morning to avoid conflicts:

1. **Member 4** merges `docker-compose.yml` + `.env.example` first — everyone can now `docker-compose up`
2. **Member 1** merges Go core — tool server is live, all endpoints respond
3. **Member 2** merges WebSocket hub + the `main.go` stub replacement + `index.html` changes
4. **Member 3** merges OpenClaw config + all agent definitions
5. **Member 4** merges Photon service + `scripts/` — final integration layer

Each merge touches different directories. Steps 2 and 3 can merge in either order — they do not conflict.

---

## Quick Conflict Checklist

Before pushing, verify you have not edited any of these outside your ownership:

| File | Owner |
|---|---|
| `cmd/lazarus/main.go` | Member 1 (Member 2 may submit one targeted PR — see Contract 6) |
| `go.mod` / `go.sum` | Member 1 |
| `internal/websocket/*` | Member 2 |
| `index.html` | Member 2 |
| `openclaw/*` | Member 3 |
| `docker-compose.yml` | Member 4 |
| `Dockerfile` | Member 4 |
| `photon-service/*` | Member 4 |
| `scripts/*` | Member 4 |
| `.env.example` | Member 4 |
| `data/*` | Member 1 |
