// Lazarus Neo4j Schema Initialization
// Usage: Run these commands in the Neo4j Browser or via cypher-shell

// 1. Create Uniqueness Constraints
CREATE CONSTRAINT drug_id_unique IF NOT EXISTS FOR (d:Drug) REQUIRE d.drug_id IS UNIQUE;
CREATE CONSTRAINT disease_id_unique IF NOT EXISTS FOR (d:Disease) REQUIRE d.disease_id IS UNIQUE;
CREATE CONSTRAINT target_id_unique IF NOT EXISTS FOR (t:Target) REQUIRE t.target_id IS UNIQUE;
CREATE CONSTRAINT trial_id_unique IF NOT EXISTS FOR (c:ClinicalTrial) REQUIRE c.trial_id IS UNIQUE;
CREATE CONSTRAINT evidence_id_unique IF NOT EXISTS FOR (e:Evidence) REQUIRE e.evidence_id IS UNIQUE;
CREATE CONSTRAINT hypothesis_id_unique IF NOT EXISTS FOR (h:RepurposingHypothesis) REQUIRE h.hypothesis_id IS UNIQUE;

// 2. Verified Node Schema (for reference)
// Node Labels: Drug, Disease, Target, ClinicalTrial, Evidence, RepurposingHypothesis

// 3. Documented Relationships (for reference)
// (:Drug)-[:FAILED_FOR]->(:Disease)
// (:Drug)-[:ORIGINALLY_INDICATED_FOR]->(:Disease)
// (:Drug)-[:TARGETS]->(:Target)
// (:Drug)-[:TESTED_IN]->(:ClinicalTrial)
// (:ClinicalTrial)-[:FOR_DISEASE]->(:Disease)
// (:Drug)-[:SUPPORTED_BY]->(:Evidence)
// (:Disease)-[:SUPPORTED_BY]->(:Evidence)
// (:Target)-[:SUPPORTED_BY]->(:Evidence)
// (:ClinicalTrial)-[:SUPPORTED_BY]->(:Evidence)
// (:RepurposingHypothesis)-[:PROPOSES_REPURPOSING_OF]->(:Drug)
// (:RepurposingHypothesis)-[:FROM_DISEASE]->(:Disease)
// (:RepurposingHypothesis)-[:TO_DISEASE]->(:Disease)
// (:RepurposingHypothesis)-[:BASED_ON_TARGET]->(:Target)
// (:RepurposingHypothesis)-[:SUPPORTED_BY]->(:Evidence)
