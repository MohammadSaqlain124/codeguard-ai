/**
 * Courses, and the assignments inside the one that is open.
 *
 * This exists so there is a path to the review queue, which is per assignment.
 * It is deliberately plain: it is the screen to copy from when you build the
 * rest, not the screen to be impressed by.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import * as api from "../api/client";
import type { Assignment, Course } from "../api/types";
import { useAuth } from "../auth/AuthProvider";

export function CoursesPage() {
  const { user, signOut } = useAuth();
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [openCourse, setOpenCourse] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Assignment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .listCourses()
      .then((page) => {
        if (!cancelled) setCourses(page.items);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!openCourse) return;
    let cancelled = false;
    setAssignments(null);
    api
      .listAssignments(openCourse)
      .then((page) => {
        if (!cancelled) setAssignments(page.items);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [openCourse]);

  return (
    <main>
      <header className="bar">
        <h1>Courses</h1>
        <span className="muted">
          {user?.name} · {user?.role}
        </span>
        <button className="link" onClick={() => void signOut()}>
          Sign out
        </button>
      </header>

      {error ? <p className="error">{error}</p> : null}
      {!courses && !error ? <p className="muted">Loading…</p> : null}
      {courses?.length === 0 ? <p className="muted">No courses yet.</p> : null}

      <ul className="plain">
        {courses?.map((course) => (
          <li key={course.id}>
            <button className="link" onClick={() => setOpenCourse(course.id)}>
              {course.code} — {course.title}
            </button>

            {openCourse === course.id ? (
              <ul className="plain indent">
                {!assignments ? <li className="muted">Loading assignments…</li> : null}
                {assignments?.map((a) => (
                  <li key={a.id}>
                    {/* A student reaching the queue is refused by RequireRole,
                        so every assignment on this page used to be a dead end
                        for them. Send each role where it is allowed to go. */}
                    <Link
                      to={
                        user?.role === "student"
                          ? `/assignments/${a.id}/submit`
                          : `/assignments/${a.id}/queue`
                      }
                    >
                      {a.title}
                    </Link>
                    <span className="muted">
                      {" "}
                      {a.language} · {a.provenance}
                      {a.isPublished ? "" : " · draft"}
                    </span>
                  </li>
                ))}
                {assignments?.length === 0 ? <li className="muted">No assignments.</li> : null}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </main>
  );
}
