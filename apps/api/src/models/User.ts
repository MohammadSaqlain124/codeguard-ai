import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    // never returned by a query unless explicitly selected
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    role: {
      type: String,
      required: true,
      enum: ["student", "faculty", "admin"],
      index: true,
    },
    // students only; sparse so faculty and admin are exempt from the unique index
    rollNo: {
      type: String,
      trim: true,
      uppercase: true,
      unique: true,
      sparse: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

userSchema.set("toJSON", {
  transform: (_doc, ret) => {
    const obj = ret as Record<string, unknown>;
    delete obj.passwordHash;
    delete obj.__v;
    return obj;
  },
});

export type User = InferSchemaType<typeof userSchema>;
export type UserDoc = HydratedDocument<User>;

export const UserModel = model("User", userSchema);
