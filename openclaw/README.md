# Lazarus OpenClaw on Dedalus Cloud

This package deploys OpenClaw onto a Dedalus Cloud Services machine and gives
you a fast path to chat with it through the gateway HTTP API.

Lazarus remains the reasoning backend. OpenClaw becomes the operator layer.
It also includes a local Spectrum/iMessage bridge for hackathon demos on macOS.

## Files

- `openclaw.ts`: create or reuse a machine, install OpenClaw, configure the
  gateway, launch it, verify it, and send test chats
- `chat.ts`: send one message to an existing machine
- `spectrum-local.ts`: listen for local iMessage commands and forward them to
  Lazarus through `/spectrum/webhook`
- `.env.example`: required environment variables

## Setup

```bash
cd openclaw
cp .env.example .env
npm install
```

Fill `.env` with:

- `DEDALUS_API_KEY`
- one provider key for OpenClaw itself such as `GEMINI_API_KEY`
- optional `OPENCLAW_MACHINE_ID` to reuse an existing machine
- optional `OPENCLAW_GATEWAY_AUTH_MODE=token` and `OPENCLAW_GATEWAY_TOKEN`
- optional `LAZARUS_BASE_URL`

## Deploy

```bash
npm run deploy
```

This prints:

- the Dedalus machine id
- OpenClaw version
- a short greeting
- a Monday-use-case response
- the Lazarus bridge endpoints it should call next

## Chat

```bash
npm run chat -- <machine-id> "What can you do for Lazarus?"
```

If `OPENCLAW_MACHINE_ID` is set in `.env`, the machine id argument is optional.

## Local Spectrum / iMessage

```bash
npm run spectrum:local
```

This mode:

- requires macOS with Full Disk Access granted to your terminal
- watches direct iMessage chats through `@photon-ai/imessage-kit`
- forwards supported commands to `LAZARUS_BASE_URL/spectrum/webhook`
- replies back into the same conversation
- exposes a tiny local send bridge so the dashboard can push a summary message

Supported commands:

- `review RX-782`
- `analyze RX-901`
- `blueprint RX-782`
- `help`

Recommended env for local mode:

- `IMESSAGE_LOCAL=true`
- `LAZARUS_BASE_URL=http://127.0.0.1:8000`
- `SPECTRUM_BASE_URL=http://127.0.0.1:8765`
- `SPECTRUM_RECIPIENT=<your phone number or chat id>`

If `SPECTRUM_RECIPIENT` is set, a successful manual dashboard run will send a
short summary message through the local Spectrum bridge.

## Lazarus bridge endpoints

OpenClaw should call these Lazarus routes:

- `POST /openclaw/review-asset`
- `POST /openclaw/generate-blueprint`

See:

- `../backend/app/README_OPENCLAW.md`
- `lazarus-openclaw-example.json`

## Keys needed

For this package:

- `DEDALUS_API_KEY`
- one provider key for the model OpenClaw should use, for example
  `GEMINI_API_KEY`

Optional:

- `OPENCLAW_GATEWAY_TOKEN`
- `OPENCLAW_SHARED_TOKEN` for Lazarus bearer protection

## Notes

- OpenClaw is installed under `/home/machine` to avoid root filesystem space
  issues on Dedalus Cloud machines.
- The gateway is started through a detached script using `setsid`.
- The package uses `/v1/chat/completions` as the synchronous verification path.
- The local Spectrum bridge is intentionally thin: Lazarus still owns the
  multi-agent reasoning, graph, and blueprint pipeline.
