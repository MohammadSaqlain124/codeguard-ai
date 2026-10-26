/**
 * Courses, assignments and enrolment.
 *
 * This is the screen that was missing, and its absence was not cosmetic: a
 * student who registers is enrolled in nothing, so they have no courses, no
 * assignments, and therefore nowhere to upload. The submit screen existed
 * but no student could reach it. Enrolment is the link.
 *
 * Enrolment is by roll number because that is what the API takes, and
 * because a roll number is the thing a faculty member actually has in front
 * of them. The reply says how many were added, how many were already there
 * and which were not found, and all three are reported rather than collapsed
 * into "done".
 */
import { useCallback, useEffect, useState } from "react";

import * as api from "../api/client";
import type { Assignment, Course, Language, User } from "../api/types";
import { useAuth } from "../auth/AuthProvider";

const LANGUAGES: Language[] = ["python", "java"];

/**
 * datetime-local has no timezone, and the API refuses a deadline without
 * one: the same text would otherwise mean IST on a laptop and UTC in
 * Docker. This attaches whatever offset the browser is actually in.
 */
function withOffset(local: string) {
  const at = new Date(local);
  const minutes = -at.getTimezoneOffset();
  const sign = minutes >= 0 ? "+" : "-";
  const pad = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, "0");
  return `${local}:00${sign}${pad(minutes / 60)}:${pad(minutes % 60)}`;
}

