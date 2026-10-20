/**
 * The evidence behind one score, and the screen the whole project is for.
 *
 * The queue ranks. This explains, and it has one job above all the others:
 * nobody should be able to read a number off this page without also reading
 * what produced it and what is wrong with it.
 *
 * Four rules, each from something the project got wrong somewhere else:
 *
 * 1. The RPS is shown as arithmetic, not as a figure. A reviewer asked "where
 *    does 0.62 come from" must be able to read the answer off the screen,
 *    including the renormalisation, because the headline 0.4 / 0.3 / 0.3 are
 *    never the weights actually applied.
 * 2. A similarity is never shown without its cohort z-score. 0.62 means
 *    nothing until you know whether 0.62 is ordinary for this assignment.
 * 3. A pair the detector never scored is said to be unscored, not shown as a
 *    zero. The two are different findings and only one of them is a finding.
 * 4. Everything that weakens the number is on the same screen as the number:
 *    a thin baseline, a cohort that is not separating, layers disagreeing. A
 *    screen that hid those would be the verdict machine this is not.
 *
 * Known limit: a span is a pair of line ranges, not the lines themselves.
 * Rendering the two files side by side needs both sources, which is a second
 * fetch per match against /file and a diff view. The ranges plus a link to
 * each file are honest evidence; they are just more work to read.
 */
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import * as api from "../api/client";
import type { Person, ResultDetail, ReviewStatus, StructuralMatch } from "../api/types";

/** The four states a reviewer can move a result into. "pending" is not one. */
const DECISIONS: { value: ReviewStatus; label: string }[] = [
  { value: "dismissed", label: "Dismissed" },
  { value: "escalated", label: "Escalated" },
  { value: "confirmed_clean", label: "Confirmed clean" },
  { value: "contested", label: "Contested" },
];

const MIN_NOTE = 10;

function nameOf(who: Person | string | undefined): string {
  if (!who) return "unknown";
  if (typeof who === "string") return who;
  return who.name ?? who.rollNo ?? who.id ?? "unknown";
}

/** A number, or a dash. Never 0.000 standing in for "no answer". */
function num(value: number | undefined, places = 3): string {
  return typeof value === "number" ? value.toFixed(places) : "—";
}

/**
 * How many decimals a feature row needs for its z to be checkable by hand.
 * The z is (value - mean) / spread, so a rounded value moves the z by the
 * rounding error divided by the spread. A spread of 4.00 can live with two
 * decimals; a spread of 0.03 needs four, or the arithmetic on screen does
 * not come out to the z printed next to it.
 */
function placesFor(spread: number | undefined): number {
  if (typeof spread !== "number" || spread <= 0) return 2;
  return Math.min(4, Math.max(2, Math.ceil(-Math.log10(0.005 * spread))));
}

