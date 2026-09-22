import { Router } from "express";

import {
  createUser,
  login,
  logout,
  me,
  refresh,
  register,
} from "../controllers/authController.js";
import { requireActiveUser, requireAuth, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  createUserSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
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
