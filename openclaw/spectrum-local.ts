import { config as loadEnv } from "dotenv";
import { createServer } from "node:http";
import { resolve } from "node:path";

import { IMessageSDK } from "@photon-ai/imessage-kit";

loadEnv({ path: resolve(process.cwd(), "../.env") });
loadEnv({ path: resolve(process.cwd(), ".env"), override: false });

type SpectrumWebhookResponse = {
  status?: string;
  action?: string;
  response_text?: string;
  asset_code?: string | null;
  run_id?: string | null;
  hypothesis_id?: string | null;
  blueprint_id?: string | null;
  blueprint_download_url?: string | null;
  detail?: string;
};

const lazarusBaseUrl = (process.env.LAZARUS_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const webhookUrl = `${lazarusBaseUrl}/photon/spectrum/webhook`;
const localModeEnabled = (process.env.IMESSAGE_LOCAL || "").toLowerCase() === "true";
const localBridgePort = Number(process.env.SPECTRUM_LOCAL_BRIDGE_PORT || "8765");
const localBridgePath = process.env.SPECTRUM_SEND_PATH || "/messages";

/**
 * Normalize recipient for the iMessage Kit SDK.
 *
 * The SDK's `send()` auto-detects routing based on the `to` value:
 * - Raw phone number (+1234567890) → uses `buddy` AppleScript (correct)
 * - 2-part chat ref (iMessage;+1234567890) → extracts recipient, uses `buddy`
 * - 3-part format (iMessage;-;+1234567890) → treated as unknown chat id, FAILS
 * - Chat GUID → uses `chat id` AppleScript
 * - Email → uses `buddy` AppleScript
 *
 * This helper strips the legacy 3-part `iMessage;-;` prefix if present,
 * so the SDK receives a clean phone number it can route correctly.
 */
function ensureImessageService(recipient: string): string {
  const trimmed = recipient.trim();

  // Strip the 3-part iMessage;-;+phone format → raw phone number
  const threePartMatch = trimmed.match(/^iMessage;-;(.+)$/);
  if (threePartMatch) {
    return threePartMatch[1];
  }

  // SMS;-;+phone → strip to raw phone as well (SDK will route via iMessage buddy)
  const smsMatch = trimmed.match(/^SMS;-;(.+)$/);
  if (smsMatch) {
    return smsMatch[1];
  }

  // 2-part format (iMessage;+phone), chat GUIDs, emails, raw numbers → pass through
  return trimmed;
}

function normalizeRecipientCore(value: string): string {
  const normalized = ensureImessageService(value);
  if (normalized.includes("@")) {
    return normalized.toLowerCase();
  }
  return normalized.replace(/[^\d+]/g, "");
}

function isGroupChatId(value: string): boolean {
  return value.startsWith("chat") || value.startsWith("iMessage;+;chat");
}

function isSmsTarget(value: string): boolean {
  return value.startsWith("SMS;") || value.startsWith("sms;");
}

async function resolvePreferredDeliveryTarget(
  sdk: IMessageSDK,
  recipient: string,
): Promise<string> {
  const normalized = ensureImessageService(recipient);
  if (!normalized) {
    return normalized;
  }

  if (isGroupChatId(normalized)) {
    return normalized;
  }

  const desiredCore = normalizeRecipientCore(normalized);

  try {
    const chats = await sdk.listChats({ limit: 100, sortBy: "recent" });
    const directMatches = chats.filter((chat) => {
      if (chat.isGroup) return false;
      return normalizeRecipientCore(chat.chatId) === desiredCore;
    });

    for (const chat of directMatches) {
      const history = await sdk.getMessages({
        chatId: chat.chatId,
        limit: 5,
        excludeOwnMessages: false,
      });
      const iMessageMatch = history.messages.find((message) => message.service === "iMessage");
      if (iMessageMatch) {
        return chat.chatId;
      }
    }

    if (directMatches[0]?.chatId && !isSmsTarget(directMatches[0].chatId)) {
      return directMatches[0].chatId;
    }
  } catch (error) {
    console.warn("Spectrum local bridge target resolution warning:", error);
  }

  if (isSmsTarget(normalized)) {
    throw new Error("No iMessage-capable chat found for recipient. Messages would fall back to SMS.");
  }

  return normalized;
}

function formatHelp(): string {
  return [
    "Lazarus is ready.",
    "Try: review RX-782",
    "Try: blueprint RX-782",
    "Try: analyze RX-901",
  ].join("\n");
}

function shouldHandle(text: string): boolean {
  const lowered = text.trim().toLowerCase();
  return (
    lowered === "help" ||
    lowered === "lazarus" ||
    lowered.startsWith("review ") ||
    lowered.startsWith("analyze ") ||
    lowered.startsWith("blueprint ")
  );
}

function formatSpectrumReply(payload: SpectrumWebhookResponse): string {
  const responseText = (payload.response_text || "").trim();
  if (!responseText) {
    return "Lazarus completed the request, but no response text was returned.";
  }
  return responseText;
}

async function callLazarus(text: string, senderId: string): Promise<SpectrumWebhookResponse> {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      sender_id: senderId,
      create_notification: false,
      generate_blueprint: false,
    }),
  });

  let body: SpectrumWebhookResponse;
  try {
    body = (await response.json()) as SpectrumWebhookResponse;
  } catch {
    body = {};
  }

  if (!response.ok) {
    const detail = body.detail || `Spectrum webhook failed with status ${response.status}.`;
    throw new Error(detail);
  }

  return body;
}