function when(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

/**
 * The RPS, spelled out.
 *
 * runDetection renormalises over the layers that actually ran, so a result
 * with Layer 2 skipped divides by w1 alone rather than letting the absent
 * layer drag the score toward zero. Recomputing it here would be a second
 * implementation that could disagree with the first, so this reads the stored
 * weights and shows the sum the API already arrived at.
 */
function ScoreBreakdown({ result }: { result: ResultDetail }) {
  const w = result.weights;
  const l1ok = result.structural?.status === "ok";
  const l2ok = result.behavioral?.status === "ok";
  const s = result.structural?.score ?? 0;
  const b = result.behavioral?.score ?? 0;

  const active = (l1ok ? w.w1 : 0) + (l2ok ? w.effectiveW2 : 0);
  // The products are shown before the division, not after it. Dividing each
  // row first and rounding the results gave a column that did not add up to
  // the figure above it: 0.4/0.7 and 0.099/0.7 display as 0.571 and 0.141,
  // which sum to 0.712, while the true total rounds to 0.713. Rounding each
  // part and then adding is not the same as adding and then rounding, and on
  // a page whose whole argument is that the number is the sum of its parts
  // that is the one arithmetic error that must not appear.
  const weighted = (l1ok ? w.w1 * s : 0) + (l2ok ? w.effectiveW2 * b : 0);

  return (
    <section>
      <h2>Where this number comes from</h2>
      <p>
        <span className="headline">{num(result.rps)}</span>{" "}
        <span className="muted">relevance and provenance score</span>
      </p>

      {active === 0 ? (
        <p className="muted">
          No layer produced a score, so the RPS is 0 by definition rather than by
          measurement. Nothing here is evidence of anything.
        </p>
      ) : (
        <>
          <p className="muted">
            Renormalised over the layers that ran, so an absent layer does not drag the
            score down. The weights below are the ones stored on this result, not the
            current configuration.
          </p>
          <table>
            <thead>
              <tr>
                <th>Layer</th>
                <th className="num">Weight</th>
                <th className="num">Score</th>
                <th className="num">Weight &times; score</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>1 — structural</td>
                <td className="num">
                  {l1ok ? num(w.w1) : <span className="muted">excluded</span>}
                </td>
                <td className="num">{l1ok ? num(s) : "—"}</td>
                <td className="num">{l1ok ? num(w.w1 * s) : "—"}</td>
              </tr>
              <tr>
                <td>
                  2 — behavioural
                  {l2ok && w.effectiveW2 !== w.w2 ? (
                    <span className="flag">attenuated from {num(w.w2, 2)}</span>
                  ) : null}
                </td>
                <td className="num">
                  {l2ok ? num(w.effectiveW2) : <span className="muted">excluded</span>}
                </td>
                <td className="num">{l2ok ? num(b) : "—"}</td>
                <td className="num">{l2ok ? num(w.effectiveW2 * b) : "—"}</td>
              </tr>
              <tr>
                <td>3 — AI content</td>
                <td className="num">
                  <span className="muted">not implemented</span>
                </td>
                <td className="num">—</td>
                <td className="num">—</td>
              </tr>
              <tr>
                <td colSpan={3} className="num muted">
                  Total, divided by {num(active)}, the weight of the layers that ran
                </td>
                <td className="num strong">{num(weighted)}</td>
              </tr>
            </tbody>
          </table>
          <p className="muted">
            {num(weighted)} &divide; {num(active)} = {num(result.rps)}. A layer excluded above
            contributes nothing rather than contributing zero, which is why the divisor is
            not 1. Everything here is shown to three decimals, so a column may be a
            thousandth out even when the stored figures are exact.
          </p>
        </>
      )}
    </section>
  );
}

/** Everything that makes the number above less trustworthy. */
function Caveats({ result }: { result: ResultDetail }) {
  const items: string[] = [];

  if (result.signalDisagreement) {
    // The old wording called this "two confident and opposite findings". The
    // flag is a side-of-the-line test, so it fires just as readily on 0.470
    // against 0.520, where neither layer is confident of anything. State the
    // two scores and let the reader judge the gap instead of asserting it.
    const s = result.structural.score;
    const b = result.behavioral.score;
    const t = result.reviewThreshold;

    if (typeof s === "number" && typeof b === "number" && typeof t === "number") {
      // The distances, not just the scores. Both of these are the same flag:
      // 1.000 against 0.330, and 0.510 against 0.490. Only the distance from
      // the line separates them, and no verdict is offered on which this is,
      // because the margin that would decide it has never been measured.
      const side = (v: number) => (v >= t ? "above" : "below");
      items.push(
        `The two layers landed on opposite sides of the review threshold ${num(t)}. ` +
          `Structural ${num(s)} is ${num(Math.abs(s - t))} ${side(s)} it; ` +
          `behavioural ${num(b)} is ${num(Math.abs(b - t))} ${side(b)} it. ` +
          "Two scores that straddle the line narrowly are not the same finding " +
          "as two that are far from it, and this flag does not tell them apart.",
      );
    } else {
      const scores =
        typeof s === "number" && typeof b === "number"
          ? `: structural ${num(s)}, behavioural ${num(b)}`
          : "";
      items.push(
        `The two layers landed on opposite sides of the review threshold${scores}. ` +
          "The threshold itself is not recorded on this result, so the distances " +
          "cannot be shown here, and the setting in force today would be a guess " +
          "rather than what this result was judged against.",
      );
    }
  }
  if (result.behavioral?.cohortHealth?.flagged) {
    const floored = result.behavioral.cohortHealth.flooredFeatures ?? [];
    const on = floored.length ? ` on ${floored.join(", ")}` : "";
    items.push(
      `The cohort is not separating${on}. The behavioural score is being measured ` +
        "against a spread too small to mean much.",
    );
  }
  if (result.behavioral?.lowVariance?.flagged) {
    const pct = num(result.behavioral.lowVariance.cohortPercentile, 1);
    items.push(
      `This student's own work varies less than the cohort's (percentile ${pct}). ` +
        "Consistency reads as a deviation here, which penalises somebody whose " +
        "style is simply stable.",
    );
  }
  if (result.structural?.exactDuplicateOf) {
    items.push(
      "The bytes are identical to another submission. That was found from the " +
        "content hash, not from the similarity score.",
    );
  }
  const confidence = result.behavioral?.baselineConfidence;
  if (typeof confidence === "number" && confidence < 0.5) {
    const anchors = result.behavioral?.anchorCount ?? 0;
    items.push(
      `Baseline confidence is ${num(confidence)}, built from ${anchors} anchor(s). ` +
        "A thin baseline makes the behavioural score a weak signal.",
    );
  }

  if (items.length === 0) return null;

  return (
    <section>
      <h2>Read this before the number</h2>
      <ul className="plain">
        {items.map((text) => (
          <li key={text}>{text}</li>
        ))}
      </ul>
    </section>
  );
}

function MatchRow({ match }: { match: StructuralMatch }) {
  const unscored = match.compared === false;
  return (
    <tr>
      <td>{nameOf(match.otherStudent)}</td>
      <td className="num">
        {unscored ? <span className="muted">not scored</span> : num(match.similarity)}
      </td>
      <td className="num">{unscored ? "—" : num(match.cohortZScore, 2)}</td>
      <td>
        {unscored ? (
          <span className="muted">
            every unit pairing was too far apart in size to compare
          </span>
        ) : match.spans && match.spans.length > 0 ? (
          match.spans.map((span, i) => (
            <span key={i} className="flag">
              {span.aStart}–{span.aEnd} ↔ {span.bStart}–{span.bEnd}
            </span>
          ))
        ) : (
          <span className="muted">no span above the reporting threshold</span>
        )}
      </td>
    </tr>
  );
}

function StructuralLayer({ result }: { result: ResultDetail }) {
  const l = result.structural;
  const matches = l?.matches ?? [];

  return (
    <section>
      <h2>Layer 1 — structural</h2>
      {l?.status !== "ok" ? (
        <p className="muted">
          {l?.status ?? "missing"}: {l?.reason ?? "no reason recorded"}
        </p>
      ) : (
        <>
          <p className="muted">
            Highest similarity {num(l.score)} against {l.candidatesConsidered ?? "?"} candidate(s)
            considered, {l.cohortSampleSize ?? matches.length} recorded. Identifiers, numbers and
            strings are normalised away before comparison, so renaming variables and changing
            constants do not move this score.
          </p>
          {matches.length === 0 ? (
            <p className="muted">No pairs recorded.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Compared with</th>
                  <th className="num">Similarity</th>
                  <th className="num">Cohort z</th>
                  <th>Matching lines (this ↔ theirs)</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((m, i) => (
                  <MatchRow key={m.otherSubmission ?? i} match={m} />
                ))}
              </tbody>
            </table>
          )}
          <p className="muted">
            Nothing here says who copied from whom. Two submissions can both show a
            similarity of 1.000 and the system cannot order them.
          </p>
        </>
      )}
    </section>
  );
}

