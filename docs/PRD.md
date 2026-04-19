# Lazarus — Product Requirements Document

*Last updated: 2026-04-19 · Status: Hackathon research preview (HackPrinceton Spring 2026)*

---

## 1 · Problem

Biopharma produces a huge volume of clinical assets that fail — but very few fail
because of the *molecule itself*. Assets get shelved for reasons that have
nothing to do with their biology:

- strategic pivots and portfolio cuts inside the sponsor,
- adverse events in the *wrong* indication,
- enrollment shortfalls or regulatory-timing misses,
- the sponsor running out of cash.

The molecules keep working. The patients that *would* benefit never see them.
Large biopharma therefore carries a hidden inventory of viable chemistry with
no active owner — a "graveyard" that is invisible on any dashboard.

## 2 · Goal

Turn that graveyard into a **live, searchable, rank-ordered R&D opportunity
surface**. Given a drug asset that failed in indication *A*, Lazarus should:

1. surface candidate indications *B* where the mechanism plausibly applies,
2. produce an auditable chain of reasoning (not a single opaque LLM call),
3. quantify the rescue in terms a research committee can act on — confidence,
   commercial impact, trial effort, risk — and
4. emit an **executive-ready blueprint PDF** that a VP of R&D could hand to
   their team the same afternoon.

## 3 · Users & Jobs-to-be-Done

| Persona | JTBD | Surface they use |
|---|---|---|
| **R&D operator / analyst** | "Scan our shelved portfolio for the highest-confidence rescues this week." | Operator dashboard (Rescue · Portfolio · Ops tabs) |
| **Scientific reviewer** | "Show me *why* the system believes RX-782 rescues lupus — which papers, which counter-arguments." | Reasoning Lab (`/agent-trace`) + Graph tab |
| **HITL gatekeeper** | "Every borderline hypothesis must cross my desk before it becomes a blueprint." | Human Review dashboard |
| **Exec / committee** | "Give me a one-page PDF with the bet, the risk, and the ask." | Blueprint PDF, optionally delivered via iMessage |
| **Conversational operator** | "From my desktop chat, ask Lazarus to score an asset and DM me the result." | OpenClaw skill pack · Photon/Spectrum bridge |

## 4 · Scope (v0 — hackathon)

### In scope
- Portfolio of shelved assets (seeded demo: RX-782, RX-901, RX-455, RX-222).
- Multi-agent reasoning pipeline (Advocate → Skeptic → Evidence → Trial Strategist → Effort/Impact → Judge).
- Streaming run traces to the UI (WebSocket + polling fallback).
- Postgres operational ledger for runs, steps, hypotheses, blueprints, reviews.
- Neo4j knowledge graph (read-only from the pipeline).
- Executive blueprint PDF (Jinja + WeasyPrint).
- HITL escalation queue for low-confidence / high-disagreement hypotheses.
- Offline demo-cache mode for live demos without internet.
- iMessage delivery via Photon/Spectrum, BlueBubbles fallback.
- OpenClaw skill pack for desktop conversational control.

### Explicitly out of scope (v0)
- Multi-tenant auth, row-level security.
- Vector memory / cross-run semantic retrieval.
- Formal evals (hallucination rate, citation grounding metrics).
- Neo4j GDS-backed portfolio similarity.
- Auto-writing hypotheses back into the graph — the pipeline currently reads only.

See [`ISSUES.md`](ISSUES.md) for the full list of hackathon-dictated cut-lines.

## 5 · Success criteria

- Judges can kick off a fresh run on any seeded asset and watch the agent
  trace render live end-to-end without refreshing.
- A low-confidence run correctly raises an HITL record and is blocked from
  blueprinting until resolved.
- A high-confidence run produces a downloadable, correctly formatted PDF
  blueprint in under 60 seconds.
- The same pipeline is drivable from (a) the web UI, (b) an OpenClaw skill
  invocation, and (c) an inbound iMessage — all hitting the same FastAPI.
- The pipeline degrades gracefully when any LLM provider is unreachable
  (deterministic fallback path).

## 6 · Non-goals

- Lazarus is **not** a drug-discovery tool. It does not generate novel
  chemistry; it repurposes existing molecules.
- Lazarus is **not** a medical device and makes no clinical claims. It is a
  research aid; the HITL gate exists because humans are the decision-makers.
- Lazarus is **not** a data warehouse. Postgres holds operational state only —
  the knowledge graph lives in Neo4j, external truth lives in ClinicalTrials.gov,
  PubMed, and openFDA.

## 7 · Key constraints

- **36-hour build window** at HackPrinceton — every decision was made under a
  time budget. Many "obvious next steps" were deliberately deferred; see
  [`ISSUES.md`](ISSUES.md).
- **Pluggable LLM providers** — no monoculture. Each agent routes to the model
  best-suited to its role (OpenAI · Gemini · K2-Think).
- **Demo-deterministic** — venue Wi-Fi is not a dependency.
