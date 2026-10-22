/**
 * A student's upload screen.
 *
 * The server owns validation. This repeats only the two checks that are free
 * here, so an obviously wrong file does not spend one of the attempts the
 * assignment allows. Everything else is shown in the API's own words rather
 * than reworded, because the API's message is the one that is actually true.
 */
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import * as api from "../api/client";
import type { Assignment } from "../api/types";
import { useAuth } from "../auth/AuthProvider";

// both read out of apps/api/src/middleware/upload.ts rather than guessed
const MAX_BYTES = 256 * 1024;
const EXTENSION: Record<Assignment["language"], string> = { python: ".py", java: ".java" };

function when(iso: string | undefined) {
  if (!iso) return "unknown";
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? "unknown" : at.toLocaleString();
}

export function SubmitPage() {
  const { assignmentId } = useParams();
  const { user, signOut } = useAuth();

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ id: string; status: string } | null>(null);

  useEffect(() => {
    if (!assignmentId) return;
    let cancelled = false;
    api
      .getAssignment(assignmentId)
      .then((body) => {
        if (!cancelled) setAssignment(body.assignment);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [assignmentId]);

  const expected = assignment ? EXTENSION[assignment.language] : undefined;
  const wrongType = Boolean(file && expected && !file.name.toLowerCase().endsWith(expected));
  const tooBig = Boolean(file && file.size > MAX_BYTES);
  const late = Boolean(assignment && new Date(assignment.dueAt).getTime() < Date.now());

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!assignmentId || !file || wrongType || tooBig || sending) return;
    setSending(true);
    setError(null);
    try {
      const body = await api.uploadSubmission(assignmentId, file, file.name);
      setSent(body.submission);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <main>
      <header className="bar">
        <h1>Submit work</h1>
        <span className="muted">
          {user?.name} · {user?.role}
        </span>
        <button className="link" onClick={() => void signOut()}>
          Sign out
        </button>
      </header>

      <p>
        <Link to="/">Back to courses</Link>
      </p>

      {error ? <p className="error">{error}</p> : null}
      {!assignment && !error ? <p className="muted">Loading…</p> : null}

      {assignment ? (
        <section>
          <h2>{assignment.title}</h2>
          <ul className="plain muted">
            <li>Language {assignment.language}, so the file must end in {EXTENSION[assignment.language]}</li>
            <li>Due {when(assignment.dueAt)}</li>
            <li>At most {MAX_BYTES / 1024} KB, and 5000 lines</li>
          </ul>
          {late ? (
            <p className="flag">
              The due date has passed. Whether a late upload is accepted is the
              assignment's setting, so this may be refused when you send it.
            </p>
          ) : null}
        </section>
      ) : null}

      {assignment && !sent ? (
        <form onSubmit={submit}>
          <label htmlFor="file">Your source file</label>
          <input
            id="file"
            type="file"
            accept={expected}
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setError(null);
            }}
          />

          {file ? (
            <p className="muted">
              {file.name} · {(file.size / 1024).toFixed(1)} KB
            </p>
          ) : null}

          {wrongType ? (
            <p className="error">This assignment expects a {expected} file.</p>
          ) : null}
          {tooBig ? <p className="error">That file is over {MAX_BYTES / 1024} KB.</p> : null}

          <button type="submit" disabled={!file || wrongType || tooBig || sending}>
            {sending ? "Uploading…" : "Submit"}
          </button>
        </form>
      ) : null}

      {sent ? (
        <section>
          <h2>Uploaded</h2>
          <ul className="plain">
            <li>
              Submission <span className="strong">{sent.id}</span>
            </li>
            <li className="muted">Status {sent.status}</li>
          </ul>
          <p className="muted">
            Analysis runs on a queue, so nothing is scored yet and no result
            appears here. Your faculty sees the outcome; you are told only if
            something is raised with you.
          </p>
        </section>
      ) : null}
    </main>
  );
}
