#!/usr/bin/env bash
# scripts/seed.sh
# Seeds Postgres (patients, clinical_trials) and Neo4j (knowledge graph) for Lazarus.
# Idempotent: safe to re-run. Waits for DB health before proceeding.

set -euo pipefail

# Load .env if present (does not override already-set vars)
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

POSTGRES_DSN="${POSTGRES_DSN:-postgres://lazarus:lazarus@localhost:5432/lazarus?sslmode=disable}"
NEO4J_URI="${NEO4J_URI:-bolt://localhost:7687}"
NEO4J_USER="${NEO4J_USER:-neo4j}"
NEO4J_PASSWORD="${NEO4J_PASSWORD:-lazarus}"

echo "[seed] waiting for postgres..."
for i in $(seq 1 60); do
  if docker compose exec -T postgres pg_isready -U lazarus >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "[seed] waiting for neo4j..."
for i in $(seq 1 60); do
  if docker compose exec -T neo4j cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" "RETURN 1" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo "[seed] running Go seed binary..."
if command -v go >/dev/null 2>&1 && [ -f cmd/lazarus/main.go ]; then
  go run ./cmd/lazarus seed || echo "[seed] WARN: go seed returned non-zero (Member 1 may not have implemented 'seed' subcommand yet)"
else
  echo "[seed] skipping go seed — Go binary not available in this shell"
fi

if [ -f db/setup_neo4j.cypher ]; then
  echo "[seed] applying db/setup_neo4j.cypher..."
  docker compose exec -T neo4j cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" < db/setup_neo4j.cypher || \
    echo "[seed] WARN: cypher seed failed (file may be empty — Member 1 fills this)"
fi

echo "[seed] done."
