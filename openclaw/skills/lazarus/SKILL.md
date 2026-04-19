---
name: lazarus
description: Operate the Lazarus drug-repurposing intelligence platform — run multi-agent analysis pipelines, search drugs, generate blueprints, and manage the portfolio.
metadata: {"openclaw":{"requires":{"env":["LAZARUS_BASE_URL"]},"primaryEnv":"LAZARUS_BASE_URL"}}
---

# Lazarus — Drug Repurposing Intelligence

You are the operator for **Lazarus**, a pharma portfolio intelligence backend that evaluates drug-repurposing hypotheses through a multi-agent reasoning pipeline.

## Architecture

Lazarus runs a 14-step agent pipeline for each drug asset:

1. **Advocate** (GPT-4o) — proposes a repurposing indication
2. **Skeptic** (K2 Think) — challenges with risks and contraindications
3. **Parallel Evidence** (4 branches) — mechanism, safety, trial, business evidence
4. **Evidence Curator** — consolidates and scores evidence
5. **Assessment** — evaluates disagreement and coverage
6. **Judge** — renders final confidence + decision
7. **Trial Strategist** — recommends next clinical action
8. **HITL Router** — determines if human review is needed
9. **Effort Estimator** — estimates implementation effort
10. **Impact Predictor** — predicts potential impact

## Base URL

Use the environment variable `LAZARUS_BASE_URL` (default: `http://127.0.0.1:8000`).

## Available API Endpoints

### Portfolio & Assets

- `GET /assets/` — List all drug assets in the portfolio
- `GET /assets/{id}` — Get details for a specific asset
- `GET /hypotheses/` — List all repurposing hypotheses
- `GET /hypotheses/{id}` — Get a specific hypothesis with scores

### Run the Pipeline

- `POST /runs/` — Start a new analysis run
  ```json
  {"asset_id": "<uuid>", "run_type": "manual"}
  ```
- `GET /runs/` — List all pipeline runs
- `GET /runs/{id}` — Get run details including agent steps and scores

### OpenClaw Bridge (preferred for operator use)

- `GET /openclaw/health` — Health check
- `POST /openclaw/review-asset` — Run the full pipeline for an asset by code
  ```json
  {
    "asset_code": "RX-782",
    "run_type": "manual",
    "generate_blueprint": true,
    "create_notification": false
  }
  ```
  Returns: decision, confidence, target disease, recommended action, and optional blueprint.

- `POST /openclaw/generate-blueprint` — Generate a clinical trial blueprint
  ```json
  {
    "asset_code": "RX-782",
    "create_notification": false
  }
  ```

### Drug Search (Real-Time APIs)

- `GET /scan/drugs?q=<query>` — Search drugs by name (OpenTargets)
  Returns: list of `{chembl_id, name, description, drug_type, max_phase, is_approved}`

- `GET /scan/drug-context?drug_name=<name>&disease=<disease>` — Full context for a drug+disease
  Returns: `{target, linked_diseases, adverse_events, evidence_refs}`

### Blueprints

- `GET /blueprints/` — List generated blueprints
- `GET /blueprints/{id}/download` — Download blueprint HTML

### Knowledge Graph

- `GET /graph/summary` — Get Neo4j graph summary
- `GET /graph/asset/{code}` — Get graph data for an asset

### Memories

- `GET /memories/asset/{id}` — Get reasoning memories for an asset
- `GET /memories/run/{id}` — Get memories from a specific run

## How to Use

### Quick asset review
```
Use exec to call:
curl -s http://127.0.0.1:8000/openclaw/review-asset \
  -H "Content-Type: application/json" \
  -d '{"asset_code":"RX-782","run_type":"manual","generate_blueprint":false}'
```

### Search for a drug
```
curl -s "http://127.0.0.1:8000/scan/drugs?q=imatinib"
```

### Get full drug context
```
curl -s "http://127.0.0.1:8000/scan/drug-context?drug_name=imatinib&disease=leukemia"
```

### List portfolio
```
curl -s http://127.0.0.1:8000/assets/
```

## Response Formatting

When presenting results to the user:
- Always include the **asset code** (e.g., RX-782)
- Show **confidence as a percentage** (multiply by 100 if ≤1)
- Highlight the **decision** (Advance, Hold, Deprioritize)
- Mention the **target disease** and **recommended action**
- If a blueprint was generated, provide the download link

## Error Handling

- If an asset code is not found, suggest listing available assets first
- If the backend is unreachable, check if it's running on port 8000
- Pipeline runs can take 30-60 seconds due to multiple LLM calls
