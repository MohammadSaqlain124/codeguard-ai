import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { connectDb, disconnectDb } from "./db/connect.js";
import { initModels } from "./models/index.js";
import { logger } from "./config/logger.js";

try {
  await connectDb();
  await initModels();
} catch (err) {
  logger.fatal({ err }, "startup failed");
  process.exit(1);
}

const app = createApp();

const server = app.listen(env.API_PORT, () => {
  logger.info({ port: env.API_PORT, env: env.NODE_ENV }, "api listening");
});

let shuttingDown = false;

function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "shutting down");

  const force = setTimeout(() => {
    logger.error("shutdown timed out, forcing exit");
    process.exit(1);
  }, 10_000);

  server.close(async (err) => {
    clearTimeout(force);
    if (err) {
      logger.fatal({err},"error closing server:");
      process.exit(1);
    }
    await disconnectDb();
    logger.info("shutdown complete");
    process.exit(0);
  });

  // without this, idle keep-alive connections hold the server open
  server.closeIdleConnections();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logger.fatal({ reason }, "unhandled rejection");
  shutdown("unhandledRejection");
});

process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "uncaught exception");
  process.exit(1);
});
