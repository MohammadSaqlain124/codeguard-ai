/**
 * The block that only exists on paper.
 *
 * On screen this page has a URL, a sidebar and a signed-in user, so a
 * reviewer always knows what they are looking at. A sheet of paper has none
 * of that. Printed evidence can end up attached to a disciplinary record and
 * read months later by somebody who never saw the screen, so the page has to
 * carry its own identity: whose work, which submission, which revision, which
 * detector and config produced the number, and what the threshold was at the
 * time.
 *
 * The printed-at time is written by hand in a beforeprint handler rather than
 * rendered with the component. Rendering it would stamp the paper with the
 * moment the page was opened, which can be hours earlier, and a timestamp
 * that is quietly wrong is worse than none at all.
 */
import { useEffect, useRef } from "react";

import type { ResultDetail } from "../api/types";

function stamp(at: Date) {
  // local time with the offset spelled out, because a case file read in
  // another office should not have to guess the timezone
  const pad = (n: number) => String(n).padStart(2, "0");
  const mins = -at.getTimezoneOffset();
  const sign = mins >= 0 ? "+" : "-";
  const offset = `${sign}${pad(Math.floor(Math.abs(mins) / 60))}:${pad(Math.abs(mins) % 60)}`;
  return (
    `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())} ` +
    `${pad(at.getHours())}:${pad(at.getMinutes())} UTC${offset}`
  );
}

export function PrintHeader({
  result,
  studentName,
}: {
  result: ResultDetail;
  studentName: string;
}) {
  const slot = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    function mark() {
      // a direct DOM write, because a React state update is not guaranteed to
      // have flushed by the time the browser lays the page out for printing
      if (slot.current) slot.current.textContent = stamp(new Date());
    }
    window.addEventListener("beforeprint", mark);
    return () => window.removeEventListener("beforeprint", mark);
  }, []);

  const roll =
    typeof result.student === "object" ? result.student?.rollNo : undefined;

  return (
    <div className="printhead" aria-hidden="true">
      <div className="printhead-top">
        <span className="printhead-mark">CodeGuard AI</span>
        <span className="printhead-when">
          Printed <span ref={slot}>at print time</span>
        </span>
      </div>

      <h1 className="printhead-who">
        {studentName}
        {roll ? <span className="printhead-roll"> · {roll}</span> : null}
      </h1>

      <dl className="printhead-facts">
        <div>
          <dt>Submission</dt>
          <dd>{result.submission}</dd>
        </div>
        <div>
          <dt>Revision</dt>
          <dd>{result.revision}</dd>
        </div>
        <div>
          <dt>Language</dt>
          <dd>{result.language}</dd>
        </div>
        <div>
          <dt>Computed</dt>
          <dd>{result.computedAt}</dd>
        </div>
        <div>
          <dt>Detector</dt>
          <dd>{result.detectorVersion}</dd>
        </div>
        <div>
          <dt>Config</dt>
          {/* 0 means no saved row existed and the built-in defaults applied.
              On paper that distinction cannot be looked up later, so it is
              spelled out rather than printed as a bare zero. */}
          <dd>{result.configVersion === 0 ? "0 (defaults)" : result.configVersion}</dd>
        </div>
        <div>
          <dt>Threshold then</dt>
          <dd>
            {typeof result.reviewThreshold === "number"
              ? result.reviewThreshold.toFixed(2)
              : "not recorded"}
          </dd>
        </div>
      </dl>

      <p className="printhead-warn">
        This is a ranking produced by software, not a finding that anybody
        copied. It exists to tell a human where to look. Nothing on this sheet
        decides anything on its own, and the limits listed under "Read this
        before the number" apply to every figure printed here.
      </p>
    </div>
  );
}
