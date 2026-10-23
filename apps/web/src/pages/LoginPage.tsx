/**
 * Sign in.
 *
 * The only screen in the app with no data to lay out, which makes it the one
 * place a piece of editorial design belongs: a statement of what the system
 * is for, the three layers named, and the form itself as one object on a
 * plane in front of the rest.
 *
 * The depth is real rather than drawn. The card, the ring diagram and the
 * colour mass each sit at a different distance and answer the pointer by a
 * different amount, which is what makes the scene read as space instead of
 * as a picture of space.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthProvider";

const LAYERS = [
  ["01", "Structural", "Compares syntax trees, so renaming variables changes nothing."],
  ["02", "Behavioural", "Measured against how this student usually writes, not the cohort."],
  ["03", "Provenance", "Every score keeps the settings that produced it."],
];

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const stage = useRef<HTMLDivElement | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Pointer drives three custom properties; the stylesheet decides what each
  // plane does with them. Keeping the maths here and the depth there means a
  // layer can be re-tuned without touching this file.
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let x = 0;
    let y = 0;
    let frame = 0;

    function apply() {
      el!.style.setProperty("--px", x.toFixed(3));
      el!.style.setProperty("--py", y.toFixed(3));
      frame = 0;
    }

    function onMove(event: PointerEvent) {
      x = (event.clientX / window.innerWidth) * 2 - 1;
      y = (event.clientY / window.innerHeight) * 2 - 1;
      // one write per frame rather than one per event
      if (!frame) frame = requestAnimationFrame(apply);
    }

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      // The API answers a wrong password and an unknown email identically, on
      // purpose, so there is nothing more specific that could honestly be said.
      setError(err instanceof ApiError ? err.message : "Could not reach the API");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="signin" ref={stage}>
      <div className="duo" aria-hidden="true" />
      <div className="massfade" aria-hidden="true" />

      <svg className="geo" viewBox="0 0 600 600" aria-hidden="true">
        <defs>
          <linearGradient id="cg-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--marigold-2)" />
            <stop offset="100%" stopColor="var(--aubergine)" />
          </linearGradient>
        </defs>
        <g className="geo-spin">
          <circle cx="300" cy="286" r="232" fill="none" stroke="url(#cg-ring)" strokeWidth="1.1" opacity="0.75" />
          <circle cx="300" cy="286" r="176" fill="none" stroke="var(--aubergine)" strokeWidth="0.9" opacity="0.32" />
          <circle cx="300" cy="286" r="118" fill="none" stroke="var(--marigold)" strokeWidth="1" opacity="0.55" />
          <circle cx="300" cy="286" r="58" fill="none" stroke="var(--aubergine)" strokeWidth="0.9" opacity="0.3" />
        </g>
        <path d="M68 286 H532" stroke="var(--aubergine)" strokeWidth="0.8" opacity="0.22" />
        <path d="M300 54 V518" stroke="var(--aubergine)" strokeWidth="0.8" opacity="0.22" />
      </svg>

      <div className="colrules" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>

      <header className="signin-top">
        <div className="brand">
          <span className="mark">CG</span> CodeGuard AI
        </div>
        <span className="spacer" />
        <span className="kicker">Invertis University</span>
      </header>

      <div className="signin-grid">
        <div className="pitch">
          <div className="kicker">A calmer kind of proof</div>
          <h1 className="display">
            Evidence,
            <br />
            <span className="thin">not</span> <span className="gold">verdicts.</span>
          </h1>
          <p className="lede">
            CodeGuard ranks submissions by how much they warrant a human look,
            and shows every step of the reasoning. It never decides that
            somebody cheated.
          </p>
        </div>

        {/* The tab lives on the wrapper, not the card. backdrop-filter makes
            the card a containing block, which clips any child positioned
            outside its box, and that is what ate this label twice. */}
        <div className="signin-card-wrap">
          <span className="tab">Sign in</span>
          <form className="signin-card" onSubmit={submit}>
          <h2>Welcome back</h2>
          <p className="sub">Use your university account.</p>

          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            autoComplete="username"
            required
            onChange={(e) => setEmail(e.target.value)}
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            autoComplete="current-password"
            required
            onChange={(e) => setPassword(e.target.value)}
          />

          {error ? <p className="error">{error}</p> : null}

          <button type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>

          <p className="note">
            Faculty see the review queue. Students see their own submissions and
            nothing else.
          </p>
          </form>
        </div>
      </div>

      <div className="layer-index">
        {LAYERS.map(([n, title, line]) => (
          <div key={n}>
            <div className="hd">
              <span className="n">{n}</span>
              <span className="t">{title}</span>
            </div>
            <div className="d">{line}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
