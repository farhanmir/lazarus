# Photon Spectrum Integration

Photon Spectrum fits Lazarus as the **operator communication layer**.

Recommended role:

- Photon Spectrum receives inbound chat/webhook commands from messaging channels
- Lazarus remains the reasoning backend
- Lazarus returns a short analysis or blueprint response
- Photon can optionally relay that response back to the originating sender

## Suitable Layer

Use Photon Spectrum for:

- inbound operator commands
- webhook-driven asset review requests
- outbound messaging replies and blueprint notifications

Do **not** use Photon Spectrum as:

- the medical evidence source
- the reasoning engine
- the graph or scoring layer

## Routes

- `GET /photon/health`
- `POST /photon/spectrum/webhook`

## Supported webhook actions

You can call the webhook with either structured `action` fields or simple text.

Examples:

```json
{
  "action": "review",
  "asset_code": "RX-782",
  "sender_id": "user-123",
  "generate_blueprint": true,
  "create_notification": false
}
```

```json
{
  "text": "review RX-782",
  "sender_id": "user-123"
}
```

```json
{
  "action": "blueprint",
  "asset_code": "RX-782",
  "sender_id": "user-123"
}
```

## Environment variables

```env
PHOTON_BASE_URL=https://api.neutron.health
PHOTON_AUTH_URL=https://auth.neutron.health/oauth/token
PHOTON_AUDIENCE=https://api.neutron.health
PHOTON_CLIENT_ID=replace-me
PHOTON_CLIENT_SECRET=replace-me
# Optional fallback if you already have a bearer token:
PHOTON_API_KEY=
PHOTON_SEND_PATH=/messages
PHOTON_SPECTRUM_SEND_PATH=/messages
PHOTON_RECIPIENT=optional-default-recipient
```

`PHOTON_SPECTRUM_SEND_PATH` is used for direct reply sends from the Spectrum webhook bridge.

Recommended auth approach:

- use Photon machine-to-machine credentials from the Photon settings page
- Lazarus exchanges them at `PHOTON_AUTH_URL`
- Lazarus caches the resulting bearer token in memory

Use `PHOTON_API_KEY` only as a fallback when you already have a valid access token.
