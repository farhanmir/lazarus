# Spectrum Integration

Spectrum fits Lazarus as the **operator communication layer**.

Recommended role:

- Spectrum receives inbound chat/webhook commands from iMessage or other messaging channels
- Lazarus remains the reasoning backend
- Lazarus returns a short analysis or blueprint response
- Spectrum can optionally relay that response back to the originating sender

## Suitable Layer

Use Spectrum for:

- inbound operator commands
- webhook-driven asset review requests
- outbound messaging replies and blueprint notifications

Do **not** use Spectrum as:

- the medical evidence source
- the reasoning engine
- the graph or scoring layer

## Routes

- `GET /spectrum/health`
- `POST /spectrum/webhook`

## Supported webhook actions

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
SPECTRUM_PROJECT_ID=
SPECTRUM_SECRET_KEY=
IMESSAGE_LOCAL=true
SPECTRUM_BASE_URL=
SPECTRUM_SEND_PATH=/messages
SPECTRUM_REPLY_PATH=/messages
SPECTRUM_RECIPIENT=
```

Recommended mode:

- local iMessage mode:
  - set `IMESSAGE_LOCAL=true`
  - keep `SPECTRUM_PROJECT_ID` and `SPECTRUM_SECRET_KEY` for dashboard/project identification
  - Lazarus accepts inbound Spectrum webhook calls and does not require outbound hosted API sends
- hosted outbound mode:
  - set `SPECTRUM_BASE_URL`
  - set `SPECTRUM_RECIPIENT` if you want notification sends
  - Lazarus uses `SPECTRUM_SECRET_KEY` as a bearer secret and sends `X-Spectrum-Project-ID`

Note:

- `SPECTRUM_BASE_URL` is optional in local mode
- if local mode is enabled, outbound HTTP sends are skipped gracefully
