// Query A: all failed drugs and their failed indications
MATCH (drug:Drug)-[:FAILED_FOR]->(disease:Disease)
RETURN drug.name AS drug,
       drug.status AS drug_status,
       disease.name AS failed_indication
ORDER BY drug;

// Query B: drug-target-trial-disease chain
MATCH (drug:Drug)-[:TARGETS]->(target:Target)
MATCH (drug)-[:TESTED_IN]->(trial:ClinicalTrial)-[:FOR_DISEASE]->(disease:Disease)
RETURN drug.name AS drug,
       target.symbol AS target,
       trial.trial_id AS trial_id,
       trial.phase AS phase,
       disease.name AS trial_disease
ORDER BY drug;

// Query C: repurposing hypotheses with supporting evidence count
MATCH (hyp:RepurposingHypothesis)-[:PROPOSES_REPURPOSING_OF]->(drug:Drug)
MATCH (hyp)-[:FROM_DISEASE]->(from_disease:Disease)
MATCH (hyp)-[:TO_DISEASE]->(to_disease:Disease)
OPTIONAL MATCH (hyp)-[:SUPPORTED_BY]->(evidence:Evidence)
RETURN hyp.title AS hypothesis,
       drug.name AS drug,
       from_disease.name AS from_disease,
       to_disease.name AS to_disease,
       count(evidence) AS supporting_evidence_count
ORDER BY hyp.final_confidence DESC;

// Query D: demo traversal for a failed drug
WITH "RX-782" AS failed_drug_name
MATCH (drug:Drug {name: failed_drug_name})-[:FAILED_FOR]->(failed_disease:Disease)
MATCH (drug)-[:TARGETS]->(target:Target)
MATCH (hyp:RepurposingHypothesis)-[:PROPOSES_REPURPOSING_OF]->(drug)
MATCH (hyp)-[:TO_DISEASE]->(candidate_disease:Disease)
OPTIONAL MATCH (hyp)-[:SUPPORTED_BY]->(evidence:Evidence)
RETURN drug.name AS failed_drug,
       failed_disease.name AS failed_disease,
       target.symbol AS target,
       candidate_disease.name AS candidate_repurposed_disease,
       collect(DISTINCT evidence.title) AS supporting_evidence
ORDER BY candidate_repurposed_disease;
