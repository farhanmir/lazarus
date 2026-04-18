import fetch from "node-fetch";
// @ts-ignore - SDK types may not be present at build in all envs
import { createClient } from "@photon-ai/advanced-imessage";

export interface PhotonState {
  client: any | null;
  connected: boolean;
  lastError: string | null;
}

export const state: PhotonState = {
  client: null,
  connected: false,
  lastError: null,
};

const PROJECT_ID = process.env.PHOTON_PROJECT_ID || "";
const PROJECT_SECRET = process.env.PHOTON_PROJECT_SECRET || "";

function basicAuthHeader(): string {
  const raw = `${PROJECT_ID}:${PROJECT_SECRET}`;
  return "Basic " + Buffer.from(raw).toString("base64");
}

async function issueToken(): Promise<{ token: string; address: string }> {
  if (!PROJECT_ID || !PROJECT_SECRET) {
    throw new Error("PHOTON_PROJECT_ID or PHOTON_PROJECT_SECRET not set");
  }
  const url = `https://api.photon.codes/projects/${PROJECT_ID}/imessage/tokens`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": basicAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    throw new Error(`Token issuance failed: ${res.status} ${await res.text()}`);
  }
  const json: any = await res.json();
  if (!json.token || !json.address) {
    throw new Error(`Token response malformed: ${JSON.stringify(json)}`);
  }
  return { token: json.token, address: json.address };
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function initPhotonClient(maxAttempts = 5): Promise<void> {
  let attempt = 0;
  let backoff = 1000;
  while (attempt < maxAttempts) {
    try {
      const { token, address } = await issueToken();
      const client = createClient({ address, token, retry: true });
      state.client = client;
      state.connected = true;
      state.lastError = null;
      console.log("[PHOTON-SERVICE] Client initialized");
      return;
    } catch (err: any) {
      attempt++;
      state.lastError = err?.message || String(err);
      console.error(
        `[PHOTON-SERVICE] init attempt ${attempt}/${maxAttempts} failed: ${state.lastError}`
      );
      if (attempt >= maxAttempts) break;
      await sleep(backoff);
      backoff = Math.min(backoff * 2, 15000);
    }
  }
  state.connected = false;
  console.error(
    "[PHOTON-SERVICE] Failed to initialize Photon client; running in degraded mode"
  );
}

export async function reissueOnAuthError(): Promise<void> {
  state.connected = false;
  await initPhotonClient(3);
}