async function main(): Promise<void> {
  if (!localModeEnabled) {
    throw new Error("IMESSAGE_LOCAL=true is required to run the local Spectrum bridge.");
  }

  const sdk = new IMessageSDK({
    debug: false,
    watcher: {
      pollInterval: 2000,
      excludeOwnMessages: true,
      unreadOnly: false,
    },
  });

  const shutdown = async (): Promise<void> => {
    console.log("Shutting down local Spectrum bridge...");
    await sdk.close();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    shutdown().catch((error) => {
      console.error("Shutdown failed:", error);
      process.exit(1);
    });
  });
  process.on("SIGTERM", () => {
    shutdown().catch((error) => {
      console.error("Shutdown failed:", error);
      process.exit(1);
    });
  });

  console.log(`Local Spectrum bridge listening via iMessage Kit.`);
  console.log(`Forwarding supported commands to ${webhookUrl}`);

  const server = createServer((req, res) => {
    if (req.method !== "POST" || req.url !== localBridgePath) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, detail: "Not found." }));
      return;
    }

    const chunks: Buffer[] = [];
    req.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on("end", async () => {
      try {
        const rawBody = Buffer.concat(chunks).toString("utf-8");
        const payload = rawBody ? JSON.parse(rawBody) : {};
        const recipient = String(payload.recipient || "").trim();
        const message = String(payload.message || "").trim();

        if (!recipient || !message) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false, detail: "recipient and message are required." }));
          return;
        }

        const deliveryTarget = await resolvePreferredDeliveryTarget(sdk, recipient);
        if (isSmsTarget(deliveryTarget)) {
          throw new Error("Resolved target is SMS, not iMessage. Create or use a blue-bubble iMessage conversation first.");
        }
        await sdk.send(deliveryTarget, message);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, status: "sent", target: deliveryTarget }));
      } catch (error) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            ok: false,
            detail: error instanceof Error ? error.message : "Send failed.",
          }),
        );
      }
    });
  });

  server.listen(localBridgePort, "127.0.0.1", () => {
    console.log(`Local Spectrum outbound bridge ready at http://127.0.0.1:${localBridgePort}${localBridgePath}`);
  });

  await sdk.startWatching({
    onDirectMessage: async (message) => {
      if (message.isFromMe) {
        return;
      }

      const text = (message.text || "").trim();
      if (!text) {
        return;
      }

      if (!shouldHandle(text)) {
        return;
      }

      const rawDestination = message.chatId || message.sender;
      const destination = await resolvePreferredDeliveryTarget(sdk, rawDestination);
      console.log(`Incoming Spectrum command from ${destination}: ${text}`);

      try {
        if (text.toLowerCase() === "help" || text.toLowerCase() === "lazarus") {
          await sdk.send(destination, formatHelp());
          return;
        }

        const result = await callLazarus(text, destination);
        await sdk.send(destination, formatSpectrumReply(result));
      } catch (error) {
        const reply =
          error instanceof Error
            ? `Lazarus could not complete that request.\n${error.message}`
            : "Lazarus could not complete that request.";
        await sdk.send(destination, reply);
      }
    },
    onError: (error) => {
      console.error("Spectrum local bridge watcher error:", error);
    },
  });
}

main().catch((error) => {
  console.error("Spectrum local bridge failed to start:", error);
  process.exit(1);
});
