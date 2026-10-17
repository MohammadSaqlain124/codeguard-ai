import type { Schema } from "mongoose";

interface SerializeOptions {
  // fields to strip from JSON output, on top of __v
  hide?: string[];
}

/**
 * Standard JSON serialisation for every model.
 * Strips __v, plus any model-specific fields passed in `hide`.
 *
 * virtuals: true is what puts `id` in the output. Mongoose defines an `id`
 * virtual on every schema, but toJSON leaves virtuals out unless asked, and
 * schema.set("toJSON", ...) replaces the options wholesale rather than merging
 * into them. So until this line existed the API sent `_id` and no `id` from
 * every endpoint, while the frontend and its types were written against `id`.
 *
 * The tests never caught it because they read ids as `x.id ?? x._id`. That
 * fallback was the symptom, written to make a test pass, and it hid the cause
 * for weeks.
 *
 * `id` is the only virtual any schema in this project defines, so nothing else
 * starts being serialised by turning this on.
 */
export function serialize(schema: Schema, options: SerializeOptions = {}) {
  const hide = options.hide ?? [];

  schema.set("toJSON", {
    virtuals: true,
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
