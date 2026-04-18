import fetch from "node-fetch";
import { state } from "./client";

const GO_SERVICE_URL = process.env.GO_SERVICE_URL || "http://go-service:8080";

async function forwardToGo(event: any): Promise<void> {
  try {
    const res = await fetch(`${GO_SERVICE_URL}/inbound`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat: event.chat || event.sender,
        sender: event.sender,
      }),
    });
    if (!res.ok) {
      console.error(
        `[PHOTON-SERVICE] /inbound returned ${res.status}: ${await res.text()}`
      );
    }
  } catch (err: any) {
    console.error("[PHOTON-SERVICE] /inbound forward failed:", err?.message || err);
  }
}

function extractText(event: any): string {
  return (event?.message?.text || event?.text || "").toString();
}

export async function startSubscribeLoop(): Promise<void> {
  if (!state.client) {
    console.warn("[PHOTON-SERVICE] subscribe skipped — no client");
    return;
  }
  console.log("[PHOTON-SERVICE] Starting im.messages.subscribe() loop");
  try {
    const stream = state.client.im.messages.subscribe({ retry: true });
    const filtered = stream.filter
      ? stream.filter((e: any) => e?.type === "message.received")
      : stream;

    for await (const event of filtered) {
      try {
        const text = extractText(event).trim().toLowerCase();
        console.log(
          `[PHOTON-SERVICE] inbound event from ${event?.sender || "?"}: "${text}"`
        );
        if (text === "draft") {
          await forwardToGo(event);
        }
      } catch (inner: any) {
        console.error(
          "[PHOTON-SERVICE] event handler error:",
          inner?.message || inner
        );
      }
    }
  } catch (err: any) {
    console.error(
      "[PHOTON-SERVICE] subscribe loop errored:",
      err?.message || err
    );
    setTimeout(() => {
      startSubscribeLoop().catch(() => {});
    }, 5000);
  }
}
