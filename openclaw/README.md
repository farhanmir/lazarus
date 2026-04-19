# Lazarus OpenClaw — AI Agent Framework + Spectrum Bridge

Local OpenClaw integration for Lazarus. OpenClaw is a self-hosted AI agent
framework that can operate the Lazarus pipeline through skills, tools, and
webhooks.

## Architecture

```
┌──────────────┐     exec/curl      ┌────────────────────┐
│   OpenClaw   │ ─────────────────► │  Lazarus Backend   │
│  Gateway     │                    │  (FastAPI :8000)   │
│  (:18789)    │ ◄───── webhook ─── │                    │
└──────────────┘                    └────────────────────┘
      │                                      │
      ▼                                      ▼
  Skills/Tools                         Multi-Agent Pipeline
  - lazarus skill                      - Advocate → Skeptic
  - exec tool                          - Evidence → Judge
  - web_fetch                          - Blueprint generation
```

OpenClaw talks to Lazarus via HTTP (exec + curl or web_fetch). Lazarus can
optionally notify OpenClaw back via the webhook client.

## Files

- `openclaw.json` — OpenClaw gateway configuration
- `skills/lazarus/SKILL.md` — Lazarus skill (teaches OpenClaw the API)
- `spectrum-local.ts` — iMessage bridge (separate from OpenClaw)

## Quick Start

### 1. Install OpenClaw

```bash
npm install -g openclaw@latest
openclaw onboard --install-daemon
```

Requires Node 22.16+ or Node 24.

### 2. Start the Gateway

```bash
cd openclaw
npm run openclaw:gateway
# or directly:
openclaw gateway --port 18789
```

### 3. Make sure Lazarus backend is running

```bash
cd backend && uvicorn app.main:app --reload --port 8000
```

### 4. Talk to OpenClaw

OpenClaw will use the `lazarus` skill to interact with the Lazarus API.
You can ask it to review assets, search drugs, generate blueprints, etc.

## Webhooks

Lazarus can push events to OpenClaw via mapped hooks:

```bash
# Trigger a review
curl -X POST http://127.0.0.1:18789/hooks/lazarus-review \
  -H "Authorization: Bearer lazarus-openclaw-hook-token" \
  -H "Content-Type: application/json" \
  -d '{"asset_code": "RX-782", "generate_blueprint": "true"}'

# Search for a drug
curl -X POST http://127.0.0.1:18789/hooks/lazarus-search \
  -H "Authorization: Bearer lazarus-openclaw-hook-token" \
  -H "Content-Type: application/json" \
  -d '{"query": "imatinib"}'
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `LAZARUS_BASE_URL` | `http://127.0.0.1:8000` | Lazarus backend URL |
| `OPENCLAW_GATEWAY_URL` | `http://127.0.0.1:18789` | OpenClaw gateway URL |
| `OPENCLAW_HOOK_TOKEN` | `lazarus-openclaw-hook-token` | Shared webhook token |

---

## Spectrum / iMessage Bridge (separate)
- `SPECTRUM_BASE_URL=http://127.0.0.1:8765`
- `SPECTRUM_RECIPIENT=<your phone number or chat id>`

If `SPECTRUM_RECIPIENT` is set, a successful manual dashboard run will send a
short summary message through the local Spectrum bridge.

## Lazarus bridge endpoints

The Spectrum bridge calls these Lazarus routes:

- `POST /photon/spectrum/webhook` (Photon alias; local bridge targets this URL)
- `POST /openclaw/review-asset`
- `POST /openclaw/generate-blueprint`

See `../backend/app/README_OPENCLAW.md` for details.

## Notes

- The local Spectrum bridge is intentionally thin: Lazarus owns the
  multi-agent reasoning, graph, and blueprint pipeline.
- No separate cloud agent infrastructure is required.
