"""Database setup for the Lazarus operational truth ledger."""

from __future__ import annotations

import os
from collections.abc import Generator

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg2://postgres:postgres@127.0.0.1:5432/lazarus_db",
)

engine = create_engine(DATABASE_URL, future=True)
SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
    class_=Session,
)


class Base(DeclarativeBase):
    """Base declarative model."""


def apply_runtime_migrations() -> None:
    """Apply small additive schema changes for local MVP compatibility."""
    statements = [
        """
        ALTER TABLE hypotheses
        ADD COLUMN IF NOT EXISTS recommended_action TEXT
        """,
        """
        ALTER TABLE hypotheses
        ADD COLUMN IF NOT EXISTS priority_level VARCHAR(32)
        """,
        """
        ALTER TABLE hypotheses
        ADD COLUMN IF NOT EXISTS disagreement_score DOUBLE PRECISION
        """,
        """
        ALTER TABLE hypotheses
        ADD COLUMN IF NOT EXISTS evidence_coverage_score DOUBLE PRECISION
        """,
        """
        ALTER TABLE hypotheses
        ADD COLUMN IF NOT EXISTS requires_hitl BOOLEAN DEFAULT FALSE
        """,
    ]
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


def get_db() -> Generator[Session, None, None]:
    """Yield a database session for FastAPI endpoints."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
