import "dotenv/config";
import Dedalus from "dedalus-labs";
const DEDALUS_BASE_URL = process.env.DEDALUS_BASE_URL || "https://dcs.dedaluslabs.ai";
const OPENCLAW_GATEWAY_PORT = process.env.OPENCLAW_GATEWAY_PORT || "18789";
const DCS_API_PREFIX = process.env.DCS_API_PREFIX || "";
function requireEnv(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}
function apiPath(path) {
    const prefix = DCS_API_PREFIX.trim();
    if (!prefix) {
        return path;
    }
    return `${prefix.replace(/\/$/, "")}${path}`;
}
export const client = new Dedalus({
    xAPIKey: requireEnv("DEDALUS_API_KEY"),
    baseURL: DEDALUS_BASE_URL,
});
export async function sleep(ms) {
    await new Promise((resolve) => setTimeout(resolve, ms));
}
async function createExecution(machineId, command, timeoutMs) {
    return client.post(apiPath(`/machines/${machineId}/executions`), {
        body: {
            machine_id: machineId,
            command,
            timeout_ms: timeoutMs,
        },
    });
}
async function getExecution(machineId, executionId) {
    return client.get(apiPath(`/machines/${machineId}/executions/${executionId}`));
}
async function getExecutionOutput(machineId, executionId) {
    return client.get(apiPath(`/machines/${machineId}/executions/${executionId}/output`));
}
export async function exec(machineId, cmd, timeoutMs = 120_000) {
    const execution = await createExecution(machineId, ["/bin/bash", "-c", cmd], timeoutMs);
    let result = execution;
    while (result.status !== "succeeded" && result.status !== "failed") {
        await sleep(1_000);
        result = await getExecution(machineId, execution.execution_id);
    }
    const output = await getExecutionOutput(machineId, execution.execution_id);
    if (result.status === "failed") {
        throw new Error(output.stderr || "exec failed");
    }
    return output.stdout?.trim() || "";
}
async function getMachine(machineId) {
    return client.get(apiPath(`/machines/${machineId}`));
}
export async function waitForMachine(machineId) {
    let machine = await getMachine(machineId);
    while (machine.status.phase !== "running") {
        if (machine.status.phase === "failed") {
            throw new Error(`Machine failed: ${machine.status.reason}`);
        }
        await sleep(2_000);
        machine = await getMachine(machineId);
    }
    await sleep(5_000);
}
export async function createMachine() {
    const machine = await client.post(apiPath("/machines"), {
        body: {
            vcpu: Number(process.env.OPENCLAW_VCPU || "2"),
            memory_mib: Number(process.env.OPENCLAW_MEMORY_MIB || "4096"),
            storage_gib: Number(process.env.OPENCLAW_STORAGE_GIB || "10"),
        },
    });
    await waitForMachine(machine.machine_id);
    return machine.machine_id;
}
export const machineEnv = "export PATH=/home/machine/.npm-global/bin:$PATH " +
    "&& export HOME=/home/machine " +
    "&& export OPENCLAW_STATE_DIR=/home/machine/.openclaw " +
    "&& export NODE_COMPILE_CACHE=/home/machine/.compile-cache " +
    "&& export OPENCLAW_NO_RESPAWN=1";
