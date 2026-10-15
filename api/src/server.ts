import { buildContainer } from "./container.js";
import { buildApp } from "./app.js";
import { env } from "./lib/env.js";

const container = buildContainer();
const app = buildApp(container);

const server = app.listen(env.PORT, () => {
  console.log(`api-node listening on :${env.PORT}`);
});

async function shutdown() {
  server.close();
  await container.close();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
