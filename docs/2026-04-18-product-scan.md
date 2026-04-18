# Lazarus — Full Product Scan
*Last updated: 2026-04-18*

---

## What This Is

Lazarus analyzes failed drug assets (clinical trials that flopped) and finds new diseases they could work for. Multi-agent reasoning pipeline → blueprint PDF → iMessage alert to executives.

---

## What's Fully Working

| Thing | Status |
|---|---|
| PostgreSQL | Live. 12 tables, seeded with 4 test assets (RX-782, RX-901, RX-455, RX-222) |
| FastAPI backend | Running on :8000, 12 routers, all endpoints defined |
| React frontend | Running on :5173, 6-tab UI, WebSocket polling for live updates |
| Agent pipeline | 5 agents chained: Advocate → Skeptic → parallel evidence → Evidence Curator → Judge |
| Dedalus LLM routing | Fully wired (Gemini 2.5 Flash, K2 Think V2, GPT-5-mini) |
| Gemini (Advocate, Judge) | Direct API calls + Dedalus fallback |
| K2 Think V2 (Skeptic) | Direct API + Dedalus fallback |
| Deterministic fallbacks | Every single agent has a hardcoded fallback if LLMs fail |
| Blueprint generation | WeasyPrint PDF → `/artifacts/blueprints/`, async job |
| iMessage (local mode) | `IMESSAGE_LOCAL=true` + spectrum-local.ts daemon for macOS |
| Neo4j (read) | Pulls diseases/evidence for graph visualization |
| Real-time UI | WebSocket `/runs/{id}/stream` polls every 0.8s, updates frontend live |

---

## What's Not Connected / Not Working

| Thing | Status |
|---|---|
| Redis | Docker container exists. Zero code uses it. |
| Rocketride | Env vars exist (`ROCKETRIDE_URI`, `ROCKETRIDE_APIKEY`). No code references them. |
| Neo4j (writes) | Pipeline never writes hypotheses back into the graph. Read-only. |
| HITL loop | Human review records get created when agents disagree, but no UI or API to resolve them. |
| Follow-up assistant | Stub. Returns placeholder answers. |
| Iteration loop | `assessment.should_iterate` flag is computed but loop is not wired. |
| OpenClaw gateway | Not running. Scripts deploy to Dedalus Cloud VMs — not set up. Backend has `/openclaw/review-asset` ready but nothing calls it. |

---

## The Core Flow (What Happens When You Click Analyze)

```
Click Analyze on RX-782
  ↓
POST /run-analysis/async  →  returns 202, starts background thread
  ↓
Build asset context from PostgreSQL + Neo4j
  ↓
Advocate (Gemini 2.5 Flash): proposes target disease
  ↓
Skeptic (K2 Think V2): challenges with risks
  ↓
4 parallel evidence branches: mechanism / safety / trial design / business
  ↓
Evidence Curator: synthesizes evidence
  ↓
Judge (Gemini): final decision + confidence score
  ↓
Effort Estimator (rules): cost + time estimate
  ↓
Impact Predictor (rules): patient population + commercial value
  ↓
HITL check: high disagreement → flag for human review
  ↓
Save all to PostgreSQL
  ↓
WebSocket pushes updates → frontend shows live step-by-step progress
```

---

## The 3 Separate Pieces

**Backend (Python/FastAPI)** — agent pipeline, all 12 routes, reasoning service, memory system. Core engine.

**Frontend (React)** — 6-tab dashboard: Dashboard, Graph Explorer, Agent Timeline, Strategy, Messages, Blueprint. Reads from backend via axios + WebSocket.

**OpenClaw + Infra (Node.js/TypeScript)** — Dedalus Cloud deployment scripts in `openclaw/`. Provisions VMs, installs OpenClaw, starts gateway. Not running anywhere currently. Backend has `/openclaw/review-asset` ready to receive calls — nobody is calling it.

---

## Agent Pipeline Detail

| Agent | Model | Role |
|---|---|---|
| Advocate | Gemini 2.5 Flash | Proposes repurposing hypothesis |
| Skeptic | K2 Think V2 | Challenges with safety/mechanism risks |
| Parallel Evidence (x4) | Rules | Mechanism, safety, trial, business branches |
| Evidence Curator | Gemini/Dedalus | Synthesizes evidence against skeptic concerns |
| Judge | Gemini 2.5 Flash | Final decision + confidence score |
| Trial Strategist | Deterministic | Operationalizes into trial design |
| Effort Estimator | Deterministic | Cost + time estimate |
| Impact Predictor | Deterministic | Patient population + commercial value |

---

## Database Overview

- **PostgreSQL** — Operational ledger: runs, steps, hypotheses, blueprints, memories, reviews
- **Neo4j** — Biological knowledge graph: diseases, genes, proteins, pathways, adverse events
- **Redis** — Defined, not used

---

## External Integrations

| Service | Wired | Notes |
|---|---|---|
| Dedalus Labs | Yes | Multi-model routing, BYOK headers |
| Gemini | Yes | Direct API, advocate + judge |
| K2 Think V2 | Yes | Direct API, skeptic |
| Neo4j Aura | Yes (read) | Graph data |
| Spectrum/iMessage | Partial | Local mode ready, project mode untested |
| OpenClaw | No | Scripts written, gateway not running |
| Redis | No | Container up, no code uses it |
| Rocketride | No | Env vars only |

---

## Biggest Gaps for Demo

1. **OpenClaw isn't running** — centerpiece of the pitch but currently just deploy scripts.
2. **iMessage demo** — requires macOS + Full Disk Access for Terminal. `spectrum-local.ts` is the bridge.
3. **HITL has no UI** — reviews created in DB, no page to show or resolve them.
4. **Follow-up assistant is a stub** — Messages tab exists but answers are placeholders.

---

## Course of Action

### P0 — Must work for demo

- [ ] Get OpenClaw gateway running (local or Dedalus Cloud) and confirm it can call `/openclaw/review-asset`
- [ ] Wire `spectrum-local.ts` so a real iMessage message triggers the full pipeline end-to-end
- [ ] Verify the analyze button fires the pipeline, WebSocket updates the UI in real time, and the result renders correctly on all 6 tabs
- [ ] Confirm blueprint PDF generates and is downloadable from the UI
- [ ] Seed data looks realistic and all 4 assets are selectable

### P1 — Should work for demo

- [ ] HITL tab or indicator — show when a run was flagged for human review
- [ ] Follow-up assistant returns real grounded answers (not placeholder)
- [ ] Graph Explorer shows actual nodes from Neo4j, not empty/mock data
- [ ] iMessage reply arrives back to sender after pipeline completes

### P2 — Nice to have

- [ ] Iteration loop actually re-runs when `should_iterate` is true
- [ ] Neo4j gets hypothesis written back into graph after a run
- [ ] Strategy tab effort/impact chart is populated from real run data

### Cut entirely

- [ ] Redis — nothing uses it, remove from docker-compose or leave dormant
- [ ] Rocketride — unknown purpose, ignore
- [ ] Multi-VM Dedalus swarm — only needed if single OpenClaw instance is the story; simplify pitch if needed
