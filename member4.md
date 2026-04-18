# Member 4 — Progress

## Done

### Infrastructure
- **`.env.example`** — full spec (Dedalus, BYOK, Photon, DB, Deploy, Fallback). DB creds: `lazarus:lazarus`.
- **`docker-compose.yml`** — 7 services (redis, postgres, neo4j, go-service, openclaw, photon-service, seed) + named volumes (`redis_data`, `postgres_data`, `neo4j_data`, `blueprints`). Postgres + Neo4j have healthchecks; go-service/seed depend on `service_healthy`.
- **`Dockerfile`** — Go 1.22-alpine multi-stage → alpine:3.19; copies `data/`, `index.html`; creates `/tmp/blueprints`.
- **`.gitignore`** — added `photon-service/dist/`, `lazarus` binary, `MACHINE_IDS.json`.

### Photon Service (TypeScript sidecar)
- `photon-service/package.json` — deps: `@photon-ai/advanced-imessage`, `spectrum-ts`, `express`, `node-fetch`.
- `photon-service/tsconfig.json` — strict, ES2022, outDir `dist`.
- `photon-service/Dockerfile` — node:18-slim multi-stage.
- `photon-service/.dockerignore`.
- `src/client.ts` — token issuance via Basic auth to `api.photon.codes`, createClient w/ retry, singleton `state`, exponential backoff on auth/connection error.
- `src/send.ts` — `POST /send-alert`, `POST /send-file`. Validates input, returns 400/502. Auto re-issues token on AuthenticationError.
- `src/subscribe.ts` — `im.messages.subscribe({retry:true})`, filters `message.received`, forwards `DRAFT` replies to `${GO_SERVICE_URL}/inbound` w/ `{chat, sender}`. Self-reconnects on fatal.
- `src/index.ts` — Express on :3001, `GET /health` returns `{status, photon_connected, last_error}`, starts subscribe loop in background, logs `[PHOTON-SERVICE] Ready`.

### Scripts
- `scripts/seed.sh` — waits for postgres/neo4j, runs `go run ./cmd/lazarus seed`, applies `db/setup_neo4j.cypher`. Idempotent. Tolerates Member 1 not having `seed` subcommand yet (logs warn, continues).
- `scripts/demo.sh` — reads `DEPLOY_TARGET`. Local: `docker compose up` in dependency order, waits for health, runs seed, prints banner. Dedalus: calls `go run ./cmd/lazarus wake`.
- Both chmod +x.

### Go files
- `internal/tools/replay.go` — `ReplayHandler(deps)` registers `POST /tools/replay`. Reads `data/swarm_logs.json`, broadcasts each event with 2.4s gap via goroutine. Uses interface `replayDeps { Broadcaster(); SwarmLogsPath() }` so Member 1's `Deps` struct just needs those two methods.
- `internal/dedalus/client.go` — Singleton Client wrapping `dedalus-labs/dedalus-sdk-go`. `Init()`, `Get()`, `HealthCheck()`.
- `internal/dedalus/machines.go` — `ProvisionAppMachine`, `ProvisionDataMachine`, `WakeMachines`, `SleepMachines`, `SaveMachines`, `LoadMachines`. Persists IDs to `MACHINE_IDS.json` (gitignored).

## Handoffs to other members

### Member 1 (Go core)
- **Wire `replay.go`**: in `internal/tools/server.go`, call `mux.HandleFunc("POST /tools/replay", tools.ReplayHandler(deps))`. Your `Deps` struct must expose:
  - `Broadcaster() websocket.HubBroadcaster`
  - `SwarmLogsPath() string` (just return `"data/swarm_logs.json"`)
- **Add Dedalus dep** to `go.mod`: `github.com/dedalus-labs/dedalus-sdk-go`. SDK method names in `dedalus/machines.go` (Machines.Create/Update/Exec/List) match the implementation plan — if the real SDK differs, patch the struct param names in that file only.
- **Add `seed` and `wake` subcommands** to `cmd/lazarus/main.go` so `scripts/seed.sh` and `scripts/demo.sh` (dedalus mode) work.

### Member 3 (OpenClaw)
- OpenClaw service in docker-compose runs `npm install -g openclaw && openclaw gateway`. If your config requires different startup, tell me and I'll adjust.
- OpenClaw container mounts `./openclaw:/workspace/openclaw` and sets `OPENCLAW_HOME=/workspace/openclaw`.

### Everyone
- Photon PDF delivery requires both `go-service` and `photon-service` to share the `blueprints` named volume. Member 1 must write PDFs to `/tmp/blueprints/blueprint-{id}.pdf` (per Contract 5).

## Pending / deferred
- **Photon account setup** — needs manual signup at `photon.codes/spectrum` w/ code `HACKPTON2026` + creating a project + linking iMessage line. Must be done Saturday night with real `PHOTON_PROJECT_ID`/`PHOTON_PROJECT_SECRET` in `.env`.
- **SDK fidelity check** — `@photon-ai/advanced-imessage` API calls (`im.messages.send`, `im.attachments.upload`, `im.messages.subscribe`) come from the implementation plan; verify against actual SDK once installed. Compile-time safe (used `@ts-ignore` on SDK import).
- **Dedalus SDK fidelity** — same caveat; real `dedalus-labs/dedalus-sdk-go` may use slightly different struct field names.

## Verification steps once Member 1 lands Go core
1. `docker compose up --build redis postgres neo4j` — DBs come up healthy.
2. `docker compose up --build go-service` — Go service builds + runs on :8080.
3. `docker compose up --build photon-service` — Photon service comes up on :3001; `curl localhost:3001/health` returns JSON.
4. `./scripts/demo.sh` — full stack starts cleanly.
