import express from "express";
import { initPhotonClient, state } from "./client";
import { sendRouter } from "./send";
import { startSubscribeLoop } from "./subscribe";

const PORT = parseInt(process.env.PORT || "3001", 10);

async function main(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: "2mb" }));

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      photon_connected: state.connected,
      last_error: state.lastError,
    });
  });

  app.use(sendRouter);

  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("[PHOTON-SERVICE] unhandled error:", err?.message || err);
    res.status(500).json({ ok: false, error: err?.message || "internal error" });
  });

  app.listen(PORT, () => {
    console.log(`[PHOTON-SERVICE] HTTP listening on :${PORT}`);
  });

  await initPhotonClient();

  startSubscribeLoop().catch((err) => {
    console.error("[PHOTON-SERVICE] subscribe loop fatal:", err?.message || err);
  });

  console.log("[PHOTON-SERVICE] Ready");
}

main().catch((err) => {
  console.error("[PHOTON-SERVICE] startup failed:", err?.message || err);
  process.exit(1);
});
