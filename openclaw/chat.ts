import "dotenv/config";

import { sendGatewayChat, waitForMachine } from "./lib.js";

async function main(): Promise<void> {
  const machineId = process.argv[2] || process.env.OPENCLAW_MACHINE_ID;
  const message = process.argv.slice(3).join(" ") || "Hello! What are you?";

  if (!machineId) {
    throw new Error("Provide a machine id as the first argument or set OPENCLAW_MACHINE_ID.");
  }

  await waitForMachine(machineId);
  const reply = await sendGatewayChat(machineId, message);

  console.log(JSON.stringify({ machineId, message, reply }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
