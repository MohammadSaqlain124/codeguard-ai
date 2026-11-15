import express from "express";
import helmet from "helmet";
import cors from "cors";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { env } from "./config/env.js";
import { pinoHttp } from "pino-http";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import swaggerUi from "swagger-ui-express";
import YAML from "yaml";

import { logger } from "./config/logger.js";
import { authRouter } from "./routes/authRoutes.js";
import { courseRouter } from "./routes/courseRoutes.js";
import { assignmentRouter } from "./routes/assignmentRoutes.js";
import { submissionRouter } from "./routes/submissionRoutes.js";

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

  // Browsable API docs, served from the same spec the mobile client is built
  // against. On in development, and in production only when ENABLE_API_DOCS
  // says so. Serving it from the api's own origin matters: cors() allows one
  // origin, so a Swagger UI hosted anywhere else could render the spec but
  // every "Try it out" call would be blocked before it left the browser.
  if (env.NODE_ENV === "development" || env.ENABLE_API_DOCS) {
    try {
      // npm scripts run from apps/api, so the repo root is two levels up
      const specPath = path.resolve(process.cwd(), "../../docs/openapi.yaml");
      const spec = YAML.parse(readFileSync(specPath, "utf8"));

      // helmet's default policy is script-src 'self', which blocks the inline
      // script Swagger UI bootstraps itself with - the page would render
      // blank. This relaxation is scoped to the docs route; every other route
      // keeps the strict policy.
      const docsCsp = helmet({
        contentSecurityPolicy: {
          directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            "script-src": ["'self'", "'unsafe-inline'"],
            "script-src-attr": ["'unsafe-inline'"],
          },
        },
      });

      app.use("/api/docs", docsCsp, swaggerUi.serve, swaggerUi.setup(spec));
      logger.info({ specPath }, "api docs mounted at /api/docs");
    } catch (err) {
      // Documentation must never stop the server booting.
      logger.warn({ err }, "could not load docs/openapi.yaml, skipping /api/docs");
    }
  }

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", uptime: process.uptime() });
  });
  app.use("/api/auth", authRouter);
  app.use("/api/courses", courseRouter);
  app.use("/api/assignments", assignmentRouter);
  app.use("/api/submissions", submissionRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
