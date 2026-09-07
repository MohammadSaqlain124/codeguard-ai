import express from "express";
import helmet from "helmet";
import cors from "cors";

import { env } from "./config/env.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json({ limit: "100kb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", uptime: process.uptime() });
  });

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  return app;
}
