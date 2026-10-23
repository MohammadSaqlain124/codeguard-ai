/**
 * The two characters on the sign in page.
 *
 * Honest about what this is: SVG, not 3D. A real 3D avatar needs a rigged
 * model and a WebGL runtime, which is a dependency and an asset pipeline
 * this project does not have. What it does have is eyes that follow you,
 * blinking, and the one piece of manners that matters here, which is
 * looking away while somebody types a password.
 */
import { useEffect, useRef, useState } from "react";

type Props = {
  /** eyes shut, used while a password field has focus */
  closed?: boolean;
};

export function Avatars({ closed = false }: Props) {
  const wrap = useRef<HTMLDivElement | null>(null);
  const [look, setLook] = useState({ x: 0, y: 0 });
  const [blink, setBlink] = useState(false);

  // pupils follow the pointer, measured from each avatar's own centre so the
  // two of them do not stare in parallel like a pair of headlights
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    let next = { x: 0, y: 0 };

    function apply() {
      setLook(next);
      frame = 0;
    }

    function onMove(event: PointerEvent) {
      const box = wrap.current?.getBoundingClientRect();
      if (!box) return;
      const dx = (event.clientX - (box.left + box.width / 2)) / window.innerWidth;
      const dy = (event.clientY - (box.top + box.height / 2)) / window.innerHeight;
      next = {
        x: Math.max(-1, Math.min(1, dx * 2.4)),
        y: Math.max(-1, Math.min(1, dy * 2.4)),
      };
      if (!frame) frame = requestAnimationFrame(apply);
    }

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  // an irregular blink, because a blink on a fixed interval reads as a glitch
  useEffect(() => {
    let timer = 0;
    function schedule() {
      timer = window.setTimeout(() => {
        setBlink(true);
        window.setTimeout(() => setBlink(false), 120);
        schedule();
      }, 2200 + Math.random() * 3800);
    }
    schedule();
    return () => window.clearTimeout(timer);
  }, []);

  const shut = closed || blink;

  return (
    <div className="avatars" ref={wrap} aria-hidden="true">
      <Figure kind="student" look={look} shut={shut} />
      <Figure kind="teacher" look={look} shut={shut} />
      <p className="avatars-note">
        {closed ? "Not looking." : "Two roles, one record of who decided what."}
      </p>
    </div>
  );
}

function Figure({
  kind,
  look,
  shut,
}: {
  kind: "student" | "teacher";
  look: { x: number; y: number };
  shut: boolean;
}) {
  const px = look.x * 3.6;
  const py = look.y * 2.8;
  const tilt = look.x * 2.4;
  const teacher = kind === "teacher";

  return (
    <svg
      className={`figure ${kind}`}
      viewBox="0 0 200 230"
      style={{ transform: `rotate(${tilt.toFixed(2)}deg)` }}
    >
      <ellipse cx="100" cy="214" rx="56" ry="8" fill="#3d1f42" opacity="0.1" />
      <path
        d="M46 214c0-32 24-52 54-52s54 20 54 52z"
        fill={teacher ? "var(--aubergine)" : "var(--aubergine-2)"}
      />
      <path d="M86 166h28v16a14 14 0 0 1-28 0z" fill="#e6c3a9" />

      {teacher ? (
        <>
          <path d="M86 166l14 18 14-18 12 6-26 26-26-26z" fill="var(--ice)" opacity="0.95" />
          <path d="M100 184l-9 30h18z" fill="var(--marigold)" />
        </>
      ) : (
        <>
          <path d="M86 166l14 16 14-16 10 5-24 24-24-24z" fill="#fff" opacity="0.92" />
          <path d="M94 186v18M106 186v18" stroke="var(--marigold)" strokeWidth="3" strokeLinecap="round" />
        </>
      )}

      <ellipse cx="100" cy="112" rx="45" ry="49" fill="#f3d9c6" />
      <ellipse cx="55" cy="116" rx="7" ry="10" fill="#e6c3a9" />
      <ellipse cx="145" cy="116" rx="7" ry="10" fill="#e6c3a9" />

      {teacher ? (
        <>
          <circle cx="100" cy="50" r="17" fill="var(--aubergine-3)" />
          <path
            d="M55 106c-3-32 20-54 45-54s48 22 45 54c-3-18-9-26-15-29-12 8-48 8-60 0-6 3-12 11-15 29z"
            fill="var(--aubergine-3)"
          />
        </>
      ) : (
        <path
          d="M54 104c-4-34 20-56 46-56s50 22 46 56c-2-16-10-24-18-27-10 10-44 14-58 2-8 5-14 14-16 25z"
          fill="var(--aubergine)"
        />
      )}

      {shut ? (
        <g stroke="var(--ink)" strokeWidth="3.2" fill="none" strokeLinecap="round">
          <path d="M72 115q10 7 20 0" />
          <path d="M108 115q10 7 20 0" />
        </g>
      ) : (
        <g>
          <ellipse cx="82" cy="114" rx="11" ry="12.5" fill="#fff" />
          <ellipse cx="118" cy="114" rx="11" ry="12.5" fill="#fff" />
          <g transform={`translate(${px.toFixed(2)} ${py.toFixed(2)})`}>
            <circle cx="82" cy="115" r="6" fill="var(--ink)" />
            <circle cx="84.5" cy="112" r="2.1" fill="#fff" />
            <circle cx="118" cy="115" r="6" fill="var(--ink)" />
            <circle cx="120.5" cy="112" r="2.1" fill="#fff" />
          </g>
        </g>
      )}

      {teacher ? (
        <g fill="none" stroke="var(--aubergine)" strokeWidth="2.8">
          <circle cx="82" cy="114" r="15" />
          <circle cx="118" cy="114" r="15" />
          <path d="M97 114h6M67 110l-10-3M133 110l10-3" />
        </g>
      ) : null}

      <path
        d="M72 99q10-5 20 0M108 99q10-5 20 0"
        stroke={teacher ? "var(--aubergine)" : "var(--aubergine)"}
        strokeWidth="3.4"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d={shut ? "M92 140q8 4 16 0" : "M92 138q8 7 16 0"}
        stroke="var(--ink)"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />

      {!teacher ? (
        <>
          <ellipse cx="68" cy="128" rx="7" ry="4" fill="var(--marigold)" opacity="0.25" />
          <ellipse cx="132" cy="128" rx="7" ry="4" fill="var(--marigold)" opacity="0.25" />
        </>
      ) : null}
    </svg>
  );
}
