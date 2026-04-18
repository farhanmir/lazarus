"""Graph payload builder for the Step 5 visualization layer."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from backend.app import crud, schemas
from backend.app.services.context_service import build_asset_context


def build_graph_payload(db: Session, asset_id: UUID) -> schemas.GraphResponse:
    """Build a visualization-friendly graph dataset for an asset."""
    asset = crud.get_asset(db, asset_id)
    if asset is None:
        raise ValueError("Asset not found.")

    context = build_asset_context(asset)
    hypotheses = [item for item in crud.list_hypotheses(db) if item.asset_id == asset.id]
    latest_hypothesis = hypotheses[0] if hypotheses else None
    target_disease = (
        latest_hypothesis.target_disease
        if latest_hypothesis is not None
        else (context.linked_diseases[0] if context.linked_diseases else "Unknown Disease")
    )
    confidence = latest_hypothesis.final_confidence if latest_hypothesis is not None else None

    nodes = [
        schemas.GraphNode(
            id=context.asset_code,
            type="Drug",
            label=context.asset_code,
            description=f"{asset.internal_name} shelved for {context.source_disease}",
            confidence=confidence,
            highlight=True,
        ),
        schemas.GraphNode(
            id=context.target,
            type="Target",
            label=context.target,
            description=f"Primary target inferred from context builder for {context.source_disease}.",
            highlight=True,
        ),
        schemas.GraphNode(
            id=context.source_disease,
            type="Disease",
            label=context.source_disease,
            description="Original indication from the operational ledger.",
        ),
        schemas.GraphNode(
            id=target_disease,
            type="Disease",
            label=target_disease,
            description="Proposed repurposed indication from the most recent hypothesis.",
            confidence=confidence,
            highlight=True,
        ),
    ]

    links = [
        schemas.GraphLink(
            source=context.asset_code,
            target=context.target,
            relationship="TARGETS",
            highlight=True,
        ),
        schemas.GraphLink(
            source=context.asset_code,
            target=context.source_disease,
            relationship="ORIGINALLY_INDICATED_FOR",
        ),
        schemas.GraphLink(
            source=context.target,
            target=target_disease,
            relationship="LINKED_TO",
            highlight=True,
        ),
    ]

    if latest_hypothesis is not None:
        hypothesis_node_id = f"HYP-{latest_hypothesis.id}"
        nodes.append(
            schemas.GraphNode(
                id=hypothesis_node_id,
                type="Hypothesis",
                label="Repurposing Hypothesis",
                description=latest_hypothesis.summary,
                confidence=latest_hypothesis.final_confidence,
                highlight=True,
            )
        )
        links.extend(
            [
                schemas.GraphLink(
                    source=hypothesis_node_id,
                    target=context.asset_code,
                    relationship="GENERATED",
                    highlight=True,
                ),
                schemas.GraphLink(
                    source=hypothesis_node_id,
                    target=target_disease,
                    relationship="PROPOSES",
                    highlight=True,
                ),
            ]
        )

    for evidence in context.evidence_refs:
        nodes.append(
            schemas.GraphNode(
                id=evidence.source_ref,
                type="Evidence",
                label=evidence.source_ref,
                description=evidence.title,
            )
        )
        links.append(
            schemas.GraphLink(
                source=target_disease,
                target=evidence.source_ref,
                relationship="SUPPORTED_BY",
            )
        )

    return schemas.GraphResponse(
        asset_id=asset.id,
        asset_code=context.asset_code,
        hypothesis_id=latest_hypothesis.id if latest_hypothesis is not None else None,
        nodes=nodes,
        links=links,
    )
