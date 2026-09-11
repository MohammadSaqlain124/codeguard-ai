import mongoose from "mongoose";

import { env } from "../config/env.js";

const MAX_ATTEMPTS = 5;

export async function connectDb() {
  mongoose.connection.on("error", (err) => {
    console.error("mongo error:", err.message);
  });

  mongoose.connection.on("disconnected", () => {
    console.warn("mongo disconnected");
  });

  mongoose.connection.on("reconnected", () => {
    console.log("mongo reconnected");
  });

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await mongoose.connect(env.MONGO_URI, {
        serverSelectionTimeoutMS: 5000,
        maxPoolSize: 20,
      });
      console.log(`mongo connected to ${env.MONGO_DB}`);
      return;
    } catch (err) {
      if (attempt === MAX_ATTEMPTS) throw err;
      // 1s, 2s, 4s, 8s
      const wait = 2 ** attempt * 500;
      console.error(`mongo connect attempt ${attempt} failed, retrying in ${wait}ms`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

export async function disconnectDb() {
  await mongoose.connection.close();
  console.log("mongo connection closed");
}
