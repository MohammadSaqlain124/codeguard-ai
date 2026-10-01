import mongoose from "mongoose";

import { connectDb, disconnectDb } from "./src/db/connect.js";
import { AssignmentModel, CourseModel, SubmissionModel, UserModel, initModels } from "./src/models/index.js";
import { DetectionResultModel } from "./src/models/DetectionResult.js";
import { removeSubmission } from "./src/storage/minio.js";

await connectDb();
if (mongoose.connection.name === "codeguard_test") throw new Error("Refusing: this runs on the dev database");
await initModels();

const course = await CourseModel.findOne({ code: "ZZ-902" });
if (course) {
  const assignments = await AssignmentModel.find({ course: course._id }).select("_id");
  const assignmentIds = assignments.map((a) => a._id);
  const submissions = await SubmissionModel.find({ assignment: { $in: assignmentIds } }).select("objectKey");
  for (const s of submissions) await removeSubmission(s.objectKey);
  await DetectionResultModel.deleteMany({ course: course._id });
  await SubmissionModel.deleteMany({ assignment: { $in: assignmentIds } });
  await AssignmentModel.deleteMany({ course: course._id });
  await CourseModel.deleteOne({ _id: course._id });
}
await UserModel.deleteMany({ email: /^det-/ });

console.log("\n  dev database cleaned\n");
await disconnectDb();