export function ManagePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [courses, setCourses] = useState<Course[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Assignment[] | null>(null);
  const [faculty, setFaculty] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // new course
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [year, setYear] = useState("2026-27");
  const [owner, setOwner] = useState("");

  // new assignment
  const [aTitle, setATitle] = useState("");
  const [aLang, setALang] = useState<Language>("python");
  const [aProv, setAProv] = useState<"takehome" | "invigilated">("takehome");
  const [aDue, setADue] = useState("");
  const [aMax, setAMax] = useState(3);

  // enrolment
  const [rolls, setRolls] = useState("");

  const loadCourses = useCallback(async () => {
    const page = await api.listCourses();
    setCourses(page.items);
  }, []);

  useEffect(() => {
    loadCourses().catch((e: Error) => setError(e.message));
    if (isAdmin) {
      api
        .listUsers({ role: "faculty" })
        .then((p) => setFaculty(p.items))
        .catch(() => setFaculty([]));
    }
  }, [loadCourses, isAdmin]);

  const loadAssignments = useCallback(async (courseId: string) => {
    setAssignments(null);
    const page = await api.listAssignments(courseId);
    setAssignments(page.items);
  }, []);

  function open(courseId: string) {
    setOpenId(courseId);
    setNotice(null);
    setError(null);
    loadAssignments(courseId).catch((e: Error) => setError(e.message));
  }

  async function addCourse(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    try {
      const body = await api.createCourse({
        code,
        title,
        academicYear: year,
        ...(isAdmin && owner ? { faculty: owner } : {}),
      });
      setNotice(`${body.course.code} created.`);
      setCode("");
      setTitle("");
      await loadCourses();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function addAssignment(event: React.FormEvent) {
    event.preventDefault();
    if (!openId) return;
    setError(null);
    setNotice(null);
    try {
      await api.createAssignment(openId, {
        title: aTitle,
        language: aLang,
        provenance: aProv,
        dueAt: withOffset(aDue),
        maxSubmissions: aMax,
        isPublished: true,
      });
      setNotice(`${aTitle} added.`);
      setATitle("");
      setADue("");
      await loadAssignments(openId);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function parseRolls() {
    return rolls
      .split(/[\s,;]+/)
      .map((r) => r.trim())
      .filter(Boolean);
  }

  async function enrol(add: boolean) {
    if (!openId) return;
    const list = parseRolls();
    if (list.length === 0) {
      setError("Give at least one roll number.");
      return;
    }
    setError(null);
    try {
      if (add) {
        const r = await api.enrolStudents(openId, list);
        setNotice(
          `Enrolled ${r.added}. Already there: ${r.alreadyEnrolled}.` +
            (r.notFound.length ? ` No such roll number: ${r.notFound.join(", ")}.` : ""),
        );
      } else {
        const r = await api.removeStudents(openId, list);
        setNotice(
          `Removed ${r.removed}. Not enrolled: ${r.notEnrolled}.` +
            (r.notFound.length ? ` No such roll number: ${r.notFound.join(", ")}.` : ""),
        );
      }
      setRolls("");
      await loadCourses();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const openCourse = courses?.find((c) => c.id === openId) ?? null;

  return (
    <main>
      <div className="page-head">
        <div>
          <h1>Courses</h1>
          <p>
            Create a course, add assignments, and enrol students by roll
            number. A student who is not enrolled in anything has nothing to
            submit to, so this is where the student side begins.
          </p>
        </div>
      </div>

      {error ? <p className="error">{error}</p> : null}
      {notice ? <p className="flag">{notice}</p> : null}

      <section>
        <div className="sect-head">
          <h2>New course</h2>
          <span className="hint">Code like CS-501 · year like 2026-27</span>
        </div>
        <form className="people-form" onSubmit={addCourse}>
          <div>
            <label htmlFor="c-code">Code</label>
            <input id="c-code" value={code} required onChange={(e) => setCode(e.target.value)} />
          </div>
          <div>
            <label htmlFor="c-title">Title</label>
            <input id="c-title" value={title} required onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label htmlFor="c-year">Academic year</label>
            <input id="c-year" value={year} required onChange={(e) => setYear(e.target.value)} />
          </div>
          {isAdmin ? (
            <div>
              <label htmlFor="c-owner">Faculty owner</label>
              <select id="c-owner" value={owner} onChange={(e) => setOwner(e.target.value)}>
                <option value="">choose…</option>
                {faculty.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="people-form-go">
            <button type="submit">Create course</button>
          </div>
        </form>
      </section>

      <section>
        <div className="sect-head">
          <h2>Your courses</h2>
          <span className="hint">{courses?.length ?? 0} in total</span>
        </div>
        {!courses ? (
          <p className="muted">Loading…</p>
        ) : courses.length === 0 ? (
          <p className="muted">No courses yet. Make one above.</p>
        ) : (
          <div className="cards">
            {courses.map((c) => (
              <button
                key={c.id}
                className={`course-card ${openId === c.id ? "on" : ""}`}
                onClick={() => open(c.id)}
              >
                <div className="code">{c.code}</div>
                <div className="name">{c.title}</div>
                <div className="meta">
                  {c.academicYear} · {c.studentCount ?? 0} enrolled
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {openCourse ? (
        <>
          <section>
            <div className="sect-head">
              <h2>Enrol students · {openCourse.code}</h2>
              <span className="hint">Roll numbers, separated by spaces, commas or new lines</span>
            </div>
            <label htmlFor="rolls">Roll numbers</label>
            <input
              id="rolls"
              value={rolls}
              placeholder="BCS2023126 BCS2023071 BCS2023025"
              onChange={(e) => setRolls(e.target.value)}
            />
            <div className="filters">
              <button type="button" onClick={() => void enrol(true)}>
                Enrol
              </button>
              <button type="button" className="chip" onClick={() => void enrol(false)}>
                Remove instead
              </button>
            </div>
          </section>

          <section>
            <div className="sect-head">
              <h2>Assignments · {openCourse.code}</h2>
              <span className="hint">Published immediately, so students can submit</span>
            </div>

            {!assignments ? (
              <p className="muted">Loading…</p>
            ) : assignments.length === 0 ? (
              <p className="muted">No assignments yet.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Language</th>
                    <th>Provenance</th>
                    <th>Due</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((a) => (
                    <tr key={a.id}>
                      <td className="strong">{a.title}</td>
                      <td className="muted">{a.language}</td>
                      <td>
                        <span className={a.provenance === "invigilated" ? "pill clear" : "pill open"}>
                          {a.provenance}
                        </span>
                      </td>
                      <td className="muted">{new Date(a.dueAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <form className="people-form" onSubmit={addAssignment}>
              <div>
                <label htmlFor="a-title">Title</label>
                <input id="a-title" value={aTitle} required onChange={(e) => setATitle(e.target.value)} />
              </div>
              <div>
                <label htmlFor="a-lang">Language</label>
                <select id="a-lang" value={aLang} onChange={(e) => setALang(e.target.value as Language)}>
                  {LANGUAGES.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="a-prov">Provenance</label>
                <select
                  id="a-prov"
                  value={aProv}
                  onChange={(e) => setAProv(e.target.value as "takehome" | "invigilated")}
                >
                  <option value="takehome">takehome</option>
                  <option value="invigilated">invigilated</option>
                </select>
              </div>
              <div>
                <label htmlFor="a-due">Due</label>
                <input
                  id="a-due"
                  type="datetime-local"
                  value={aDue}
                  required
                  onChange={(e) => setADue(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="a-max">Attempts</label>
                <input
                  id="a-max"
                  type="number"
                  min={1}
                  max={20}
                  value={aMax}
                  onChange={(e) => setAMax(Number(e.target.value))}
                />
              </div>
              <div className="people-form-go">
                <button type="submit">Add assignment</button>
              </div>
            </form>
          </section>
        </>
      ) : null}
    </main>
  );
}
