# Lazarus Bio-Nexus Data Schema

This document defines the data structures used for the Lazarus project, ensuring authenticity and reliability as we rescue assets from the **VALLEY OF DEATH**.

## 1. Neo4j Knowledge Graph (Biological Truth)
Lazarus utilizes Neo4j to manage the complex relationships between drugs, diseases, targets, and evidence.

### Node Labels & Properties
| Label | Required Properties |
| :--- | :--- |
| **Drug** | `drug_id`, `name`, `mechanism_of_action`, `modality`, `development_stage`, `status`, `failure_reason`, `company` |
| **Disease** | `disease_id`, `name`, `category`, `icd_code`, `description` |
| **Target** | `target_id`, `name`, `symbol`, `target_type`, `organism` |
| **ClinicalTrial** | `trial_id`, `title`, `phase`, `status`, `enrollment`, `start_date`, `end_date`, `failure_reason`, `sponsor` |
| **Evidence** | `evidence_id`, `title`, `source`, `source_ref`, `snippet`, `confidence_score`, `url`, `published_date` |
| **RepurposingHypothesis** | `hypothesis_id`, `title`, `summary`, `status`, `advocate_score`, `skeptic_score`, `judge_score`, `final_confidence`, `created_at` |

### Relationships
*   `(:Drug)-[:FAILED_FOR]->(:Disease)`
*   `(:Drug)-[:ORIGINALLY_INDICATED_FOR]->(:Disease)`
*   `(:Drug)-[:TARGETS]->(:Target)`
*   `(:Drug)-[:TESTED_IN]->(:ClinicalTrial)`
*   `(:ClinicalTrial)-[:FOR_DISEASE]->(:Disease)`
*   `(:Drug)-[:SUPPORTED_BY]->(:Evidence)`
*   `(:Disease)-[:SUPPORTED_BY]->(:Evidence)`
*   `(:Target)-[:SUPPORTED_BY]->(:Evidence)`
*   `(:ClinicalTrial)-[:SUPPORTED_BY]->(:Evidence)`
*   `(:RepurposingHypothesis)-[:PROPOSES_REPURPOSING_OF]->(:Drug)`
*   `(:RepurposingHypothesis)-[:FROM_DISEASE]->(:Disease)`
*   `(:RepurposingHypothesis)-[:TO_DISEASE]->(:Disease)`
*   `(:RepurposingHypothesis)-[:BASED_ON_TARGET]->(:Target)`
*   `(:RepurposingHypothesis)-[:SUPPORTED_BY]->(:Evidence)`

### Uniqueness Constraints
*   `Drug.drug_id`
*   `Disease.disease_id`
*   `Target.target_id`
*   `ClinicalTrial.trial_id`
*   `Evidence.evidence_id`
*   `RepurposingHypothesis.hypothesis_id`

---

## 2. NHANES Laboratory Data (`patients_mock.json`)
We use official NHANES variable prefixes to provide immediate scientific credibility to the datasets viewed by judges.

| Variable | Description | Value Type | Demo Role |
| :--- | :--- | :--- | :--- |
| `NCTId` | ClinicalTrials.gov Identifier | String | The "Search Key" for the failed asset |
| `Condition` | Primary therapeutic area | String | Context for reasoning (e.g., T2D) |
| `Sponsor` | Biotech/Pharma company | String | The "Owner" of the dead asset |
| `OverallStatus` | Recruitment status | Enum | Filters for TERMINATED/WITHDRAWN |
| `SEQN` | Sequence Number (Patient ID) | Integer | Unique identifier for NHANES labs |
| `RIAGENDR` | Gender (1: Male, 2: Female) | Int (Enum) | Used for subgroup filtering |
| `RIDAGEYR` | Age in Years | Integer | Used for subgroup filtering |
| `LBXGH` | Glycohemoglobin (HbA1c %) | Float | Primary efficacy metric |
| `LBXCRP` | C-Reactive Protein (mg/L) | Float | The "Hidden Marker" for success |
| `LBXGLU` | Fasting Glucose (mg/dL) | Float | Supplementary metabolic data |
| `DRUG_EXPOSURE` | Zeloprin Dosage (mg) | Float | Treatment vs. Control (0mg) |
| `EFFICACY_DELTA` | Calculated % Change | Percentage | The "Billion-Dollar" signal |

---

## 2. Adversarial Agent Logs (`swarm_logs.json` / WebSocket)
The schema for the "Agent Theater" UI.

```json
{
  "timestamp": "2026-04-19T08:15:22Z",
  "agent_id": "THE_DEFIBRILLATOR",
  "name": "The Defibrillator (Gemma 4)",
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

## 3. Executive Blueprint Metadata (`blueprint_rescue.json`)
The source data for the final "Mic-Drop" one-page report.

- `asset_id`: "RX-782-ZELOPRIN"
- `status`: "RESCUED"
- `target_pathology`: "Inflammatory-driven Type 2 Diabetes"
- `subgroup_definition`: "Post-menopausal females (65+) w/ baseline CRP > 3.0 mg/L"
- `rescue_narrative`: "Mechanism of action (PPAR-gamma) successfully modulated by high systemic inflammation markers previously ignored in Phase 2 aggregate analysis."
- `key_stats`: { "efficacy_increase": "84%", "p_value": "< 0.001" }

