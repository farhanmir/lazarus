# Lazarus — Issue Tracker

*Last updated: 2026-04-19*

Lazarus was built in 36 hours at HackPrinceton Spring 2026. A lot of the
"wish-list" is intentionally deferred, not forgotten. This file is the single
place where those gaps are tracked so nothing falls off the radar after the
judging window.

**Legend**
- 🔴 **blocker** — breaks a core user story
- 🟠 **known gap** — documented limitation, pipeline still functions
- 🟡 **polish** — quality / UX debt
- 🟢 **roadmap** — post-hackathon direction, not yet started

---

## 🔴 Blockers

*(none open — the core pipeline runs end-to-end.)*

---

## 🟠 Known gaps (hackathon cut-lines)

### ISS-001 · HITL resolution UI is API-only
`HumanReview` rows are created correctly when the Advocate/Skeptic disagree or
when Judge confidence falls below the threshold — but there is no front-end
surface to approve/reject. Today an operator has to hit the endpoint directly.

- **Impact:** US-HITL-02 is only half-shipped.
- **Effort:** ~2h. Add a drawer in the reviews dashboard with approve/reject +
  note, wire to the existing `PATCH /human-reviews/{id}` route.

### ISS-002 · Pipeline does not write hypotheses back into Neo4j
The reasoning engine *reads* the knowledge graph for mechanistic context but
never writes resulting hypotheses back as `(:RepurposingHypothesis)` nodes.

- **Impact:** graph view shows seeded data only; re-running Lazarus does not
  enrich the graph over time.
- **Effort:** ~3h. Add a write step at the end of the orchestrator with
  idempotent `MERGE` on `hypothesis_id`.

### ISS-003 · Follow-up assistant is a stub
`backend/app/agents/follow_up.py` returns a placeholder response. The UI has
a chat surface wired up, but it does not retrieve from the run trace or
the graph yet.

- **Impact:** reviewers cannot drill into a run conversationally.
- **Effort:** ~4h. Ground replies in (a) the `AgentStep` list of the
  referenced run and (b) a Neo4j neighborhood query around the asset.

### ISS-004 · Iteration loop is declared but not wired
The orchestrator computes `assessment.should_iterate`, but there is no
second pass. The Judge sees only the first evidence round.

- **Impact:** borderline hypotheses never get the "look again" they should.
- **Effort:** ~3h. Loop the Evidence → Assessment steps up to N=2 when the
  flag is set; persist each pass as a distinct `AgentStep` batch.

### ISS-005 · Redis is provisioned but unused
Docker runs a Redis container and the env wires `REDIS_URL`, but no service
actually connects. Originally planned for the async job queue.

- **Impact:** long-running runs block a request-processing thread.
- **Effort:** ~6h. Introduce RQ or Celery; move `/run-analysis/async` and
  `/generate-blueprint/async` to background workers.

### ISS-006 · No formal evals on the agents
There is no offline harness for hallucination rate, citation grounding, or
Skeptic precision. Correctness today is "it looks right on the demo set."

- **Impact:** we cannot regression-test a model swap.
- **Effort:** ~1 day. Golden-file a dozen runs; diff each on key JSON fields
  and citation URL reachability.

### ISS-007 · Auth is hackathon-mode
OpenClaw endpoints are shared-token gated; the web UI has no auth at all.

- **Impact:** fine for demo, not fine for any real pilot.
- **Effort:** ~1 day. Add OAuth2 + row-level tenancy via the existing
  `CompanyAsset.tenant_id` column (currently unused).

### ISS-008 · Blueprint PDF templates are single-variant
Jinja renders one layout for every hypothesis. No theming, no
indication-specific callouts, no cover letter per recipient.

- **Impact:** execs see the same dossier shape every time.
- **Effort:** ~4h. Template variants keyed on
  `hypothesis.impact_analysis.commercial_band`.

---

## 🟡 Polish / UX debt

### ISS-010 · Graph tab layout thrash
`cytoscape-cola` re-layouts the entire graph every time a node is added,
which is jarring once the graph has >30 nodes.

- **Fix:** pin already-placed nodes; only run layout on new nodes.

### ISS-011 · WebSocket reconnect is silent
When the WS drops, the UI transparently switches to polling — but there is
no indicator that the reader is in degraded mode.

- **Fix:** add a small "polling (websocket unavailable)" pill in the
  reasoning-lab header.

### ISS-012 · Seed portfolio is tiny
Four assets (RX-782, RX-901, RX-455, RX-222). Enough for a demo, not enough
to show the ranking page doing real work.

- **Fix:** seed 25 assets covering oncology, immunology, CNS, metabolic.

### ISS-013 · Error toasts use a generic "Something went wrong"
When a downstream LLM call times out, the user sees a generic failure.
The error message from the orchestrator is not surfaced.

- **Fix:** propagate `AgentStep.error` into the toast copy.

### ISS-014 · README team table has placeholder links
`README.md` has `[GitHub](https://github.com/_________)` rows for teammates.

- **Fix:** teammates fill in their own links.

---

## 🟢 Roadmap (post-hackathon)

### ISS-100 · Vector memory for asset / run context
Add a `pgvector` column on `AssetMemory` and `RunMemory`. Use it to retrieve
similar prior runs before the Advocate fires, so the pipeline stops
re-discovering the same rationales.

### ISS-101 · Neo4j GDS-backed portfolio similarity
Run Node2Vec or FastRP over the knowledge graph. Use embeddings for
"show me the five assets most similar to this one" on the portfolio page.

### ISS-102 · Multi-tenant portfolios
Real biopharma pilots mean tenant isolation. `CompanyAsset.tenant_id` is
already a column — enforce it with Postgres row-level security + a
per-request tenant claim from the auth token.

### ISS-103 · Conversational scan builder
Today you pick an asset and kick off. The next UX is *"scan my immunology
portfolio for lupus rescues this quarter"* — a conversational DSL on top of
`/api/candidates` + `/portfolio/ranking`.

### ISS-104 · Explainable Judge
The Judge today emits a single confidence + recommendation. Add a
natural-language rationale paragraph that references specific Advocate /
Skeptic / Evidence steps by id, so the blueprint can cite its own reasoning.

### ISS-105 · Formal citation grounding
Every citation in the blueprint should resolve to a PubMed ID or CT.gov NCT.
Today the Skeptic spot-checks; add an end-of-pipeline validator that
rejects any citation that fails to resolve.

---

## Closed / shipped at hackathon

- ✅ Multi-agent reasoning DAG with 9 agents.
- ✅ Streaming agent trace via WebSocket with polling fallback.
- ✅ Postgres operational ledger + Neo4j knowledge graph + Cytoscape UI.
- ✅ Jinja + WeasyPrint blueprint PDF generator.
- ✅ HITL record creation on low-confidence / high-disagreement runs.
- ✅ Offline demo-cache mode (`LAZARUS_DISCOVERY_DEMO_CACHE=true`).
- ✅ iMessage delivery through Photon/Spectrum with BlueBubbles fallback.
- ✅ OpenClaw skill pack + local Spectrum bridge.
- ✅ Deterministic fallbacks on every LLM-driven agent.
