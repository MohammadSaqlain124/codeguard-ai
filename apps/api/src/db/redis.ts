import { Redis } from "ioredis";

import { env } from "../config/env.js";
import { componentLogger } from "../config/logger.js";

const log = componentLogger("redis");

export const redis = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  // fail fast rather than queueing commands against a dead server
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

redis.on("error", (err: Error) => log.error({ err }, "redis error"));
redis.on("connect", () => log.info("redis connected"));
redis.on("reconnecting", () => log.warn("redis reconnecting"));

export async function connectRedis() {
  await redis.connect();
}

export async function disconnectRedis() {
  await redis.quit();
  log.info("redis connection closed");
}

/** Marks a refresh token id as revoked until it would have expired anyway. */
export async function revokeRefreshToken(jti: string, ttlSeconds: number) {
  await redis.set(`revoked:${jti}`, "1", "EX", Math.max(ttlSeconds, 1));
}

export async function isRefreshTokenRevoked(jti: string): Promise<boolean> {
  return (await redis.exists(`revoked:${jti}`)) === 1;
}
