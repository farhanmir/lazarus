import { Router, Request, Response } from "express";
import { state, reissueOnAuthError } from "./client";

export const sendRouter = Router();

function isAuthError(err: any): boolean {
  const name = err?.name || err?.constructor?.name || "";
  const msg = (err?.message || "").toLowerCase();
  return name === "AuthenticationError" || msg.includes("auth");
}

sendRouter.post("/send-alert", async (req: Request, res: Response) => {
  const { target, message } = req.body || {};
  if (!target || !message) {
    return res.status(400).json({ ok: false, error: "target and message required" });
  }
  if (!state.client) {
    return res.status(502).json({ ok: false, error: "photon client not connected" });
  }
  try {
    await state.client.im.messages.send(target, message);
    return res.json({ ok: true });
  } catch (err: any) {
    console.error("[PHOTON-SERVICE] send-alert error:", err?.message || err);
    if (isAuthError(err)) {
      reissueOnAuthError().catch(() => {});
    }
    return res
      .status(502)
      .json({ ok: false, error: err?.message || "photon send failed" });
  }
});

sendRouter.post("/send-file", async (req: Request, res: Response) => {
  const { target, file_path: filePath } = req.body || {};
  if (!target || !filePath) {
    return res
      .status(400)
      .json({ ok: false, error: "target and file_path required" });
  }
  if (!state.client) {
    return res.status(502).json({ ok: false, error: "photon client not connected" });
  }
  try {
    const attachment = await state.client.im.attachments.upload(filePath);
    await state.client.im.messages.send(target, "Lazarus Resurrection Blueprint", {
      attachments: [attachment],
    });
    return res.json({ ok: true });
  } catch (err: any) {
    console.error("[PHOTON-SERVICE] send-file error:", err?.message || err);
    if (isAuthError(err)) {
      reissueOnAuthError().catch(() => {});
    }
    return res
      .status(502)
      .json({ ok: false, error: err?.message || "photon send-file failed" });
  }
});
