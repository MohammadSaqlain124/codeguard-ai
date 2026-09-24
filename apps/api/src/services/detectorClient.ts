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
  matches: z.array(matchSchema).default([]),
  durationMs: z.number().min(0),
});

export type AnalyzeResponse = z.infer<typeof analyzeResponseSchema>;

async function postJson(path: string, body: unknown): Promise<unknown> {
  let res: Response;

  try {
    res = await fetch(`${env.DETECTOR_URL}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
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

// a cheap "are you there?" for startup, with its own short timeout
export async function pingDetector(): Promise<boolean> {
  try {
    const res = await fetch(`${env.DETECTOR_URL}/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}
