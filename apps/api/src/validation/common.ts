import { z } from "zod";

// A MongoDB ObjectId as it arrives in a URL or body: exactly 24 hex characters.
// Checking the type also blocks NoSQL injection like { "$ne": null },
// because an object is not a string.
export const objectId = z.string().regex(/^[a-f0-9]{24}$/i, "Must be a valid id");

// Query strings are always text, so page and limit are coerced to numbers.
// Spread this into a list schema: z.object({ ...pagination, status: ... })
export const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};

// z.coerce.boolean() is wrong for query strings: it runs Boolean("false"),
// and any non-empty string is true. So only the exact words are accepted.
export const queryBoolean = z.enum(["true", "false"]).transform((v) => v === "true");

// how many documents to skip for a given page
export function skipFor(page: number, limit: number) {
  return (page - 1) * limit;
}
