#!/usr/bin/env bash
# scripts/demo.sh
# One-command demo start. Local mode = Docker Compose. Dedalus mode = wake DCS machines.

set -euo pipefail

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

DEPLOY_TARGET="${DEPLOY_TARGET:-local}"

banner() {
  echo ""
  echo "╔══════════════════════════════════════════════════╗"
  echo "║    LAZARUS NEXUS IS LIVE                         ║"
  echo "║    Dashboard: http://localhost:8080              ║"
  echo "║    Trigger:   http://localhost:8080/trigger      ║"
  echo "║    Neo4j:     http://localhost:7474              ║"
  echo "║    Photon:    http://localhost:3001/health       ║"
  echo "╚══════════════════════════════════════════════════╝"
  echo ""
}

wait_http() {
  local url="$1"
  local name="$2"
  local tries="${3:-60}"
  echo "[demo] waiting for $name at $url ..."
  for i in $(seq 1 "$tries"); do
    if curl -sf "$url" >/dev/null 2>&1; then
      echo "[demo] $name is up."
      return 0
    fi
    sleep 2
  done
  echo "[demo] WARN: $name did not respond in time (continuing anyway)"
  return 1
}

case "$DEPLOY_TARGET" in
  dedalus)
    echo "[demo] DEPLOY_TARGET=dedalus — waking DCS machines..."
    if [ -f cmd/lazarus/main.go ]; then
      go run ./cmd/lazarus wake
    else
      echo "[demo] ERROR: Go binary not available — cannot wake Dedalus machines"
      exit 1
    fi

    APP_URL="${APP_MACHINE_URL:-http://localhost:8080}"
    wait_http "$APP_URL/" "go-service (dedalus)"
    echo "[demo] Dedalus demo ready: $APP_URL"
    ;;

  local|*)
    echo "[demo] DEPLOY_TARGET=local — starting Docker Compose stack..."

    docker compose down --remove-orphans >/dev/null 2>&1 || true
    docker compose up -d redis postgres neo4j

    echo "[demo] waiting for databases..."
    for i in $(seq 1 60); do
      if docker compose exec -T postgres pg_isready -U lazarus >/dev/null 2>&1; then
        break
      fi
      sleep 1
    done

    docker compose up -d go-service openclaw photon-service

    wait_http "http://localhost:8080/" "go-service"
    wait_http "http://localhost:3001/health" "photon-service" 30 || true

    echo "[demo] running seed..."
    bash scripts/seed.sh || echo "[demo] WARN: seed returned non-zero"

    banner
    ;;
esac
