# OpenClaw Integration

This is the lowest-risk OpenClaw integration for Lazarus: keep OpenClaw as the
operator interface and let Lazarus remain the reasoning backend.

Recommended iMessage path for new setups:

- OpenClaw + BlueBubbles for conversational iMessage control
- Lazarus for reasoning, graph access, run ledgering, and blueprint generation

## What OpenClaw calls

Lazarus exposes these bridge endpoints:

- `GET /openclaw/health`
- `POST /openclaw/review-asset`
- `POST /openclaw/generate-blueprint`

If `OPENCLAW_SHARED_TOKEN` is set, send it as:

```http
Authorization: Bearer <OPENCLAW_SHARED_TOKEN>
```

## Example asset review request

```bash
curl -X POST http://127.0.0.1:8000/openclaw/review-asset \
  -H "Authorization: Bearer your-shared-token" \
  -H "Content-Type: application/json" \
  -d '{
    "asset_code": "RX-782",
    "run_type": "manual",
    "generate_blueprint": true,
    "create_notification": false
  }'
```

## Example blueprint request

```bash
curl -X POST http://127.0.0.1:8000/openclaw/generate-blueprint \
  -H "Authorization: Bearer your-shared-token" \
  -H "Content-Type: application/json" \
  -d '{
    "asset_code": "RX-782",
    "create_notification": false
  }'
```

## Suggested OpenClaw hook mapping

Use OpenClaw's mapped hook support to translate a chat command into a Lazarus
HTTP request. A minimal example:

```json
{
  "hooks": {
    "enabled": true,
    "token": "replace-with-openclaw-hook-token",
    "path": "/hooks"
  }
}
```

Then point the OpenClaw action or external tool at:

- `http://127.0.0.1:8000/openclaw/review-asset`
- `http://127.0.0.1:8000/openclaw/generate-blueprint`

## What keys are needed

For the Lazarus bridge itself:

- no new model keys are required beyond the keys Lazarus already uses
- optional: `OPENCLAW_SHARED_TOKEN` for bearer auth

For OpenClaw itself:

- one OpenClaw Gateway auth token or webhook token
- whatever model/provider auth OpenClaw needs on its own side if you want the
  OpenClaw agent to interpret free-form chat before calling Lazarus

Recommended Monday-safe setup:

- Lazarus owns reasoning
- OpenClaw owns the chat/operator experience
- OpenClaw forwards structured calls into Lazarus

## BlueBubbles configuration

For iMessage, prefer BlueBubbles with OpenClaw. A typical OpenClaw config shape
looks like:

```json
{
  "channels": {
    "bluebubbles": {
      "enabled": true,
      "serverUrl": "http://your-mac:1234",
      "password": "replace-with-bluebubbles-password",
      "webhookPath": "/bluebubbles-webhook",
      "dmPolicy": "pairing"
    }
  }
}
```

Useful Lazarus-side env vars for direct notification fallback:

```env
BLUEBUBBLES_SERVER_URL=http://your-mac:1234
BLUEBUBBLES_PASSWORD=your-password
BLUEBUBBLES_CHAT_GUID=any;-;+15555550123
BLUEBUBBLES_API_PATH=/api/v1
```

If these are present, Lazarus will prefer BlueBubbles for blueprint delivery.
