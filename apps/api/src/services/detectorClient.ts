import { z } from "zod";

import { env } from "../config/env.js";
import { componentLogger } from "../config/logger.js";

const log = componentLogger("detector");

export type CandidateSource = {
  submissionId: string;
  source: string;
};

export type AnalyzeRequest = {
  submissionId: string;
  language: string;
  source: string;
  // the work this submission is compared against. File 063 chooses these.
  candidates: CandidateSource[];
};

export type FeaturesRequest = {
  submissionId: string;
  language: string;
  source: string;
};

// a matching region, as line numbers in each file
const spanSchema = z.object({
  aStart: z.number().int().min(1),
  aEnd: z.number().int().min(1),
  bStart: z.number().int().min(1),
  bEnd: z.number().int().min(1),
});

const matchSchema = z.object({
  submissionId: z.string(),
  similarity: z.number().min(0).max(1),
  spans: z.array(spanSchema).default([]),
});

// what the detector promises to return. anything else is a bug we want loudly.
const analyzeResponseSchema = z.object({
  detectorVersion: z.string().min(1).max(40),
  parsed: z.boolean(),
  parseError: z.string().max(300).optional(),
  nodeCount: z.number().int().min(0).optional(),
  compared: z.boolean(),
  candidatesCompared: z.number().int().min(0),
  matches: z.array(matchSchema).default([]),
  durationMs: z.number().min(0),
});

const featuresResponseSchema = z.object({
  detectorVersion: z.string().min(1).max(40),
  // which definition of the features these numbers came from. Stored on the
  // baseline, so numbers from one version are never compared with another's.
  featureSetVersion: z.number().int().min(1),
  parsed: z.boolean(),
  parseError: z.string().max(300).optional(),
  nodeCount: z.number().int().min(0).optional(),
  lineCount: z.number().int().min(0).optional(),
  // A null value means the feature did not apply to this file, which is not
  // a measurement of zero. nullable() accepts that and still refuses a
  // string or a boolean, so the distinction survives the boundary instead
  // of being quietly cast to 0.
  features: z.record(z.string(), z.number().nullable()).default({}),
  durationMs: z.number().min(0),
});

export type AnalyzeResponse = z.infer<typeof analyzeResponseSchema>;
export type FeaturesResponse = z.infer<typeof featuresResponseSchema>;

async function postJson(path: string, body: unknown): Promise<unknown> {
  let res: Response;

  try {
    res = await fetch(`${env.DETECTOR_URL}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // the detector refuses an unauthenticated call with 401, which
        // postJson surfaces as "Detector replied 401"
        "x-detector-token": env.DETECTOR_TOKEN,
      },
      body: JSON.stringify(body),
      // covers the whole call, including a detector that accepts the
      // connection and then thinks forever
      signal: AbortSignal.timeout(env.DETECTOR_TIMEOUT_MS),
    });
  } catch (err) {
    // a timeout and a refused connection are different problems, so they
    // get different messages. this text ends up on the student's record.
    const name = (err as { name?: string })?.name;
    if (name === "TimeoutError") {
      throw new Error(`Detector did not answer within ${env.DETECTOR_TIMEOUT_MS} ms`);
    }
    throw new Error(`Detector is unreachable at ${env.DETECTOR_URL}`);
  }

  if (!res.ok) {
    // keep the detector's own message, but never as much of it as it likes
    const detail = (await res.text().catch(() => "")).trim().slice(0, 200);
    throw new Error(`Detector replied ${res.status}${detail ? ": " + detail : ""}`);
  }

  try {
    return await res.json();
  } catch {
    throw new Error("Detector replied with something that is not JSON");
  }
}

export async function analyzeSubmission(request: AnalyzeRequest): Promise<AnalyzeResponse> {
  const startedAt = Date.now();
  const raw = await postJson("/analyze", request);

  const parsed = analyzeResponseSchema.safeParse(raw);
  if (!parsed.success) {
    log.error(
      { submissionId: request.submissionId, issues: parsed.error.issues.slice(0, 3) },
      "detector returned an unexpected shape",
    );
    throw new Error("Detector returned a response this API does not understand");
  }

  log.info(
    {
      submissionId: request.submissionId,
      candidates: request.candidates.length,
      matches: parsed.data.matches.length,
      parsed: parsed.data.parsed,
      detectorMs: parsed.data.durationMs,
      roundTripMs: Date.now() - startedAt,
    },
    "analysis complete",
  );

  return parsed.data;
}

/**
 * One file's style numbers, for Layer 2.
 *
 * Does not throw when the source will not parse. The caller decides what an
 * unmeasurable anchor means, exactly as it does for an unanalysable
 * submission, because that is a judgement about baselines and not about HTTP.
 */
export async function extractFeatures(request: FeaturesRequest): Promise<FeaturesResponse> {
  const startedAt = Date.now();
  const raw = await postJson("/features", request);

  const parsed = featuresResponseSchema.safeParse(raw);
  if (!parsed.success) {
    log.error(
      { submissionId: request.submissionId, issues: parsed.error.issues.slice(0, 3) },
      "detector returned an unexpected feature shape",
    );
    throw new Error("Detector returned a features response this API does not understand");
  }

  const values = Object.values(parsed.data.features);

  log.info(
    {
      submissionId: request.submissionId,
      parsed: parsed.data.parsed,
      featureSetVersion: parsed.data.featureSetVersion,
      // how many of the features actually applied to this file, which is
      // what decides whether the anchor is worth keeping
      measured: values.filter((value) => value !== null).length,
      of: values.length,
      lineCount: parsed.data.lineCount,
      detectorMs: parsed.data.durationMs,
      roundTripMs: Date.now() - startedAt,
    },
    "features extracted",
  );

  return parsed.data;
}

// a cheap "are you there?" for startup, with its own short timeout
export async function pingDetector(): Promise<boolean> {
  try {
    const res = await fetch(`${env.DETECTOR_URL}/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}
