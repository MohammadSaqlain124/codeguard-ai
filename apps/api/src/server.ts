import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { connectDb, disconnectDb } from "./db/connect.js";

try {
  await connectDb();
} catch {
  console.error("could not connect to mongo, exiting");
  process.exit(1);
}

const app = createApp();

const server = app.listen(env.API_PORT, () => {
  console.log(`api listening on port ${env.API_PORT} in ${env.NODE_ENV} mode`);
});

let shuttingDown = false;

function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, closing server`);

  const force = setTimeout(() => {
    console.error("shutdown timed out after 10s, forcing exit");
    process.exit(1);
  }, 10_000);

  server.close(async (err) => {
    clearTimeout(force);
    if (err) {
      console.error("error closing server:", err);
      process.exit(1);
    }
    await disconnectDb();
    console.log("shutdown complete");
    process.exit(0);
  });

  // without this, idle keep-alive connections hold the server open
  server.closeIdleConnections();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  console.error("unhandled promise rejection:", reason);
  shutdown("unhandledRejection");
});

process.on("uncaughtException", (err) => {
  console.error("uncaught exception:", err);
  process.exit(1);
});
