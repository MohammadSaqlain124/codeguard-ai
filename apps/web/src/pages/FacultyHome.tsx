/**
 * The faculty dashboard.
 *
 * There is no aggregate endpoint, so this composes what it shows from the
 * three that exist: courses, then each course's assignments, then each
 * assignment's results. Fine for a class, wrong for an institution, and
 * worth saying out loud: the figures below are counted in the browser, not
 * reported by the server.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import * as api from "../api/client";
import type { Assignment, Course, Person, ResultRow } from "../api/types";

type Pair = { assignment: Assignment; course: Course; row: ResultRow };
type Loaded = {
  courses: Course[];
  assignments: { course: Course; assignment: Assignment }[];
  results: Pair[];
};

function nameOf(who: Person | string | undefined): string {
  if (!who) return "unknown";
  if (typeof who === "string") return who;
  return who.name ?? who.rollNo ?? who.email ?? "unknown";
}

function rollOf(who: Person | string | undefined): string | undefined {
  return typeof who === "object" ? who?.rollNo : undefined;
}

function isPending(row: ResultRow) {
  const status = row.review?.status;
  return status === undefined || status === "pending";
}

/**
 * The badge gets heavier as the score rises and says nothing else. There is
 * deliberately no band here: a queue row does not carry the threshold it was
 * judged against, so any "high" or "clear" label would be this page deciding
 * something the result never recorded.
 */
function Rps({ value }: { value: number }) {
  const weight = Math.min(1, Math.max(0, value));
  return (
    <span
      className="rps-badge"
      style={{
        background: `rgba(224, 145, 18, ${(0.05 + weight * 0.66).toFixed(3)})`,
        borderColor: `rgba(201, 122, 14, ${(0.2 + weight * 0.6).toFixed(3)})`,
      }}
    >
      {value.toFixed(3)}
    </span>
  );
}

/** Which layers actually produced a finding on this row. */
function Layers({ row }: { row: ResultRow }) {
  const s = row.structural?.status === "ok";
  const b = row.behavioral?.status === "ok";
  return (
    <span className="layers" title={`structural ${s ? "ran" : "did not run"}, behavioural ${b ? "ran" : "did not run"}`}>
      <i className={s ? "on" : "off"} />
      <i className={b ? "on" : "off"} />
    </span>
  );
}

export function FacultyHome() {
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const courses = (await api.listCourses()).items;

      const perCourse = await Promise.all(
        courses.map(async (course) => {
          const items = (await api.listAssignments(course.id)).items;
          return items.map((assignment) => ({ course, assignment }));
        }),
      );
      const assignments = perCourse.flat();

      const perAssignment = await Promise.all(
        assignments.map(async ({ course, assignment }) => {
          try {
            const page = await api.listResults(assignment.id);
            return page.items.map((row) => ({ assignment, course, row }));
          } catch {
            // an assignment with nothing analysed yet is not an error
            return [];
          }
        }),
      );

      if (!cancelled) {
        setData({ courses, assignments, results: perAssignment.flat() });
      }
    }

    load().catch((err: Error) => {
      if (!cancelled) setError(err.message);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <main>
        <div className="page-head">
          <h1>Dashboard</h1>
        </div>
        <p className="error">{error}</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main>
        <div className="page-head">
          <h1>Dashboard</h1>
        </div>
        <p className="muted">Loading…</p>
      </main>
    );
  }

  const pending = data.results.filter((r) => isPending(r.row));
  const disagreeing = data.results.filter((r) => r.row.signalDisagreement);
  const ranked = [...pending].sort((a, b) => b.row.rps - a.row.rps).slice(0, 9);
  const reviewed = data.results.length - pending.length;
  const progress = data.results.length === 0 ? 0 : (reviewed / data.results.length) * 100;

  return (
    <main>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>
            Everything waiting on you, ordered by how much it warrants a look.
            The score ranks this list and decides nothing.
          </p>
        </div>
      </div>

      <div className="cards">
        <div className="stat">
          <div className="lbl">Courses</div>
          <div className="big">{data.courses.length}</div>
          <div className="sub">{data.assignments.length} assignments</div>
        </div>
        <div className="stat">
          <div className="lbl">Analysed</div>
          <div className="big">{data.results.length}</div>
          <div className="sub">submissions with a result</div>
        </div>
        <div className="stat warn">
          <div className="lbl">Awaiting review</div>
          <div className="big">{pending.length}</div>
          <div className="sub">no decision recorded yet</div>
        </div>
        <div className="stat warn">
          <div className="lbl">Layers disagree</div>
          <div className="big">{disagreeing.length}</div>
          <div className="sub">worth opening first</div>
        </div>
      </div>

      <div className="progress-line">
        <span className="strong">{reviewed}</span> of {data.results.length} decided
        <span className="meter">
          <span style={{ width: `${progress}%` }} />
        </span>
        <span>{Math.round(progress)}%</span>
      </div>

      <section>
        <div className="sect-head">
          <h2>Waiting on a decision</h2>
          <span className="hint">Heavier badge means a higher score, nothing more</span>
        </div>

        {ranked.length === 0 ? (
          <p className="muted">Nothing is waiting. Every analysed result has a decision.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Assignment</th>
                <th className="num">RPS</th>
                <th>Layers</th>
                <th>Signals</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map(({ assignment, course, row }) => (
                <tr key={row.id} className="needs">
                  <td>
                    <Link to={`/submissions/${row.submission}/evidence`} className="strong">
                      {nameOf(row.student)}
                    </Link>
                    {rollOf(row.student) ? (
                      <div className="muted">{rollOf(row.student)}</div>
                    ) : null}
                  </td>
                  <td>
                    {assignment.title}
                    <div className="muted">
                      {course.code} · {assignment.language}
                    </div>
                  </td>
                  <td className="num">
                    <Rps value={row.rps} />
                  </td>
                  <td>
                    <Layers row={row} />
                  </td>
                  <td>
                    {row.signalDisagreement ? (
                      <span className="flag">layers disagree</span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <div className="sect-head">
          <h2>Your courses</h2>
          <Link to="/courses" className="hint">
            All courses →
          </Link>
        </div>
        <div className="cards">
          {data.courses.map((course) => {
            const mine = data.assignments.filter((a) => a.course.id === course.id);
            const open = data.results.filter(
              (r) => r.course.id === course.id && isPending(r.row),
            ).length;
            return (
              <Link key={course.id} to="/courses" className="course-card">
                <div className="code">{course.code}</div>
                <div className="name">{course.title}</div>
                <div className="meta">
                  {mine.length} assignment{mine.length === 1 ? "" : "s"} ·{" "}
                  {open} waiting
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
