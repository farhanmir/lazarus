"""Schema definitions for the Lazarus Neo4j scientific knowledge graph."""

from __future__ import annotations

SCHEMA_OVERVIEW = {
    "Drug": [
        "drug_id",
        "name",
        "mechanism_of_action",
        "modality",
        "development_stage",
        "status",
        "failure_reason",
        "company",
    ],
    "Disease": [
        "disease_id",
        "name",
        "category",
        "icd_code",
        "description",
    ],
    "Target": [
        "target_id",
        "name",
        "symbol",
        "target_type",
        "organism",
    ],
    "ClinicalTrial": [
        "trial_id",
        "title",
        "phase",
        "status",
        "enrollment",
        "start_date",
        "end_date",
        "failure_reason",
        "sponsor",
    ],
    "Evidence": [
        "evidence_id",
        "title",
        "source",
        "source_ref",
        "snippet",
        "confidence_score",
        "url",
        "published_date",
    ],
    "RepurposingHypothesis": [
        "hypothesis_id",
        "title",
        "summary",
        "status",
        "advocate_score",
        "skeptic_score",
        "judge_score",
        "final_confidence",
        "created_at",
    ],
}

RELATIONSHIP_OVERVIEW = [
    "(:Drug)-[:FAILED_FOR]->(:Disease)",
    "(:Drug)-[:ORIGINALLY_INDICATED_FOR]->(:Disease)",
    "(:Drug)-[:TARGETS]->(:Target)",
    "(:Drug)-[:TESTED_IN]->(:ClinicalTrial)",
    "(:ClinicalTrial)-[:FOR_DISEASE]->(:Disease)",
    "(:Drug)-[:SUPPORTED_BY]->(:Evidence)",
    "(:Disease)-[:SUPPORTED_BY]->(:Evidence)",
    "(:Target)-[:SUPPORTED_BY]->(:Evidence)",
    "(:ClinicalTrial)-[:SUPPORTED_BY]->(:Evidence)",
    "(:RepurposingHypothesis)-[:PROPOSES_REPURPOSING_OF]->(:Drug)",
    "(:RepurposingHypothesis)-[:FROM_DISEASE]->(:Disease)",
    "(:RepurposingHypothesis)-[:TO_DISEASE]->(:Disease)",
    "(:RepurposingHypothesis)-[:BASED_ON_TARGET]->(:Target)",
    "(:RepurposingHypothesis)-[:SUPPORTED_BY]->(:Evidence)",
]

CONSTRAINT_QUERIES = [
    "CREATE CONSTRAINT drug_drug_id_unique IF NOT EXISTS FOR (n:Drug) REQUIRE n.drug_id IS UNIQUE",
    "CREATE CONSTRAINT disease_disease_id_unique IF NOT EXISTS FOR (n:Disease) REQUIRE n.disease_id IS UNIQUE",
    "CREATE CONSTRAINT target_target_id_unique IF NOT EXISTS FOR (n:Target) REQUIRE n.target_id IS UNIQUE",
    "CREATE CONSTRAINT clinical_trial_trial_id_unique IF NOT EXISTS FOR (n:ClinicalTrial) REQUIRE n.trial_id IS UNIQUE",
    "CREATE CONSTRAINT evidence_evidence_id_unique IF NOT EXISTS FOR (n:Evidence) REQUIRE n.evidence_id IS UNIQUE",
    "CREATE CONSTRAINT repurposing_hypothesis_hypothesis_id_unique IF NOT EXISTS FOR (n:RepurposingHypothesis) REQUIRE n.hypothesis_id IS UNIQUE",
]
