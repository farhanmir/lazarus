# Lazarus Bio-Nexus Data Schema

This document defines the data structures used for the "Smoke and Mirrors" MVP demo, ensuring authenticity and reliability as we rescue assets from the **VALLEY OF DEATH**.

## 1. NHANES Laboratory Data (`patients_mock.json`)
We use official NHANES variable prefixes to provide immediate scientific credibility to the datasets viewed by judges.

| Variable | Description | Value Type | Demo Role |
| :--- | :--- | :--- | :--- |
| `SEQN` | Sequence Number (Patient ID) | Integer | Unique identifier |
| `RIAGENDR` | Gender (1: Male, 2: Female) | Int (Enum) | Used for subgroup filtering |
| `RIDAGEYR` | Age in Years | Integer | Used for subgroup filtering |
| `LBXGH` | Glycohemoglobin (HbA1c %) | Float | Primary efficacy metric |
| `LBXCRP` | C-Reactive Protein (mg/L) | Float | The "Hidden Marker" for Zeloprin success |
| `LBXGLU` | Fasting Glucose (mg/dL) | Float | Supplementary metabolic data |
| `DRUG_EXPOSURE` | Zeloprin Dosage (mg) | Float | Treatment vs. Control (0mg) |
| `EFFICACY_DELTA` | Calculated % Change | Percentage | The "Billion-Dollar" signal |

---

## 2. Adversarial Agent Logs (`swarm_logs.json` / WebSocket)
The schema for the "Agent Theater" UI.

```json
{
  "timestamp": "2026-04-19T08:15:22Z",
  "agent_id": "GEMMA_ADVOCATE",
  "name": "Gemma v4",
  "category": "HYPOTHESIS_GENERATION",
  "message": "Detecting efficacy spike in SEQN sub-cluster (Female, Age 65+). Correlating with high LBXCRP markers.",
  "confidence": 0.92,
  "metadata": {
    "subgroup_size": 412,
    "p_value": 0.004
  }
}
```

---

## 3. Executive Blueprint Metadata (`blueprint_rescue.json`)
The source data for the final "Mic-Drop" one-page report.

- `asset_id`: "RX-782-ZELOPRIN"
- `status`: "RESCUED"
- `target_pathology`: "Inflammatory-driven Type 2 Diabetes"
- `subgroup_definition`: "Post-menopausal females (65+) w/ baseline CRP > 3.0 mg/L"
- `rescue_narrative`: "Mechanism of action (PPAR-gamma) successfully modulated by high systemic inflammation markers previously ignored in Phase 2 aggregate analysis."
- `key_stats`: { "efficacy_increase": "84%", "p_value": "< 0.001" }

---

## 4. Knot API Filter Schema (`knot_sync.json`)
```json
{
  "transaction_id": "tx_9982",
  "merchant": "Regeneron Specialty Pharmacy",
  "amount": 240.50,
  "item_name": "Modafinil 200mg",
  "bio_category": "PERFORMANCE_ENHANCEMENT",
  "agent_relevance": true
}
```
