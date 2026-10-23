/**
 * The student dashboard.
 *
 * Deliberately short on judgement. A student seeing their own detection
 * scores would turn a ranking tool into a thing to game, so this shows what
 * they submitted and whether it has been looked at, and nothing about how it
 * scored. That restraint is the design, not a missing feature.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import * as api from "../api/client";
import type { Assignment, Course, Submission } from "../api/types";

type Row = { course: Course; assignment: Assignment; mine: Submission[] };

function when(iso: string | undefined) {
  if (!iso) return "unknown";
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? "unknown" : at.toLocaleDateString();
}

export function StudentHome() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const courses = (await api.listCourses()).items;

      const nested = await Promise.all(
        courses.map(async (course) => {
          const assignments = (await api.listAssignments(course.id)).items;
          return Promise.all(
            assignments.map(async (assignment) => {
              try {
                const page = await api.listSubmissions(assignment.id);
                return { course, assignment, mine: page.items };
              } catch {
                // an assignment you cannot list is simply one with nothing in it
                return { course, assignment, mine: [] };
              }
            }),
          );
        }),
      );

      if (!cancelled) setRows(nested.flat());
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
        <h1>Dashboard</h1>
        <p className="error">{error}</p>
      </main>
    );
  }

  if (!rows) {
    return (
      <main>
        <h1>Dashboard</h1>
        <p className="muted">Loading…</p>
      </main>
    );
  }

  const submitted = rows.flatMap((r) => r.mine);
  const now = Date.now();
  const open = rows.filter((r) => new Date(r.assignment.dueAt).getTime() >= now);
  const notYet = rows.filter((r) => r.mine.length === 0);
  const courses = new Set(rows.map((r) => r.course.id)).size;

  return (
    <main>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>
            What you have submitted, and what is still open. Your work is
            checked after it is uploaded, and your teacher sees the outcome.
          </p>
        </div>
      </div>

      <div className="cards">
        <div className="stat">
          <div className="lbl">Courses</div>
          <div className="big">{courses}</div>
          <div className="sub">{rows.length} assignments in total</div>
        </div>
        <div className="stat good">
          <div className="lbl">Submitted</div>
          <div className="big">{submitted.length}</div>
          <div className="sub">uploads across all assignments</div>
        </div>
        <div className="stat warn">
          <div className="lbl">Nothing submitted</div>
          <div className="big">{notYet.length}</div>
          <div className="sub">assignments with no upload</div>
        </div>
        <div className="stat">
          <div className="lbl">Still open</div>
          <div className="big">{open.length}</div>
          <div className="sub">deadline has not passed</div>
        </div>
      </div>

      <section>
        <h2>Your assignments</h2>
        {rows.length === 0 ? (
          <p className="muted">You are not enrolled in anything yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Assignment</th>
                <th>Course</th>
                <th>Due</th>
                <th>Attempts</th>
                <th>Latest</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ course, assignment, mine }) => {
                const latest = mine[0];
                const late = new Date(assignment.dueAt).getTime() < now;
                return (
                  <tr key={assignment.id}>
                    <td>
                      <span className="strong">{assignment.title}</span>
                      <div className="muted">{assignment.language}</div>
                    </td>
                    <td className="muted">{course.code}</td>
                    <td className="muted">
                      {when(assignment.dueAt)}{" "}
                      {late ? <span className="flag">closed</span> : null}
                    </td>
                    <td className="num">{mine.length}</td>
                    <td>
                      {latest ? (
                        <span className="pill clear">{latest.status}</span>
                      ) : (
                        <span className="pill look">nothing yet</span>
                      )}
                    </td>
                    <td>
                      <Link to={`/assignments/${assignment.id}/submit`}>
                        {latest ? "Submit again" : "Submit"}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2>What happens to your work</h2>
        <p className="muted">
          Every upload is compared with other submissions and with how you have
          written before. The result goes to your teacher as a ranking, never as
          a verdict, and a person decides anything that follows. You are told if
          something is raised with you.
        </p>
      </section>
    </main>
  );
}
