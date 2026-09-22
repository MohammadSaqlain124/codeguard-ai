import express from "express";
import helmet from "helmet";
import cors from "cors";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { env } from "./config/env.js";
import { pinoHttp } from "pino-http";
import { randomUUID } from "node:crypto";

import { logger } from "./config/logger.js";
import { authRouter } from "./routes/authRoutes.js";
import { courseRouter } from "./routes/courseRoutes.js";
import { assignmentRouter } from "./routes/assignmentRoutes.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(
    pinoHttp({
      logger,
      // one id per request, so a successful request is traceable too
      genReqId: (req, res) => {
        const id = randomUUID();
        res.setHeader("x-request-id", id);
        return id;
      },
      // health checks are noise at info level
      customLogLevel: (req, res, err) => {
        if (err || res.statusCode >= 500) return "error";
        if (res.statusCode >= 400) return "warn";
        if (req.url === "/health") return "debug";
        return "info";
      },
    }),
  );
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json({ limit: "100kb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", uptime: process.uptime() });
  });
  app.use("/api/auth", authRouter);
  app.use("/api/courses", courseRouter);
  app.use("/api/assignments", assignmentRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
