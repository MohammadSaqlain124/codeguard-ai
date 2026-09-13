import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

export const AUDIT_ACTIONS = [
  // review workflow
  "result.dismissed",
  "result.escalated",
  "result.confirmed_clean",
  "result.contested",
  // baseline integrity
  "baseline.sample_added",
  "baseline.sample_removed",
  // configuration
  "config.weights_updated",
  "assignment.provenance_changed",
  // detection lifecycle
  "detection.rerun_requested",
  // access control
  "user.role_changed",
  "user.deactivated",
] as const;

export const AUDIT_TARGETS = [
  "DetectionResult",
  "Submission",
  "Assignment",
  "DetectionConfig",
  "User",
] as const;

const auditLogSchema = new Schema(
  {
    // who did it — required, because an unattributable action is not evidence
    actor: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // snapshotted, so the entry survives a later role change
    actorRole: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20,
    },
    action: {
      type: String,
      required: true,
      enum: AUDIT_ACTIONS,
      index: true,
    },
    targetType: {
      type: String,
      required: true,
      enum: AUDIT_TARGETS,
    },
    targetId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    // scope, so a course-level audit view needs no joins
    course: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      index: true,
    },
    // Mixed because the shape differs per action; never queried into
    changes: {
      before: { type: Schema.Types.Mixed },
      after: { type: Schema.Types.Mixed },
    },
    // the human justification, where one is required
    reason: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    at: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
  },
  // no updatedAt — nothing here is ever updated
  { timestamps: { createdAt: false, updatedAt: false } },
);

// "everything that happened to this submission", newest first
auditLogSchema.index({ targetType: 1, targetId: 1, at: -1 });

// "what did this person do in this course"
auditLogSchema.index({ course: 1, actor: 1, at: -1 });

// append-only: reject any attempt to modify an existing entry
auditLogSchema.pre("save", function () {
  if (!this.isNew) {
    throw new Error("AuditLog entries are immutable");
  }
});

// and reject every update/delete query form
auditLogSchema.pre(
  /^(updateOne|updateMany|replaceOne|findOneAndUpdate|findOneAndReplace|deleteOne|deleteMany|findOneAndDelete)$/,
  function () {
    throw new Error("AuditLog is append-only; updates and deletes are not permitted");
  },
);

auditLogSchema.set("toJSON", {
  transform: (_doc, ret) => {
    const obj = ret as Record<string, unknown>;
    delete obj.__v;
    return obj;
  },
});

export type AuditLog = InferSchemaType<typeof auditLogSchema>;
export type AuditLogDoc = HydratedDocument<AuditLog>;

export const AuditLogModel = model("AuditLog", auditLogSchema);
