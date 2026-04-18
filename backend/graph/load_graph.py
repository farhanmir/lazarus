"""Load the Lazarus Step 1 graph schema and seed dataset into Neo4j."""

from __future__ import annotations

import os
from typing import Any

from dotenv import load_dotenv
from neo4j import GraphDatabase

from backend.graph.schema import CONSTRAINT_QUERIES
from backend.graph.seed_data import SEED_DATA


def get_neo4j_settings() -> tuple[str, str, str, str]:
    """Read Neo4j connection settings from environment variables."""
    load_dotenv()

    uri = os.getenv("NEO4J_URI")
    username = os.getenv("NEO4J_USERNAME")
    password = os.getenv("NEO4J_PASSWORD")
    database = os.getenv("NEO4J_DATABASE", "neo4j")

    missing = [
        name
        for name, value in (
            ("NEO4J_URI", uri),
            ("NEO4J_USERNAME", username),
            ("NEO4J_PASSWORD", password),
        )
        if not value
    ]
    if missing:
        raise ValueError(
            "Missing Neo4j environment variables: " + ", ".join(missing)
        )

    return uri, username, password, database


def create_constraints(tx: Any) -> None:
    """Create all uniqueness constraints required by the graph schema."""
    for query in CONSTRAINT_QUERIES:
        tx.run(query)


def merge_nodes(tx: Any, label: str, id_field: str, rows: list[dict[str, Any]]) -> None:
    """Upsert nodes using the unique id for each label."""
    query = f"""
    UNWIND $rows AS row
    MERGE (n:{label} {{{id_field}: row.{id_field}}})
    SET n += row
    """
    tx.run(query, rows=rows)


def merge_relationships(
    tx: Any,
    source_label: str,
    source_key: str,
    relationship_type: str,
    target_label: str,
    target_key: str,
    rows: list[dict[str, Any]],
) -> None:
    """Upsert relationships between existing nodes."""
    query = f"""
    UNWIND $rows AS row
    MATCH (source:{source_label} {{{source_key}: row.{source_key}}})
    MATCH (target:{target_label} {{{target_key}: row.{target_key}}})
    MERGE (source)-[:{relationship_type}]->(target)
    """
    tx.run(query, rows=rows)


def load_seed_data() -> None:
    """Load the full graph foundation into Neo4j."""
    uri, username, password, database = get_neo4j_settings()
    driver = GraphDatabase.driver(uri, auth=(username, password))

    node_config = [
        ("Drug", "drug_id", SEED_DATA["drugs"]),
        ("Disease", "disease_id", SEED_DATA["diseases"]),
        ("Target", "target_id", SEED_DATA["targets"]),
        ("ClinicalTrial", "trial_id", SEED_DATA["clinical_trials"]),
        ("Evidence", "evidence_id", SEED_DATA["evidence"]),
        ("RepurposingHypothesis", "hypothesis_id", SEED_DATA["repurposing_hypotheses"]),
    ]

    relationship_config = [
        ("Drug", "drug_id", "FAILED_FOR", "Disease", "disease_id", SEED_DATA["relationships"]["drug_failed_for"]),
        ("Drug", "drug_id", "ORIGINALLY_INDICATED_FOR", "Disease", "disease_id", SEED_DATA["relationships"]["drug_originally_indicated_for"]),
        ("Drug", "drug_id", "TARGETS", "Target", "target_id", SEED_DATA["relationships"]["drug_targets"]),
        ("Drug", "drug_id", "TESTED_IN", "ClinicalTrial", "trial_id", SEED_DATA["relationships"]["drug_tested_in"]),
        ("ClinicalTrial", "trial_id", "FOR_DISEASE", "Disease", "disease_id", SEED_DATA["relationships"]["trial_for_disease"]),
        ("Drug", "drug_id", "SUPPORTED_BY", "Evidence", "evidence_id", SEED_DATA["relationships"]["drug_supported_by"]),
        ("Disease", "disease_id", "SUPPORTED_BY", "Evidence", "evidence_id", SEED_DATA["relationships"]["disease_supported_by"]),
        ("Target", "target_id", "SUPPORTED_BY", "Evidence", "evidence_id", SEED_DATA["relationships"]["target_supported_by"]),
        ("ClinicalTrial", "trial_id", "SUPPORTED_BY", "Evidence", "evidence_id", SEED_DATA["relationships"]["clinical_trial_supported_by"]),
        (
            "RepurposingHypothesis",
            "hypothesis_id",
            "PROPOSES_REPURPOSING_OF",
            "Drug",
            "drug_id",
            SEED_DATA["relationships"]["hypothesis_proposes_repurposing_of"],
        ),
        ("RepurposingHypothesis", "hypothesis_id", "FROM_DISEASE", "Disease", "disease_id", SEED_DATA["relationships"]["hypothesis_from_disease"]),
        ("RepurposingHypothesis", "hypothesis_id", "TO_DISEASE", "Disease", "disease_id", SEED_DATA["relationships"]["hypothesis_to_disease"]),
        ("RepurposingHypothesis", "hypothesis_id", "BASED_ON_TARGET", "Target", "target_id", SEED_DATA["relationships"]["hypothesis_based_on_target"]),
        ("RepurposingHypothesis", "hypothesis_id", "SUPPORTED_BY", "Evidence", "evidence_id", SEED_DATA["relationships"]["hypothesis_supported_by"]),
    ]

    with driver:
        with driver.session(database=database) as session:
            session.execute_write(create_constraints)
            for label, id_field, rows in node_config:
                session.execute_write(merge_nodes, label, id_field, rows)
            for config in relationship_config:
                session.execute_write(merge_relationships, *config)

    print("Lazarus Step 1 graph loaded successfully.")
    print(
        "Loaded "
        f"{len(SEED_DATA['drugs'])} drugs, "
        f"{len(SEED_DATA['diseases'])} diseases, "
        f"{len(SEED_DATA['targets'])} targets, "
        f"{len(SEED_DATA['clinical_trials'])} trials, "
        f"{len(SEED_DATA['evidence'])} evidence nodes, and "
        f"{len(SEED_DATA['repurposing_hypotheses'])} repurposing hypotheses."
    )


if __name__ == "__main__":
    load_seed_data()
