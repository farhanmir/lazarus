"""Messages / Follow-Up Assistant API routes."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app import crud, schemas
from backend.app.agents.follow_up_assistant import answer_follow_up
from backend.app.db import get_db
from backend.app.services.blueprint_service import create_blueprint_job, start_blueprint_job

router = APIRouter(tags=["messages"])

_PAPERWORK_TRIGGERS = (
    "draft paperwork",
    "draft the paperwork",
    "draft paperwork.",
    "send paperwork",
    "send blueprint",
)


@router.post("/runs/{run_id}/messages", response_model=schemas.MessageResponse, status_code=status.HTTP_201_CREATED)
def post_message(run_id: UUID, payload: schemas.MessageCreate, db: Session = Depends(get_db)):
    run = crud.get_run(db, run_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found.")

    # Persist user message
    crud.create_message(db, run_id=run_id, role="user", content=payload.question)

    normalized_question = payload.question.strip().lower()
    if any(trigger in normalized_question for trigger in _PAPERWORK_TRIGGERS):
        hypothesis = next(iter(run.hypotheses), None) if getattr(run, "hypotheses", None) else None
        if hypothesis is None:
            assistant_msg = crud.create_message(
                db,
                run_id=run_id,
                role="assistant",
                content="No hypothesis available yet. Run evaluation first, then I can draft paperwork.",
                sources_json=["run-hypothesis"],
            )
            return assistant_msg

        blueprint = create_blueprint_job(db, hypothesis.id)
        start_blueprint_job(blueprint.id, create_notification=True)
        assistant_msg = crud.create_message(
            db,
            run_id=run_id,
            role="assistant",
            content=(
                "Drafting paperwork now. I triggered Photon delivery to your configured iMessage channel. "
                f"Blueprint job: {blueprint.id}."
            ),
            sources_json=["photon", f"blueprint-{blueprint.id}"],
        )
        return assistant_msg

    # Generate grounded answer
    answer = answer_follow_up(db, run_id, payload.question)

    # Persist assistant message
    assistant_msg = crud.create_message(
        db,
        run_id=run_id,
        role="assistant",
        content=answer.answer,
        sources_json=answer.sources,
    )
    return assistant_msg


@router.get("/runs/{run_id}/messages", response_model=schemas.ConversationResponse)
def get_conversation(run_id: UUID, db: Session = Depends(get_db)):
    run = crud.get_run(db, run_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found.")

    messages = crud.list_messages(db, run_id)
    return schemas.ConversationResponse(
        run_id=run_id,
        messages=[schemas.MessageResponse.model_validate(m) for m in messages],
    )
