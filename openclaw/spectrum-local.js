import { config as loadEnv } from "dotenv";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { IMessageSDK } from "@photon-ai/imessage-kit";
loadEnv({ path: resolve(process.cwd(), "../.env") });
loadEnv({ path: resolve(process.cwd(), ".env"), override: false });
const lazarusBaseUrl = (process.env.LAZARUS_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const webhookUrl = `${lazarusBaseUrl}/spectrum/webhook`;
const localModeEnabled = (process.env.IMESSAGE_LOCAL || "").toLowerCase() === "true";
const localBridgePort = Number(process.env.SPECTRUM_LOCAL_BRIDGE_PORT || "8765");
const localBridgePath = process.env.SPECTRUM_SEND_PATH || "/messages";
function formatHelp() {
    return [
        "Lazarus is ready.",
        "Try: review RX-782",
        "Try: blueprint RX-782",
        "Try: analyze RX-901",
    ].join("\n");
}
function shouldHandle(text) {
    const lowered = text.trim().toLowerCase();
    return (lowered === "help" ||
        lowered === "lazarus" ||
        lowered.startsWith("review ") ||
        lowered.startsWith("analyze ") ||
        lowered.startsWith("blueprint "));
}
function formatSpectrumReply(payload) {
    const responseText = (payload.response_text || "").trim();
    if (!responseText) {
        return "Lazarus completed the request, but no response text was returned.";
    }
    return responseText;
}
async function callLazarus(text, senderId) {
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
    let body;
    try {
        body = (await response.json());
    }
    catch {
        body = {};
    }
    if (!response.ok) {
        const detail = body.detail || `Spectrum webhook failed with status ${response.status}.`;
        throw new Error(detail);
    }
    return body;
}
async function main() {
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
    const shutdown = async () => {
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
        const chunks = [];
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
                await sdk.send(recipient, message);
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ ok: true, status: "sent" }));
            }
            catch (error) {
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({
                    ok: false,
                    detail: error instanceof Error ? error.message : "Send failed.",
                }));
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
            const destination = message.chatId || message.sender;
            console.log(`Incoming Spectrum command from ${destination}: ${text}`);
            try {
                if (text.toLowerCase() === "help" || text.toLowerCase() === "lazarus") {
                    await sdk.send(destination, formatHelp());
                    return;
                }
                const result = await callLazarus(text, destination);
                await sdk.send(destination, formatSpectrumReply(result));
            }
            catch (error) {
                const reply = error instanceof Error
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
