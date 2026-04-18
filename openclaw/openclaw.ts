import "dotenv/config";

import {
  client,
  configureOpenClaw,
  createMachine,
  ensureGatewayRunning,
  ensureNode,
  installOpenClaw,
  machineEnv,
  sendGatewayChat,
  verifyGateway,
  waitForMachine,
  writeGatewayStartupScript,
  exec,
} from "./lib.js";

async function main(): Promise<void> {
  const existingMachineId = process.env.OPENCLAW_MACHINE_ID;
  const machineId = existingMachineId || (await createMachine());

  if (existingMachineId) {
    await waitForMachine(machineId);
  }

  await ensureNode(machineId);
  await installOpenClaw(machineId);
  await configureOpenClaw(machineId);
  await writeGatewayStartupScript(machineId);
  await ensureGatewayRunning(machineId);
  await verifyGateway(machineId);

  const version = await exec(machineId, `${machineEnv} && openclaw --version`);
  const greeting = await sendGatewayChat(machineId, "Hello! Introduce yourself in one short paragraph.");
  const mondayUseCase = await sendGatewayChat(
    machineId,
    [
      "You are running beside Lazarus, a pharma portfolio intelligence backend.",
      "In one short paragraph, explain how you would help an internal strategy user on Monday morning.",
    ].join(" "),
  );

  console.log(JSON.stringify({
    machineId,
    openclawVersion: version,
    greeting,
    mondayUseCase,
    nextSteps: {
      chat: `npm run chat -- ${machineId} "Analyze asset RX-782 and explain what you can do next."`,
      lazarusReviewEndpoint: `${process.env.LAZARUS_BASE_URL || "http://host.docker.internal:8000"}/openclaw/review-asset`,
      lazarusBlueprintEndpoint: `${process.env.LAZARUS_BASE_URL || "http://host.docker.internal:8000"}/openclaw/generate-blueprint`,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