function BehaviouralLayer({ result }: { result: ResultDetail }) {
  const l = result.behavioral;
  const features = l?.features ?? [];

  return (
    <section>
      <h2>Layer 2 — behavioural</h2>
      {l?.status !== "ok" ? (
        <p className="muted">
          {l?.status ?? "missing"}: {l?.reason ?? "no reason recorded"}
        </p>
      ) : (
        <>
          <p className="muted">
            Score {num(l.score)} from a baseline of {l.anchorCount ?? 0} anchor(s), confidence{" "}
            {num(l.baselineConfidence)}. Measured against how this student usually writes, not
            against anybody else.
          </p>
          {features.length === 0 ? (
            <p className="muted">No per-feature detail recorded.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Feature</th>
                  <th className="num">This file</th>
                  <th className="num">Their usual</th>
                  <th className="num">Their spread</th>
                  <th className="num">z</th>
                </tr>
              </thead>
              <tbody>
                {features.map((f) => {
                  const p = placesFor(f.baselineStdDev);
                  return (
                    <tr key={f.feature}>
                      <td>{f.feature}</td>
                      <td className="num">{num(f.value, p)}</td>
                      <td className="num">{num(f.baselineMean, p)}</td>
                      <td className="num">{num(f.baselineStdDev, p)}</td>
                      <td className="num strong">{num(f.zScore, 2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {typeof l.studentShift === "number" || typeof l.cohortMeanShift === "number" ? (
            <p className="muted">
              This student moved {num(l.studentShift, 2)} since the baseline period; the cohort
              moved {num(l.cohortMeanShift, 2)}. A whole class drifting together is the course
              teaching them something, not any one of them outsourcing.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

function Provenance({ result, revisions }: { result: ResultDetail; revisions: number[] }) {
  return (
    <section>
      <h2>Provenance</h2>
      <ul className="plain muted">
        <li>Computed {when(result.computedAt)}</li>
        <li>Detector {result.detectorVersion}</li>
        <li>
          Settings{" "}
          {result.configVersion === 0
            ? "the built-in defaults, because nothing is saved for this course"
            : `version ${result.configVersion}, saved for this course`}
        </li>
        <li>
          Review threshold{" "}
          {typeof result.reviewThreshold === "number"
            ? num(result.reviewThreshold)
            : "not recorded on this result"}
        </li>
        <li>
          Revision {result.revision} of {revisions.length}
        </li>
        <li>Language {result.language}</li>
      </ul>
    </section>
  );
}

function ReviewPanel({
  result,
  onReviewed,
}: {
  result: ResultDetail;
  onReviewed: (next: ResultDetail) => void;
}) {
  // Starts empty on purpose. A decision goes on a student's record, so the
  // form must not arrive with one of them already chosen.
  const [status, setStatus] = useState<ReviewStatus | "">("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existing = result.review;
  const tooShort = note.trim().length < MIN_NOTE;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!status || tooShort || saving) return;
    setSaving(true);
    setError(null);
    try {
      const body = await api.reviewResult(result.submission, status, note.trim());
      onReviewed(body.result);
      setNote("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <h2>Review</h2>

      {existing && existing.status !== "pending" ? (
        <ul className="plain">
          <li>
            <span className="strong">{existing.status.replace("_", " ")}</span> by{" "}
            {nameOf(existing.reviewedBy)}, {when(existing.reviewedAt)}
          </li>
          {existing.note ? <li className="muted">{existing.note}</li> : null}
        </ul>
      ) : (
        <p className="muted">Nobody has recorded a decision yet.</p>
      )}

      {existing?.studentExplanation ? (
        <ul className="plain indent">
          <li className="muted">The student answered, {when(existing.explainedAt)}:</li>
          <li>{existing.studentExplanation}</li>
        </ul>
      ) : null}

      <form onSubmit={submit}>
        <label htmlFor="decision">Record a decision</label>
        <select
          id="decision"
          value={status}
          onChange={(e) => setStatus(e.target.value as ReviewStatus | "")}
        >
          <option value="">Choose a decision</option>
          {DECISIONS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>

        <label htmlFor="note">
          Why. This goes on the student's record and into the audit log, so it has to say
          something.
        </label>
        <input
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="At least ten characters"
        />

        {error ? <p className="error">{error}</p> : null}

        <button type="submit" disabled={!status || tooShort || saving}>
          {saving ? "Recording…" : "Record"}
        </button>
      </form>
    </section>
  );
}

export function EvidencePage() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const [result, setResult] = useState<ResultDetail | null>(null);
  const [revisions, setRevisions] = useState<number[]>([]);
  const [showing, setShowing] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!submissionId) return;
    setError(null);
    setResult(null);
    try {
      const body = await api.getResult(submissionId, showing);
      setResult(body.result);
      setRevisions(body.revisions);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [submissionId, showing]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <main>
        <header className="bar">
          <h1>Evidence</h1>
          <Link to="/">Back to courses</Link>
        </header>
        <p className="error">{error}</p>
      </main>
    );
  }

  if (!result) {
    return (
      <main>
        <header className="bar">
          <h1>Evidence</h1>
        </header>
        <p className="muted">Loading…</p>
      </main>
    );
  }

  const isOld = revisions.length > 1 && result.revision !== Math.max(...revisions);

  return (
    <main>
      <header className="bar">
        <h1>{nameOf(result.student)}</h1>
        <Link to="/">Back to courses</Link>
      </header>

      {revisions.length > 1 ? (
        <div className="filters">
          {revisions.map((r) => (
            <button
              key={r}
              className={result.revision === r ? "chip on" : "chip"}
              onClick={() => setShowing(r)}
            >
              Revision {r}
            </button>
          ))}
        </div>
      ) : null}

      {isOld ? (
        <p className="error">
          This is a superseded revision. It is kept because a decision may have been
          recorded against it, not because it is the current answer.
        </p>
      ) : null}

      <ScoreBreakdown result={result} />
      <Caveats result={result} />
      <StructuralLayer result={result} />
      <BehaviouralLayer result={result} />
      <Provenance result={result} revisions={revisions} />
      <ReviewPanel result={result} onReviewed={setResult} />
    </main>
  );
}
