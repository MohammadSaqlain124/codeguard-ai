/**
 * The frame every signed in screen sits in: a brand bar, a sidebar that knows
 * which role is looking at it, and the page itself.
 *
 * The nav only ever lists routes that exist. A sidebar with four convincing
 * items and two working ones is worse than a short honest one, because the
 * first thing anybody does with a new interface is click everything.
 */
import { NavLink, Outlet } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";

type Item = { to: string; label: string; end?: boolean };

const FACULTY: Item[] = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/courses", label: "Courses" },
];

const ADMIN: Item[] = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/courses", label: "Courses" },
  { to: "/people", label: "People" },
];

const STUDENT: Item[] = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/courses", label: "My courses" },
];

function initials(name: string | undefined) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export function AppShell() {
  const { user, signOut } = useAuth();
  const items =
    user?.role === "student" ? STUDENT : user?.role === "admin" ? ADMIN : FACULTY;

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <span className="mark">CG</span> CodeGuard AI
        </div>
        <div className="spacer" />
        <div className="whoami">
          <span className="avatar">{initials(user?.name)}</span>
          {user?.name}
        </div>
        <button className="link" onClick={() => void signOut()}>
          Sign out
        </button>
      </header>

      <div className="shell">
        <aside className="side">
          <div className="who">
            <div className="role">{user?.role ?? "signed out"}</div>
            <div className="name">{user?.name}</div>
          </div>

          <nav>
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => (isActive ? "on" : "")}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="foot">
            CodeGuard ranks submissions by how much they warrant a human look,
            and shows the reasoning. It never decides that somebody cheated.
          </div>
        </aside>

        <div className="content">
          <Outlet />
        </div>
      </div>
    </>
  );
}
