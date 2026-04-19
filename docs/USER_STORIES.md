# Lazarus — User Stories

User stories are grouped by persona. Each story is written in the classic
form: *As a [persona], I want [capability] so that [outcome].* Acceptance
criteria are phrased as observable behavior of the running system, not as
implementation tasks.

---

## Persona: R&D Operator

### US-OP-01 · Scan a shelved portfolio for rescues
> As an R&D operator, I want to see every shelved asset ranked by rescue
> potential so that I know where to spend my next hour.

**Acceptance**
- The Rescue tab lists each asset with (confidence, impact, effort, HITL-drag).
- Sorting by any of those columns is stable and idempotent.
- A single click kicks off a new reasoning run on the selected asset.

### US-OP-02 · Watch an agent think in real time
> As an operator, I want to watch the agents reason live so that I trust the
> output instead of seeing a spinner and a final number.

**Acceptance**
- Clicking "Run analysis" opens the reasoning lab with a live stream.
- Each agent step (Advocate, Skeptic, Evidence, Judge …) appears with its
  score, input summary, output summary, and any citations as it completes.
- If WebSocket fails, the UI transparently falls back to polling
  `/runs/{id}/trace` without losing frames.

### US-OP-03 · Re-run against a different disease
> As an operator, I want to ask "what about lupus?" on an asset that was
> originally scanned for rheumatoid arthritis, so that I can stress-test
> alternate indications without re-onboarding the asset.

**Acceptance**
- A `disease_query` parameter on `/api/evaluate` changes only the target
  indication — asset metadata and prior-run history are preserved.
- The resulting run appears as a new row under that asset, not a replacement.

---

## Persona: Scientific Reviewer

### US-SR-01 · Audit the evidence for a hypothesis
> As a reviewer, I want to click any agent step and see the exact literature
> it consulted, so that I can spot hallucinated citations.

**Acceptance**
- Expanding an `AgentStep` shows its citation list with live PubMed / CT.gov
  links.
- The Skeptic's PubMed cross-check is visible as its own sub-step, not a
  hidden heuristic.

### US-SR-02 · Compare multiple hypotheses side-by-side
> As a reviewer, I want to diff two hypotheses on the same asset so I can
> decide which to forward to committee.

**Acceptance**
- `/assets/{id}/hypotheses/compare` returns a structured diff
  (confidence, impact, effort, rationales).
- The UI renders the diff in a split view with matching highlights.

### US-SR-03 · Explore the biological graph
> As a reviewer, I want to traverse the Drug → Target → Disease graph around
> a candidate so I can validate the mechanistic claim visually.

**Acceptance**
- The Graph tab renders the Neo4j neighborhood of the selected asset using
  Cytoscape + cytoscape-cola.
- Nodes are color-coded by type; edges are labeled with the relationship.

---

## Persona: HITL Gatekeeper

### US-HITL-01 · Find the queue
> As a human reviewer, I want a single dashboard of everything waiting on me
> so I never miss a blocked blueprint.

**Acceptance**
- `/human-reviews/dashboard` lists open `HumanReview` records newest-first.
- Each row links directly to the run trace that produced it.

### US-HITL-02 · Approve or reject with a note
> As a reviewer, I want to resolve a review with a short rationale so the
> downstream blueprint captures my reasoning.

**Acceptance**
- Resolution accepts `{status: approved|rejected, note: string}`.
- Once resolved, the downstream blueprint step either proceeds (approved) or
  is suppressed with the rejection note attached to the hypothesis.

> ⚠️ **Hackathon gap:** the approve/reject UI surface is a stub today —
> records are created but resolution is API-only. See [`ISSUES.md`](ISSUES.md).

---

## Persona: Executive / Committee

### US-EX-01 · Receive a one-page brief
> As a VP of R&D, I want the rescue delivered as a clean PDF so I can forward
> it to my team without opening a dashboard.

**Acceptance**
- `/generate-blueprint` produces a Jinja + WeasyPrint PDF with:
  exec summary, technical summary, confidence, citations, impact/effort economics.
- The PDF is retrievable by signed URL for 24h after generation.

### US-EX-02 · Get pinged in iMessage
> As an exec, I want a short iMessage when a high-confidence rescue is ready,
> with a tappable link to the PDF.

**Acceptance**
- When `SPECTRUM_RECIPIENT` is set, a successful high-confidence run pushes a
  summary + link to the configured iMessage handle.
- If Photon/Spectrum is unreachable, Lazarus falls back to BlueBubbles.

---

## Persona: Conversational Operator (OpenClaw)

### US-OC-01 · Review an asset from chat
> As a desktop user, I want to say *"review RX-782"* in an OpenClaw chat and
> get the same pipeline that the web UI runs.

**Acceptance**
- The `lazarus` OpenClaw skill translates chat commands into
  `POST /openclaw/review-asset` calls with bearer-token auth.
- The reply contains the hypothesis summary + a link to the full trace.

### US-OC-02 · Generate a blueprint from chat
> As a desktop user, I want to ask for the PDF inline so I don't have to
> context-switch to the dashboard.

**Acceptance**
- `review RX-782 generate_blueprint=true` produces a PDF and returns the
  signed URL in the chat reply.

---

## Cross-cutting stories

### US-X-01 · Demo without Wi-Fi
> As a presenter, I want every pipeline to run end-to-end on a venue with
> flaky internet.

**Acceptance**
- `LAZARUS_DISCOVERY_DEMO_CACHE=true` serves a canned CT.gov-shaped payload.
- All LLM-driven agents degrade to deterministic fallbacks when keys are
  absent — the trace still looks coherent.

### US-X-02 · Survive a missing API key
> As an operator setting up locally, I want a half-configured system to still
> produce a runnable demo.

**Acceptance**
- With only `DATABASE_URL` set, `python -m backend.app.seed` + `uvicorn` +
  `npm run dev` produces a working pipeline using deterministic agents.
