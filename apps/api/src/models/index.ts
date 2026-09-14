export { UserModel, type User, type UserDoc } from "./User.js";
export { CourseModel, type Course, type CourseDoc } from "./Course.js";
export {
  AssignmentModel,
  type Assignment,
  type AssignmentDoc,
  LANGUAGES,
  PROVENANCE,
} from "./Assignment.js";
export {
  SubmissionModel,
  type Submission,
  type SubmissionDoc,
  SUBMISSION_STATUS,
} from "./Submission.js";
export {
  DetectionConfigModel,
  type DetectionConfig,
  type DetectionConfigDoc,
  DEFAULT_DETECTION_CONFIG,
} from "./DetectionConfig.js";
export {
  DetectionResultModel,
  type DetectionResult,
  type DetectionResultDoc,
  LAYER_STATUS,
  REVIEW_STATUS,
} from "./DetectionResult.js";
export {
  AuditLogModel,
  type AuditLog,
  type AuditLogDoc,
  AUDIT_ACTIONS,
  AUDIT_TARGETS,
} from "./AuditLog.js";

import { AssignmentModel } from "./Assignment.js";
import { AuditLogModel } from "./AuditLog.js";
import { CourseModel } from "./Course.js";
import { DetectionConfigModel } from "./DetectionConfig.js";
import { DetectionResultModel } from "./DetectionResult.js";
import { SubmissionModel } from "./Submission.js";
import { UserModel } from "./User.js";

const allModels = [
  UserModel,
  CourseModel,
  AssignmentModel,
  SubmissionModel,
  DetectionConfigModel,
  DetectionResultModel,
  AuditLogModel,
];

/**
 * Waits for every model's indexes to finish building.
 * Mongoose builds them in the background and does not wait, so without
 * this a fresh database accepts writes before its unique constraints exist.
 */
export async function initModels() {
  await Promise.all(allModels.map((m) => m.init()));
  console.log(`indexes ready for ${allModels.length} models`);
}

/** Test and seed helper. Never call this against a real database. */
export async function clearAllCollections() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("clearAllCollections is not permitted in production");
  }
  await Promise.all(allModels.map((m) => m.deleteMany({})));
}
