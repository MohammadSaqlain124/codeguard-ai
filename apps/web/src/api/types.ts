/**
 * The shapes the API actually returns.
 *
 * Only fields that have been read out of the API's own code are here. Adding a
 * field you have not confirmed is how a frontend ends up reading undefined and
 * rendering "NaN" with no error anywhere.
 *
 * Mongoose's serialize plugin gives every document an `id` string, so prefer
 * that over `_id`.
 */

export type Role = "student" | "faculty" | "admin";

export type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
  rollNo?: string;
  isActive: boolean;
};

export type Course = {
  id: string;
  code: string;
  title: string;
  academicYear: string;
  isArchived?: boolean;
};

export type Language = "python" | "java";
export type Provenance = "invigilated" | "takehome" | "unknown";

export type Assignment = {
  id: string;
  title: string;
  language: Language;
  provenance: Provenance;
  dueAt: string;
  isPublished: boolean;
};

export type ReviewStatus = "pending" | "dismissed" | "escalated" | "confirmed_clean" | "contested";

/** A person as the API populates them onto a result. */
export type Person = { id?: string; name?: string; rollNo?: string; email?: string };

export type LayerStatus = "ok" | "skipped" | "failed";

/**
 * A queue row. listResults drops the two bulky arrays, so `matches[].spans`
 * and `behavioral.features` are only present on the detail endpoint.
 */
export type ResultRow = {
  id: string;
  submission: string;
  student: Person | string;
  rps: number;
  signalDisagreement: boolean;
  revision: number;
  structural: {
    status: LayerStatus;
    reason?: string;
    score?: number;
    exactDuplicateOf?: string;
    // One type for both endpoints. Every field the queue drops is optional on
    // StructuralMatch anyway, and giving the detail shape its own narrower
    // match type made the intersection below resolve back to this one.
    matches?: StructuralMatch[];
  };
  behavioral: {
    status: LayerStatus;
    reason?: string;
    score?: number;
    lowVariance?: { flagged: boolean; cohortPercentile?: number };
    cohortHealth?: { flagged: boolean; flooredFeatures?: string[] };
  };
  review?: {
    status: ReviewStatus;
    note?: string;
    reviewedBy?: Person | string;
    reviewedAt?: string;
    // What the student said back. A reviewer looking at a decision should see
    // the answer to it on the same screen, not somewhere else.
    studentExplanation?: string;
    explainedAt?: string;
  };
};

export type Paged<T> = { items: T[]; page: number; limit: number; total: number };

/**
 * One pair the detector looked at.
 *
 * cohortZScore is the field that stops a similarity being read on its own.
 * 0.62 means nothing until you know whether 0.62 is ordinary for this
 * assignment, and the z-score is that comparison.
 */
export type StructuralMatch = {
  otherSubmission?: string;
  otherStudent?: Person | string;
  similarity: number;
  cohortZScore?: number;
  // which transformation level of the harness this resembles, when the
  // detector could identify one
  obfuscationLevel?: number;
  // false means the pair was never actually scored, which is not the same as
  // scored and found unrelated. Absent is read as compared, because results
  // written before the field existed have no opinion either way.
  compared?: boolean;
  spans?: { aStart: number; aEnd: number; bStart: number; bEnd: number }[];
};

/** One feature's deviation from the student's own baseline. */
export type FeatureDeviation = {
  feature: string;
  value: number;
  baselineMean: number;
  baselineStdDev: number;
  zScore: number;
};

/** The detail endpoint returns everything the queue row drops. */
export type ResultDetail = ResultRow & {
  weights: { w1: number; w2: number; w3: number; effectiveW2: number };
  // Absent on results computed before the field existed. The page says so
  // rather than falling back to the current setting, which would be a guess
  // presented as provenance.
  reviewThreshold?: number;
  configVersion: number;
  detectorVersion: string;
  language: Language;
  computedAt: string;
  structural: ResultRow["structural"] & {
    candidatesConsidered?: number;
    cohortSampleSize?: number;
  };
  behavioral: ResultRow["behavioral"] & {
    anchorCount?: number;
    baselineConfidence?: number;
    features?: FeatureDeviation[];
    studentShift?: number;
    cohortMeanShift?: number;
  };
};

/**
 * A submission as listSubmissions returns it. Every field here is written by
 * createSubmission, so none of it is a guess. `student` is populated with
 * name and rollNo only, and a student listing their own work sees only
 * themselves whatever they ask for.
 */
export type Submission = {
  id: string;
  attempt: number;
  status: string;
  language: Language;
  originalFilename: string;
  sizeBytes: number;
  lineCount: number;
  submittedAt: string;
  isLate: boolean;
  provenance: Provenance;
  student?: Person | string;
};
