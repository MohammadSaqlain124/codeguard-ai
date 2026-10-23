/**
 * Sign in, and public registration.
 *
 * Two things worth knowing before reading the markup. The planes stop
 * answering the pointer while a field has focus, because a card that keeps
 * leaning moves the input away from the cursor aiming at it. And the
 * characters shut their eyes while a password is being typed, which is a
 * joke that happens to be the only correct behaviour available.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import * as api from "../api/client";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { Avatars } from "../components/Avatars";

const LAYERS = [
  ["01", "Structural", "Compares syntax trees, so renaming variables changes nothing."],
  ["02", "Behavioural", "Measured against how this student usually writes, not the cohort."],
  ["03", "Provenance", "Every score keeps the settings that produced it."],
];

type Mode = "signin" | "signup";

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const stage = useRef<HTMLDivElement | null>(null);

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [rollNo, setRollNo] = useState("");
  const [hidingEyes, setHidingEyes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
      if (!frame) frame = requestAnimationFrame(apply);
    }

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  function settle(on: boolean) {
    stage.current?.classList.toggle("settled", on);
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setPassword("");
  }

  function useAnotherAccount() {
    api.clearTokens();
    setMode("signin");
    setEmail("");
    setPassword("");
    setError(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        await api.register({ email, password, name, rollNo });
      }
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
        <span /><span /><span /><span /><span /><span />
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
          <Avatars closed={hidingEyes} />
        </div>

        <div className="signin-card-wrap">
          <span className="tab">{mode === "signin" ? "Sign in" : "New account"}</span>
          <form className="signin-card" onSubmit={submit}>
            <div className="auth-tabs">
              <button
                type="button"
                aria-pressed={mode === "signin"}
                onClick={() => switchMode("signin")}
              >
                Sign in
              </button>
              <button
                type="button"
                aria-pressed={mode === "signup"}
                onClick={() => switchMode("signup")}
              >
                Create account
              </button>
            </div>

            <h2>{mode === "signin" ? "Welcome back" : "Join your course"}</h2>
            <p className="sub">
              {mode === "signin"
                ? "Use your university account."
                : "Registration creates a student account. Staff accounts are made by an admin."}
            </p>

            {mode === "signup" ? (
              <>
                <label htmlFor="name">Full name</label>
                <input
                  id="name"
                  value={name}
                  autoComplete="name"
                  required
                  onFocus={() => settle(true)}
                  onBlur={() => settle(false)}
                  onChange={(e) => setName(e.target.value)}
                />

                <label htmlFor="rollNo">Roll number</label>
                <input
                  id="rollNo"
                  value={rollNo}
                  placeholder="BCS2023126"
                  required
                  onFocus={() => settle(true)}
                  onBlur={() => settle(false)}
                  onChange={(e) => setRollNo(e.target.value)}
                />
              </>
            ) : null}

            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              autoComplete="username"
              required
              onFocus={() => settle(true)}
              onBlur={() => settle(false)}
              onChange={(e) => setEmail(e.target.value)}
            />

            <label htmlFor="password">
              Password{mode === "signup" ? " · at least 8 characters" : ""}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              onFocus={() => {
                settle(true);
                setHidingEyes(true);
              }}
              onBlur={() => {
                settle(false);
                setHidingEyes(false);
              }}
              onChange={(e) => setPassword(e.target.value)}
            />

            {error ? <p className="error">{error}</p> : null}

            <button type="submit" disabled={busy}>
              {busy
                ? mode === "signin"
                  ? "Signing in…"
                  : "Creating…"
                : mode === "signin"
                  ? "Sign in"
                  : "Create account and sign in"}
            </button>

            {/* Shown, and shown as unavailable. The API has no OAuth route, so
                a working-looking Google button would be a control that lies. */}
            <button className="sso" type="button" disabled title="No OAuth provider is configured on this deployment">
              Continue with Google · not configured
            </button>

            <p className="auth-alt">
              {mode === "signin" ? (
                <>
                  Signed in as somebody else on this machine?{" "}
                  <button className="link" type="button" onClick={useAnotherAccount}>
                    Use a different account
                  </button>
                </>
              ) : (
                <>
                  Already enrolled?{" "}
                  <button className="link" type="button" onClick={() => switchMode("signin")}>
                    Sign in instead
                  </button>
                </>
              )}
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
