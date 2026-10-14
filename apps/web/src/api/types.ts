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
    matches?: { otherStudent?: Person | string; similarity: number; compared?: boolean }[];
  };
  behavioral: {
    status: LayerStatus;
    reason?: string;
    score?: number;
    lowVariance?: { flagged: boolean; cohortPercentile?: number };
    cohortHealth?: { flagged: boolean; flooredFeatures?: string[] };
  };
  review?: { status: ReviewStatus; note?: string; reviewedBy?: Person | string; reviewedAt?: string };
};

export type Paged<T> = { items: T[]; page: number; limit: number; total: number };

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
  configVersion: number;
  detectorVersion: string;
  language: Language;
  computedAt: string;
  structural: ResultRow["structural"] & {
    candidatesConsidered?: number;
    cohortSampleSize?: number;
    matches?: {
      otherStudent?: Person | string;
      similarity: number;
      compared?: boolean;
      spans?: { aStart: number; aEnd: number; bStart: number; bEnd: number }[];
    }[];
  };
  behavioral: ResultRow["behavioral"] & {
    anchorCount?: number;
    baselineConfidence?: number;
    features?: FeatureDeviation[];
    studentShift?: number;
    cohortMeanShift?: number;
  };
};
