/**
 * The review queue for one assignment. This is the reference screen: the
 * patterns here are the ones the other screens need.
 *
 * Four of them are worth naming, because each one is a mistake this project
 * has already made somewhere else:
 *
 * 1. A score that is absent is not a score of zero. A skipped layer renders as
 *    a dash, never 0.000, and the reason the API gave is shown instead.
 * 2. The flags are shown even when they undermine the ranking. A row at the
 *    top with "cohort not separating" is telling the reviewer not to trust its
 *    own number, and hiding that would make the screen a verdict machine.
 * 3. Column widths come from the data, not from a guess. The demo script
 *    printed a misaligned table for weeks because 12 characters was assumed to
 *    be enough for a name.
 * 4. Nothing here says who copied from whom. Two rows can both show a
 *    similarity of 1.000 and the system cannot tell them apart. The screen
 *    ranks and stops.
 */
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import * as api from "../api/client";
import type { Assignment, Person, ResultRow, ReviewStatus } from "../api/types";

/** The API populates `student` when it can, and leaves an id when it cannot. */
function nameOf(who: Person | string | undefined): string {
  if (!who) return "unknown";
  if (typeof who === "string") return who;
  return who.name ?? who.rollNo ?? who.id ?? "unknown";
}

/** A layer score, or a dash when the layer did not run. */
function score(value: number | undefined, status: string): string {
  if (status !== "ok" || typeof value !== "number") return "—";
  return value.toFixed(3);
}

function flagsFor(row: ResultRow): string[] {
  const flags: string[] = [];
  if (row.structural?.exactDuplicateOf) flags.push("exact duplicate");
  if (row.behavioral?.lowVariance?.flagged) flags.push("low variance");
  if (row.behavioral?.cohortHealth?.flagged) flags.push("cohort not separating");
  if (row.signalDisagreement) flags.push("layers disagree");
  if (row.structural?.status !== "ok") flags.push(`L1 ${row.structural?.status}`);
  if (row.behavioral?.status !== "ok") flags.push(`L2 ${row.behavioral?.status}`);
  return flags;
}

const FILTERS: { label: string; value: ReviewStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Escalated", value: "escalated" },
  { label: "Dismissed", value: "dismissed" },
];

export function QueuePage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [rows, setRows] = useState<ResultRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<ReviewStatus | "all">("all");
  const [error, setError] = useState<string | null>(null);

  // useCallback so the effect below has one stable dependency rather than
  // being rebuilt on every render
  const load = useCallback(async () => {
    if (!assignmentId) return;
    setError(null);
    setRows(null);
    try {
      const page = await api.listResults(assignmentId, filter === "all" ? undefined : filter);
      setRows(page.items);
      setTotal(page.total);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [assignmentId, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!assignmentId) return;
    let cancelled = false;
    api
      .getAssignment(assignmentId)
      .then((body) => {
        if (!cancelled) setAssignment(body.assignment);
      })
      .catch(() => {
        // the queue is still worth showing without the assignment's title
      });
    return () => {
      cancelled = true;
    };
  }, [assignmentId]);

  return (
    <main>
      <header className="bar">
        <h1>{assignment?.title ?? "Review queue"}</h1>
        <Link to="/">Back to courses</Link>
      </header>

      {assignment ? (
        <p className="muted">
          {assignment.language} · {assignment.provenance} ·{" "}
          {assignment.isPublished ? "published" : "draft"}
        </p>
      ) : null}

      <div className="filters">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            className={filter === f.value ? "chip on" : "chip"}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error ? <p className="error">{error}</p> : null}
      {!rows && !error ? <p className="muted">Loading…</p> : null}
      {rows?.length === 0 ? <p className="muted">Nothing in this view.</p> : null}

      {rows && rows.length > 0 ? (
        <>
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th className="num">RPS</th>
                <th className="num">Layer 1</th>
                <th className="num">Layer 2</th>
                <th>Flags</th>
                <th>Review</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const flags = flagsFor(row);
                return (
                  <tr key={row.id}>
                    <td>{nameOf(row.student)}</td>
                    <td className="num strong">{row.rps.toFixed(3)}</td>
                    <td className="num">{score(row.structural?.score, row.structural?.status)}</td>
                    <td className="num">{score(row.behavioral?.score, row.behavioral?.status)}</td>
                    <td>
                      {flags.length === 0 ? (
                        <span className="muted">—</span>
                      ) : (
                        flags.map((flag) => (
                          <span key={flag} className="flag">
                            {flag}
                          </span>
                        ))
                      )}
                    </td>
                    <td>{row.review?.status ?? "pending"}</td>
                    <td>
                      <Link to={`/submissions/${row.submission}/evidence`}>Evidence</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <p className="muted">
            {total} result{total === 1 ? "" : "s"}, highest first. Nothing here is a verdict:
            the layers rank, and a person decides.
          </p>
        </>
      ) : null}
    </main>
  );
}
