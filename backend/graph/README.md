# Lazarus — Neo4j Knowledge Graph

This module owns the Lazarus biological knowledge graph. It models failed
clinical assets, original indications, targets, trials, evidence, and
repurposing hypotheses — the read side of this graph backs the Cytoscape
"Graph" tab in the UI, and the reasoning agents consult it for context.

## Folder structure

```text
backend/
  graph/
    __init__.py
    schema.py
    seed_data.py
    load_graph.py
    queries.cypher
    README.md
```

## Schema overview

- `Drug` captures the asset, its modality, sponsor, stage, and failure context.
- `Disease` is used for both original failed indications and candidate repurposed indications.
- `Target` anchors mechanism-level reasoning.
- `ClinicalTrial` preserves trial history and links failed assets back to concrete development events.
- `Evidence` attaches traceable support to drugs, diseases, targets, trials, and hypotheses.
- `RepurposingHypothesis` is the bridge Lazarus will use later for advocate/skeptic/judge workflows.

The current mock dataset includes five coherent asset stories. One of them is the required demo pattern: `RX-782` failed for asthma, targets `JAK1`, and is hypothesized for lupus.

## Constraints

```cypher
CREATE CONSTRAINT drug_drug_id_unique IF NOT EXISTS FOR (n:Drug) REQUIRE n.drug_id IS UNIQUE;
CREATE CONSTRAINT disease_disease_id_unique IF NOT EXISTS FOR (n:Disease) REQUIRE n.disease_id IS UNIQUE;
CREATE CONSTRAINT target_target_id_unique IF NOT EXISTS FOR (n:Target) REQUIRE n.target_id IS UNIQUE;
CREATE CONSTRAINT clinical_trial_trial_id_unique IF NOT EXISTS FOR (n:ClinicalTrial) REQUIRE n.trial_id IS UNIQUE;
CREATE CONSTRAINT evidence_evidence_id_unique IF NOT EXISTS FOR (n:Evidence) REQUIRE n.evidence_id IS UNIQUE;
CREATE CONSTRAINT repurposing_hypothesis_hypothesis_id_unique IF NOT EXISTS FOR (n:RepurposingHypothesis) REQUIRE n.hypothesis_id IS UNIQUE;
```

## How to run

1. Ensure Neo4j is running locally or remotely.
2. Set environment variables:

```bash
export NEO4J_URI="bolt://localhost:7687"
export NEO4J_USERNAME="neo4j"
export NEO4J_PASSWORD="your-password"
```

3. Activate the project environment:

```bash
source venv/bin/activate
```

4. Load the graph:

```bash
python -m backend.graph.load_graph
```

5. Open Neo4j Browser and run the queries from `backend/graph/queries.cypher`.

## Notes

- The loader uses `MERGE` for both nodes and relationships, so rerunning it is safe.
- Seed data lives in `seed_data.py` as plain Python dictionaries for easy hackathon editing.
- The reasoning pipeline currently *reads* from Neo4j for context but does not yet write hypotheses back — see [`docs/ISSUES.md`](../../docs/ISSUES.md).
