import mongoose from "mongoose";
import { componentLogger } from "../config/logger.js";
import { env } from "../config/env.js";
const log = componentLogger("db");
const MAX_ATTEMPTS = 5;

export async function connectDb() {
  mongoose.connection.on("error", (err) => {
    log.error({ err }, "mongo error");
  });

  mongoose.connection.on("disconnected", () => {
    log.warn("mongo disconnected");
  });

  mongoose.connection.on("reconnected", () => {
    log.info("mongo reconnected");
  });

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await mongoose.connect(env.MONGO_URI, {
        serverSelectionTimeoutMS: 5000,
        maxPoolSize: 20,
      });
      log.info({ db: env.MONGO_DB }, "mongo connected");
      return;
    } catch (err) {
      if (attempt === MAX_ATTEMPTS) throw err;
      // 1s, 2s, 4s, 8s
      const wait = 2 ** attempt * 500;
      log.warn({ attempt, wait }, "mongo connect failed, retrying");
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

export async function disconnectDb() {
  await mongoose.connection.close();
  console.log("mongo connection closed");
}
