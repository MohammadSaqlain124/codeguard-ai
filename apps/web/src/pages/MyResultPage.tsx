/**
 * What a student is allowed to see about their own submission.
 *
 * The endpoint behind this page returns no score, and that is the whole point
 * of the screen. A student who can read their own RPS will tune their next
 * submission against it, and a ranking you can tune against stops measuring
 * what it claims to measure. So this page answers two questions only: did the
 * upload go through, and has anything been raised with me.
 *
 * The second half of the page is the part that matters for fairness. If a
 * decision has been recorded, the student can answer it in their own words,
 * and that answer travels to the reviewer who recorded the decision.
 */
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import * as api from "../api/client";
import type { StudentView } from "../api/types";

function when(iso: string | undefined) {
  if (!iso) return "unknown";
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? "unknown" : at.toLocaleString();
}

/**
 * The review statuses are written for staff. A student reading "dismissed"
 * has no way to know whether that is good or bad news, so each one is given a
 * plain sentence here.
 */
function reading(status: string) {
  switch (status) {
    case "confirmed_clean":
      return "A teacher looked at this and found nothing wrong with it.";
    case "dismissed":
      return "A teacher looked at this and closed it. Nothing follows from it.";
    case "escalated":
      return "A teacher has taken this further. Your department will contact you about it.";
    case "contested":
      return "You have answered this, and it is being looked at again.";
    default:
      return "A teacher has recorded a decision on this submission.";
  }
}

export function MyResultPage() {
  const { submissionId } = useParams<{ submissionId: string }>();

  const [view, setView] = useState<StudentView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  // bumping this re-runs the load, which is how the page refreshes itself
  // after an explanation is accepted
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!submissionId) return;
    let cancelled = false;
    setError(null);
    api
      .getMyResult(submissionId)
      .then((got) => {
        if (cancelled) return;
        setView(got);
        // show what was said before, so writing again is editing rather than
        // starting from an empty box with no idea what is already on record
        setDraft(got.review?.studentExplanation ?? "");
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [submissionId, reload]);

  async function send() {
    if (!submissionId) return;
    setSending(true);
    setSent(null);
    setError(null);
    try {
      await api.explainResult(submissionId, draft.trim());
      setSent("Your answer has been recorded and the teacher can see it.");
      setReload((n) => n + 1);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  if (error && !view) {
    return (
      <main>
        <h1>Your submission</h1>
        <p className="error">{error}</p>
        <p className="muted">
          <Link to="/">Back to your dashboard</Link>
        </p>
      </main>
    );
  }

  if (!view) {
    return (
      <main>
        <h1>Your submission</h1>
        <p className="muted">Loading…</p>
      </main>
    );
  }

  const review = view.review;
  const tooShort = draft.trim().length < 10;

  return (
    <main>
      <div className="page-head">
        <div>
          <h1>Your submission</h1>
          <p>
            Whether your upload went through, and whether anything has been
            raised with you about it.
          </p>
        </div>
      </div>

      <div className="cards">
        <div className="stat">
          <div className="lbl">Upload</div>
          <div className="big">{view.submission.status}</div>
          <div className="sub">as recorded when you submitted</div>
        </div>
        <div className={review ? "stat warn" : "stat good"}>
          <div className="lbl">Raised with you</div>
          <div className="big">{review ? "yes" : "no"}</div>
          <div className="sub">
            {review ? "a decision is on record" : "nothing on record"}
          </div>
        </div>
      </div>

      <section>
        <h2 className="sect-head">Where this stands</h2>

        {!review ? (
          <div className="outcome">
            <p className="strong">Nothing has been raised with you.</p>
            <p className="muted">
              Your work has been checked. Either nothing was flagged, or a
              teacher has not finished looking at it. If anything is raised, it
              will appear on this page and you will be able to answer it here.
            </p>
          </div>
        ) : (
          <div className="outcome flagged">
            <p>
              <span className="pill look">{review.status}</span>
            </p>
            <p className="strong">{reading(review.status)}</p>
            {review.note ? (
              <blockquote className="note">{review.note}</blockquote>
            ) : (
              <p className="muted">No note was left with the decision.</p>
            )}
            <p className="meta muted">Recorded {when(review.reviewedAt)}</p>
          </div>
        )}
      </section>

      {/* No score anywhere on this page, by design. Saying so is better than
          leaving a student to wonder whether it is missing or hidden. */}
      <section>
        <h2 className="sect-head">Why there is no score here</h2>
        <p className="muted">
          The system gives your teacher a ranking, not a verdict, and that
          ranking is deliberately not shown to you. A student who can see their
          own number can write their next submission to lower it, which would
          make the number useless for everyone. A person decides anything that
          follows, and you are told when they do.
        </p>
      </section>

      {review ? (
        <section>
          <h2 className="sect-head">
            {review.studentExplanation ? "Your answer" : "Answer this"}
          </h2>

          {review.studentExplanation ? (
            <p className="muted">
              You answered on {when(review.explainedAt)}. Writing again replaces
              what you said.
            </p>
          ) : (
            <p className="muted">
              Explain this in your own words. Your teacher sees exactly what you
              write here, next to their own decision.
            </p>
          )}

          <div className="answer-form">
            <label>
              <span>Your explanation</span>
              <textarea
                rows={6}
                value={draft}
                maxLength={2000}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="What happened, in your own words."
              />
              <span className="hint">
                {draft.trim().length} of 2000 characters, at least 10 needed
              </span>
            </label>

            <div className="answer-form-go">
              <button disabled={sending || tooShort} onClick={send}>
                {sending ? "Sending…" : review.studentExplanation ? "Replace" : "Send"}
              </button>
            </div>
          </div>

          {sent ? <p className="flag">{sent}</p> : null}
          {error ? <p className="error">{error}</p> : null}
        </section>
      ) : null}

      <p className="muted">
        <Link to="/">Back to your dashboard</Link>
      </p>
    </main>
  );
}
