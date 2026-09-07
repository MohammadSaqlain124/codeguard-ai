import { z } from "zod";

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

    API_PORT: z.coerce.number().int().positive(),
    CORS_ORIGIN: z.string().min(1),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

    MONGO_URI: z.string().startsWith("mongodb://"),
    MONGO_DB: z.string().min(1),

    REDIS_HOST: z.string().min(1),
    REDIS_PORT: z.coerce.number().int().positive(),

    MINIO_ENDPOINT: z.string().min(1),
    MINIO_PORT: z.coerce.number().int().positive(),
    MINIO_USE_SSL: z.enum(["true", "false"]).transform((v) => v === "true"),
    MINIO_ROOT_USER: z.string().min(1),
    MINIO_ROOT_PASSWORD: z.string().min(8),
    MINIO_BUCKET: z.string().min(1),

    // 32 hex chars is 128 bits of entropy; ours are 64
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    JWT_ACCESS_EXPIRY: z.string().min(1),
    JWT_REFRESH_EXPIRY: z.string().min(1),

    DETECTOR_URL: z.string().min(1),
    DETECTOR_TIMEOUT_MS: z.coerce.number().int().positive(),

    MAX_UPLOAD_BYTES: z.coerce.number().int().positive(),
    ALLOWED_EXTENSIONS: z
      .string()
      .transform((s) => s.split(",").map((e) => e.trim().toLowerCase())),
  })
  .refine((e) => e.JWT_ACCESS_SECRET !== e.JWT_REFRESH_SECRET, {
    path: ["JWT_REFRESH_SECRET"],
    message: "must differ from JWT_ACCESS_SECRET",
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:");
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
