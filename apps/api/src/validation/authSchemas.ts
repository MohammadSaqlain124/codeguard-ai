import { z } from "zod";

import { ROLES } from "../models/index.js";

/** bcrypt silently truncates past 72 bytes, so the boundary rejects it too. */
const MAX_PASSWORD_BYTES = 72;
const MIN_PASSWORD_LENGTH = 8;

const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(254)
  .email("Must be a valid email address");

const password = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Must be at least ${MIN_PASSWORD_LENGTH} characters`)
  // length in bytes, not characters — a Devanagari character is three
  .refine((v) => Buffer.byteLength(v, "utf8") <= MAX_PASSWORD_BYTES, {
    message: `Must be at most ${MAX_PASSWORD_BYTES} bytes`,
  });

const rollNo = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2,4}\d{4,10}$/, "Must look like BCS2023126");

/**
 * Public registration. There is deliberately no `role` field:
 * accepting one would let anyone POST { role: "admin" }.
 * The controller sets role to "student"; faculty accounts are created by an admin.
 */
export const registerSchema = z
  .object({
    email,
    password,
    name: z.string().trim().min(2, "Must be at least 2 characters").max(120),
    rollNo,
  })
  .strict();

/** Admin-only account creation, where choosing a role is the point. */
export const createUserSchema = z
  .object({
    email,
    password,
    name: z.string().trim().min(2).max(120),
    role: z.enum(ROLES),
    rollNo: rollNo.optional(),
  })
  .strict()
  .refine((v) => v.role !== "student" || !!v.rollNo, {
    path: ["rollNo"],
    message: "A roll number is required for students",
  })
  .refine((v) => v.role === "student" || !v.rollNo, {
    path: ["rollNo"],
    message: "Only students have a roll number",
  });

/** Login deliberately validates loosely — see the notes. */
export const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().min(1, "Email is required"),
    password: z.string().min(1, "Password is required"),
  })
  .strict();

export const refreshSchema = z
  .object({
    refreshToken: z.string().min(1, "A refresh token is required"),
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
