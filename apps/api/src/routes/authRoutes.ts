import { Router } from "express";

import {
  createUser,
  login,
  logout,
  me,
  refresh,
  register,
  updateUser,
} from "../controllers/authController.js";
import { requireActiveUser, requireAuth, requireRole } from "../middleware/auth.js";
import { validate, validateBody, validateParams } from "../middleware/validate.js";
import {
  createUserSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  updateUserSchema,
  userIdParams,
} from "../validation/authSchemas.js";
import { loginPerEmail, loginPerIp, refreshPerIp, registerPerIp } from "../middleware/rateLimit.js";

export const authRouter = Router();

// public
authRouter.post("/register", registerPerIp, validate(registerSchema), register);
authRouter.post("/login", loginPerIp, loginPerEmail, validate(loginSchema), login);
authRouter.post("/refresh", refreshPerIp, validate(refreshSchema), refresh);
authRouter.post("/logout", validate(refreshSchema), logout);

// signed in
authRouter.get("/me", requireAuth, me);

// admin only. authorise before validating, so an outsider learns nothing about the schema
authRouter.post(
  "/users",
  requireAuth,
  requireActiveUser,
  requireRole("admin"),
  validate(createUserSchema),
  createUser,
);

// Disabling an account or changing a role is the most consequential thing an
// admin does here, so it carries the same guards as creation: re-check the
// account in the database before the role, and the role before the body.
authRouter.patch(
  "/users/:userId",
  requireAuth,
  requireActiveUser,
  requireRole("admin"),
  validateParams(userIdParams),
  validateBody(updateUserSchema),
  updateUser,
);
