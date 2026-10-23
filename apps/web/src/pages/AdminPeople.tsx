/**
 * Admin, people.
 *
 * This is the only screen where a role is chosen. Self-registration always
 * makes a student, and sign in reads the role off the account, so without
 * this page there is no way to create a teacher through the app at all.
 *
 * Deactivating somebody and changing their role both require a written
 * reason, because the API requires one: the audit entry is the only place
 * the why survives, and an admin action with no why is the thing a
 * disciplinary appeal cannot answer.
 */
import { useCallback, useEffect, useState } from "react";

import * as api from "../api/client";
import type { Role, User } from "../api/types";

const ROLES: Role[] = ["student", "faculty", "admin"];
const MIN_REASON = 10;

function roleClass(role: Role) {
  return role === "admin" ? "pill look" : role === "faculty" ? "pill open" : "pill clear";
}

export function AdminPeople() {
  const [users, setUsers] = useState<User[] | null>(null);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<Role | "all">("all");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // new account
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("faculty");
  const [rollNo, setRollNo] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const page = await api.listUsers({
      role: filter === "all" ? undefined : filter,
      q: query.trim() || undefined,
    });
    setUsers(page.items);
    setTotal(page.total);
  }, [filter, query]);

  useEffect(() => {
    let cancelled = false;
    load().catch((err: Error) => {
      if (!cancelled) setError(err.message);
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function addUser(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setSaving(true);
    try {
      const body = await api.createUser({
        email,
        password,
        name,
        role,
        // the schema refuses a roll number on anybody who is not a student
        ...(role === "student" ? { rollNo } : {}),
      });
      setNotice(`${body.user.name} created as ${body.user.role}.`);
      setName("");
      setEmail("");
      setPassword("");
      setRollNo("");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function setActive(user: User, next: boolean) {
    const reason = window.prompt(
      `Why are you ${next ? "reactivating" : "deactivating"} ${user.name}? At least ${MIN_REASON} characters, and it goes in the audit log.`,
      "",
    );
    if (reason === null) return;
    if (reason.trim().length < MIN_REASON) {
      setError(`A reason of at least ${MIN_REASON} characters is required.`);
      return;
    }
    setError(null);
    try {
      await api.updateUser(user.id, { isActive: next, reason: reason.trim() });
      setNotice(`${user.name} ${next ? "reactivated" : "deactivated"}.`);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const needsRoll = role === "student";

  return (
    <main>
      <div className="page-head">
        <div>
          <h1>People</h1>
          <p>
            Every account in the institution. This is the only place a role is
            chosen: registration always creates a student, and signing in reads
            the role off the account rather than asking for it.
          </p>
        </div>
      </div>

      {error ? <p className="error">{error}</p> : null}
      {notice ? <p className="flag">{notice}</p> : null}

      <section>
        <div className="sect-head">
          <h2>Add an account</h2>
          <span className="hint">Roll number for students only · password at least 8 characters</span>
        </div>

        <form className="people-form" onSubmit={addUser}>
          <div>
            <label htmlFor="np-name">Full name</label>
            <input id="np-name" value={name} required onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label htmlFor="np-email">Email</label>
            <input
              id="np-email"
              type="email"
              value={email}
              required
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="np-role">Role</label>
            <select id="np-role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="np-roll">Roll number</label>
            <input
              id="np-roll"
              value={rollNo}
              placeholder={needsRoll ? "BCS2023126" : "students only"}
              disabled={!needsRoll}
              required={needsRoll}
              onChange={(e) => setRollNo(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="np-pass">Password</label>
            <input
              id="np-pass"
              type="password"
              value={password}
              autoComplete="new-password"
              required
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="people-form-go">
            <button type="submit" disabled={saving}>
              {saving ? "Creating…" : "Create account"}
            </button>
          </div>
        </form>
      </section>

      <section>
        <div className="sect-head">
          <h2>Accounts</h2>
          <span className="hint">{total} in total</span>
        </div>

        <div className="filters">
          {(["all", ...ROLES] as const).map((r) => (
            <button
              key={r}
              className={`chip ${filter === r ? "on" : ""}`}
              onClick={() => setFilter(r as Role | "all")}
            >
              {r}
            </button>
          ))}
          <input
            className="people-search"
            value={query}
            placeholder="name, email or roll number"
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {!users ? (
          <p className="muted">Loading…</p>
        ) : users.length === 0 ? (
          <p className="muted">Nobody matches that.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Roll</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="strong">{u.name}</td>
                  <td className="muted">{u.email}</td>
                  <td>
                    <span className={roleClass(u.role)}>{u.role}</span>
                  </td>
                  <td className="muted">{u.rollNo ?? "—"}</td>
                  <td>
                    {u.isActive ? (
                      <span className="muted">active</span>
                    ) : (
                      <span className="flag">deactivated</span>
                    )}
                  </td>
                  <td>
                    <button className="link" onClick={() => void setActive(u, !u.isActive)}>
                      {u.isActive ? "Deactivate" : "Reactivate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