export async function ensureNode(machineId) {
    await exec(machineId, "command -v node >/dev/null 2>&1 || " +
        "(curl -fsSL https://deb.nodesource.com/setup_22.x | bash - " +
        "&& apt-get install -y nodejs) 2>&1 | tail -3", 300_000);
}
export async function installOpenClaw(machineId) {
    await exec(machineId, "mkdir -p /home/machine/.npm-global /home/machine/.npm-cache " +
        "/home/machine/.tmp /home/machine/.openclaw /home/machine/.compile-cache && " +
        "NPM_CONFIG_PREFIX=/home/machine/.npm-global " +
        "NPM_CONFIG_CACHE=/home/machine/.npm-cache " +
        "TMPDIR=/home/machine/.tmp " +
        "npm install -g openclaw@latest 2>&1 | tail -5", 300_000);
}
export async function configureOpenClaw(machineId) {
    const providerKeyName = process.env.OPENCLAW_PROVIDER_KEY_NAME || "GEMINI_API_KEY";
    const providerApiKey = requireEnv(providerKeyName);
    const gatewayPort = process.env.OPENCLAW_GATEWAY_PORT || "18789";
    const gatewayAuthMode = process.env.OPENCLAW_GATEWAY_AUTH_MODE || "none";
    const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN || "";
    const model = process.env.OPENCLAW_MODEL || "google/gemini-2.5-flash";
    await exec(machineId, `${machineEnv} && openclaw config set gateway.mode local`);
    await exec(machineId, `${machineEnv} && openclaw config set gateway.bind loopback`);
    await exec(machineId, `${machineEnv} && openclaw config set gateway.port ${gatewayPort}`);
    await exec(machineId, `${machineEnv} && openclaw config set env.vars.${providerKeyName} "${providerApiKey}"`);
    await exec(machineId, `${machineEnv} && openclaw config set agents.defaults.model.primary "${model}"`);
    await exec(machineId, `${machineEnv} && openclaw config set gateway.http.endpoints.chatCompletions.enabled true`);
    if (gatewayAuthMode === "token") {
        const token = gatewayToken || "replace-me-before-production";
        await exec(machineId, `${machineEnv} && openclaw config set gateway.auth.mode token`);
        await exec(machineId, `${machineEnv} && openclaw config set gateway.auth.token "${token}"`);
    }
    else {
        await exec(machineId, `${machineEnv} && openclaw config set gateway.auth.mode none`);
    }
}
export async function writeGatewayStartupScript(machineId) {
    const gatewayAuthMode = process.env.OPENCLAW_GATEWAY_AUTH_MODE || "none";
    const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN || "";
    let gatewayCommand = "exec openclaw gateway run";
    if (gatewayAuthMode === "none") {
        gatewayCommand += " --auth none";
    }
    else if (gatewayAuthMode === "token" && gatewayToken) {
        gatewayCommand += ` --auth token --token '${gatewayToken}'`;
    }
    gatewayCommand += " > /home/machine/.openclaw/gateway.log 2>&1";
    await exec(machineId, `echo '#!/bin/bash' > /home/machine/start-gateway.sh && ` +
        `echo 'export PATH=/home/machine/.npm-global/bin:$PATH' >> /home/machine/start-gateway.sh && ` +
        `echo 'export HOME=/home/machine' >> /home/machine/start-gateway.sh && ` +
        `echo 'export OPENCLAW_STATE_DIR=/home/machine/.openclaw' >> /home/machine/start-gateway.sh && ` +
        `echo 'export NODE_COMPILE_CACHE=/home/machine/.compile-cache' >> /home/machine/start-gateway.sh && ` +
        `echo 'export OPENCLAW_NO_RESPAWN=1' >> /home/machine/start-gateway.sh && ` +
        `echo "${gatewayCommand}" >> /home/machine/start-gateway.sh && ` +
        `chmod +x /home/machine/start-gateway.sh`);
}
export async function ensureGatewayRunning(machineId) {
    await exec(machineId, "pgrep -f openclaw-gateway > /dev/null && echo 'already running' || " +
        "(setsid /home/machine/start-gateway.sh </dev/null &>/dev/null & disown && sleep 10 && echo 'launched')", 60_000);
}
export async function verifyGateway(machineId) {
    const port = OPENCLAW_GATEWAY_PORT;
    await exec(machineId, `ss -tlnp | grep ${port}`);
    await exec(machineId, `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:${port}/`);
    await exec(machineId, `${machineEnv} && openclaw gateway call health`, 60_000);
}
export async function sendGatewayChat(machineId, message, user = "lazarus-openclaw") {
    const port = OPENCLAW_GATEWAY_PORT;
    const authMode = process.env.OPENCLAW_GATEWAY_AUTH_MODE || "none";
    const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN || "";
    const authHeader = authMode === "token" && gatewayToken
        ? `-H 'Authorization: Bearer ${gatewayToken}' `
        : "";
    const modelHeader = process.env.OPENCLAW_MODEL
        ? `-H 'x-openclaw-model: ${process.env.OPENCLAW_MODEL}' `
        : "";
    const escapedMessage = JSON.stringify(message);
    const escapedUser = JSON.stringify(user);
    const response = await exec(machineId, `curl -sS http://127.0.0.1:${port}/v1/chat/completions ` +
        `${authHeader}` +
        `${modelHeader}` +
        `-H 'Content-Type: application/json' ` +
        `-d '{"model":"openclaw/default","user":${escapedUser},"messages":[{"role":"user","content":${escapedMessage}}]}'`, 180_000);
    const parsed = JSON.parse(response);
    return parsed.choices?.[0]?.message?.content || "";
}
