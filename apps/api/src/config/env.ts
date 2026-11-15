import { z } from "zod";

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

    API_PORT: z.coerce.number().int().positive(),
    CORS_ORIGIN: z.string().min(1),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

    // Atlas and most hosted providers issue mongodb+srv:// URIs, so both
    // prefixes are accepted. The check still refuses anything that is not a
    // Mongo connection string at all.
    MONGO_URI: z
      .string()
      .refine((v) => v.startsWith("mongodb://") || v.startsWith("mongodb+srv://"), {
        message: "must start with mongodb:// or mongodb+srv://",
      }),
    MONGO_DB: z.string().min(1),

    REDIS_HOST: z.string().min(1),
    REDIS_PORT: z.coerce.number().int().positive(),
    // Hosted Redis requires a password and TLS; a local docker compose Redis
    // has neither. Both are optional so the local stack is unchanged.
    REDIS_PASSWORD: z.string().optional(),
    REDIS_TLS: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),

    MINIO_ENDPOINT: z.string().min(1),
    MINIO_PORT: z.coerce.number().int().positive(),
    MINIO_USE_SSL: z.enum(["true", "false"]).transform((v) => v === "true"),
    MINIO_ROOT_USER: z.string().min(1),
    MINIO_ROOT_PASSWORD: z.string().min(8),
    MINIO_BUCKET: z.string().min(1),
    // Every S3-compatible store signs requests with a region. MinIO accepts
    // anything, Cloudflare R2 insists on the literal "auto", and AWS wants
    // the bucket's own region. The default is what the local stack has always
    // sent implicitly, so nothing changes for docker compose.
    MINIO_REGION: z.string().min(1).default("us-east-1"),

    // 32 hex chars is 128 bits of entropy; ours are 64
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    JWT_ACCESS_EXPIRY: z.string().min(1),
    JWT_REFRESH_EXPIRY: z.string().min(1),

    DETECTOR_URL: z.url().default("http://localhost:8000"),
    DETECTOR_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120_000).default(30_000),
    // shared secret sent with every detector call. 32 characters for the
    // same reason the JWT secrets are: shorter is guessable offline.
    DETECTOR_TOKEN: z.string().min(32),

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
