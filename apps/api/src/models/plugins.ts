import type { Schema } from "mongoose";

interface SerializeOptions {
  // fields to strip from JSON output, on top of __v
  hide?: string[];
}

/**
 * Standard JSON serialisation for every model.
 * Strips __v, plus any model-specific fields passed in `hide`.
 */
export function serialize(schema: Schema, options: SerializeOptions = {}) {
  const hide = options.hide ?? [];

  schema.set("toJSON", {
    transform: (_doc, ret) => {
      const obj = ret as Record<string, unknown>;
      delete obj.__v;
      for (const field of hide) {
        delete obj[field];
      }
      return obj;
    },
  });
}
