import { z } from "zod";

import { ROLES } from "../models/index.js";
import { objectId, pagination, queryBoolean } from "./common.js";

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

export const rollNo = z
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
/**
 * What an admin may change about somebody else's account.
 *
 * email, name and password are absent on purpose. Changing an email changes
 * who can sign in and is a different decision from access control; a password
 * reset needs the account holder, not an administrator typing a new one.
 *
 * rollNo is accepted only to satisfy the invariant createUserSchema states:
 * students have one and nobody else does. Promoting a student to faculty does
 * not need it, because the only correct action there is to remove the old one.
 */
export const updateUserSchema = z
  .object({
    role: z.enum(ROLES).optional(),
    isActive: z.boolean().optional(),
    rollNo: rollNo.optional(),
    // Required, in both directions. Disabling somebody's account is at least
    // as consequential as nominating their work, and the audit entry is the
    // only place the why survives.
    reason: z.string().trim().min(10).max(2000),
  })
  .strict()
  .refine((v) => v.role !== undefined || v.isActive !== undefined, {
    message: "Give a role, an account status, or both",
  })
  .refine((v) => v.rollNo === undefined || v.role === "student", {
    path: ["rollNo"],
    message: "Only students have a roll number",
  });

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const userIdParams = z.object({ userId: objectId }).strict();

export type UserIdParams = z.infer<typeof userIdParams>;

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;

/**
 * Who an admin is looking at. `q` matches name, email or roll number; it is
 * escaped before it reaches a regex, because an unescaped name is both a
 * wrong search and a way to hand the database a pattern that never finishes.
 */
export const listUsersQuery = z
  .object({
    ...pagination,
    role: z.enum(ROLES).optional(),
    active: queryBoolean.optional(),
    q: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

export type ListUsersQuery = z.infer<typeof listUsersQuery>;
