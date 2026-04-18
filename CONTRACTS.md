# Lazarus — Team Contracts

This file is the single source of truth for every interface between the four parallel workstreams. Read your member section completely before touching any code. Do not change anything defined here without a team sync — a broken contract breaks everyone else.

---

## Team Assignments

| Member | Owns | Directories / Files |
|---|---|---|
| **Member 1** | Python/FastAPI Data Layer + Reasoning Logic | `backend/` |
| **Member 2** | React Frontend + Graph Visualization | `frontend/` |
| **Member 3** | OpenClaw agent definitions and configuration | `openclaw/` |
| **Member 4** | Infrastructure + Dedalus Deployment CLI (Go) | `docker-compose.yml`, `docs/`, `scripts/`, `cmd/lazarus/deploy.go` |

**One rule:** never edit a file owned by another member without asking first.

---

## Environment Variables

All members depend on these. Member 4 creates `.env.example`. Everyone creates their own `.env` locally from it. For local dev outside Docker, replace Docker service hostnames with `localhost`.

| Variable | Used By | Purpose |
|---|---|---|
| `DEDALUS_API_KEY` | Members 3, 4 | Dedalus dashboard API key — used for DCS machine management and as the API key for Unified API routing |
| `DEDALUS_ORG_ID` | Member 4 | Required for DCS machine operations (`X-Dedalus-Org-Id` header) |
| `GEMINI_API_KEY` | Member 3 | Google AI Studio key — passed as BYOK through Dedalus Unified API; never called directly |
| `K2_API_KEY` | Member 3 | MBZUAI K2 Think V2 key — passed as BYOK through Dedalus Unified API |
| `SPECTRUM_PROJECT_ID` | Member 1 | From Photon dashboard — used to issue iMessage tokens |
| `SPECTRUM_SECRET_KEY` | Member 1 | From Photon dashboard — used in Basic auth |
| `SPECTRUM_RECIPIENT` | Members 1 | Exec's iMessage handle (phone number or Apple ID email) |
| `DATABASE_URL` | Member 1 | Full Postgres connection string |
| `REDIS_URL` | Member 1 | Redis connection string |
| `NEO4J_URI` | Member 1 | Neo4j bolt connection URI |
| `NEO4J_USERNAME` | Member 1 | Neo4j username |
| `NEO4J_PASSWORD` | Member 1 | Neo4j password |
| `OPENCLAW_STATE_DIR` | Members 3, 4 | Path where OpenClaw stores its runtime state (e.g. `/home/machine/.openclaw` on DCS) |
| `NODE_COMPILE_CACHE` | Member 4 | Node.js compile cache directory |
| `DEPLOY_TARGET` | Member 4 | `local` for Docker Compose, `dedalus` for DCS machines |

---

## Contract 1: FastAPI Endpoints (Member 1)

Member 1 implements the FastAPI backend on port `8000`. 
The core data structure is the "run analysis" which routes through the OpenClaw agents.

**Key Endpoints:**
- `POST /run-analysis`
- `GET /runs/{run_id}/stream`
- `POST /generate-blueprint`

**CRITICAL RIGOR CONTRACT:** The Python backend must calculate the `p_value` for each subgroup using a deterministic Fisher's Exact Test (`scipy.stats.fisher_exact`). The LLM must not guess or hallucinate this value. The `data/patients_mock.json` must be seeded such that this calculation naturally yields a statistically significant P-value (< 0.001) for the target cohort.

---

## Contract 2: OpenClaw Agent Swarm (Member 3)

Member 3 configures the reasoning agents in `openclaw/`.

**Agent Mappings to Presentation Logic:**
- **The Mortician:** Implemented as `evidence_curator.py`
- **The Defibrillator:** Implemented as `advocate.py`. Uses `gemini-via-dedalus`.
- **The Coroner:** Implemented as `skeptic.py`. Uses `k2-via-dedalus`.
- **The High Priest:** Implemented as `judge.py`.

**Gateway API:** The OpenClaw gateway listens on port `18789` and exposes an OpenAI-compatible completions endpoint at `POST /v1/chat/completions`. `gateway.bind` must be `0.0.0.0`.

---

## Contract 3: Photon/Spectrum Bridge (Member 1)

The backend (`backend/app/api/photon.py` and `spectrum.py`) is uniquely responsible for transmitting the finalized PDF Blueprint to the Executive over iMessage using the Photon SDK.

---

## Contract 4: Dedalus Multi-VM Deployment (Member 4)

This contract governs how Member 4 provisions and manages OpenClaw on DCS machines.

**Machine specifications:**
- Advocate Node: 2 vCPU, 4096 MiB RAM, 10 GiB storage
- Skeptic Node: 2 vCPU, 4096 MiB RAM, 10 GiB storage

**Wake-after-sleep behavior (critical):** When a Dedalus machine wakes from sleep, only `/home/machine` persists. The root filesystem resets — Node.js is gone. The `WakeMachines` Go deployment script (`cmd/lazarus/deploy.go`) must therefore SSH into each agent machine, re-run the full Node.js installation via NodeSource, and re-execute the gateway startup script.

---

## Contract 5: Frontend Graph (Member 2)

Member 2 owns `frontend/src/App.jsx`.
Connect to Neo4j to render an interactive force-directed graph. Connect to the `/runs/{run_id}/stream` to provide live terminal logging of the reasoning process. 

---

## Quick Conflict Checklist

Before pushing, verify you have not edited any file outside your ownership:

| File | Owner |
|---|---|
| `backend/*` | Member 1 |
| `frontend/*` | Member 2 |
| `openclaw/*` | Member 3 |
| `docker-compose.yml` | Member 4 |
| `cmd/lazarus/deploy.go` | Member 4 |
| `docs/*` | Member 4 |
