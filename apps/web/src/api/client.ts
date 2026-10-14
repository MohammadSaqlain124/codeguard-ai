/**
 * The one place this app talks to the API.
 *
 * Every screen goes through `request`, for the same reason the demo script has
 * a single `call`: a failure is then reported the same way everywhere, and the
 * access token is attached in one place instead of forty.
 *
 * The part worth understanding is the refresh handling. The API rotates
 * refresh tokens: POST /api/auth/refresh revokes the token it was given and
 * returns a new pair, and authController logs a revoked token being presented
 * as a possible theft. So two requests that both expire at once must not each
 * try to refresh, because the second would send a token the first has already
 * spent. `refreshOnce` makes every caller wait on the same promise.
 */
import type { Assignment, Course, Paged, ResultDetail, ResultRow, ReviewStatus, User } from "./types";

const BASE = import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:4000";

export type Tokens = { accessToken: string; refreshToken: string };

const ACCESS_KEY = "codeguard.accessToken";
const REFRESH_KEY = "codeguard.refreshToken";

/**
 * Tokens are kept in localStorage, which is readable by any script that gets
 * onto the page. The safer arrangement is an httpOnly cookie, but this API
 * takes the refresh token in a request body rather than a cookie, so a cookie
 * is not available without changing the backend. That is a real limitation and
 * belongs in the report rather than being quietly ignored.
 */
export function loadTokens(): Tokens | null {
  try {
    const accessToken = localStorage.getItem(ACCESS_KEY);
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (!accessToken || !refreshToken) return null;
    return { accessToken, refreshToken };
  } catch {
    // a private window can refuse storage outright, which is not an error here
    return null;
  }
}

export function saveTokens(tokens: Tokens) {
  try {
    localStorage.setItem(ACCESS_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  } catch {
    // nothing to do: the session will simply not survive a reload
  }
}

export function clearTokens() {
  try {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  } catch {
    // already gone as far as this app is concerned
  }
}

/** Carries what the API said, so a screen can show it instead of "failed". */
export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

type Options = {
  /** sent as JSON */
  json?: unknown;
  /** sent as multipart, which is what the upload endpoint expects */
  file?: { source: string | Blob; name: string };
  /** set for the auth calls, which must not try to refresh on a 401 */
  noRefresh?: boolean;
};

/**
 * Builds the request fresh every time it is called, body included.
 *
 * That matters for the retry below: a FormData or a stream handed to fetch is
 * consumed, so re-sending the same object after a refresh is a bug waiting to
 * happen. Rebuilding from `options` means the retry is a genuinely new request.
 */
async function send(method: string, path: string, options: Options, token: string | null) {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  let body: FormData | string | undefined;
  if (options.file) {
    const form = new FormData();
    const blob =
      typeof options.file.source === "string"
        ? new Blob([options.file.source])
        : options.file.source;
    form.append("file", blob, options.file.name);
    body = form;
    // deliberately no content-type: the browser adds the multipart boundary
  } else if (options.json !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(options.json);
  }

  return fetch(`${BASE}${path}`, { method, headers, body });
}

let refreshing: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  const tokens = loadTokens();
  if (!tokens) return null;

  const res = await send("POST", "/api/auth/refresh", {
    json: { refreshToken: tokens.refreshToken },
    noRefresh: true,
  }, null);

  if (!res.ok) {
    // the refresh token is spent, revoked or expired. There is no way back
    // from here except signing in again.
    clearTokens();
    return null;
  }

  const fresh = (await res.json()) as Tokens;
  saveTokens(fresh);
  return fresh.accessToken;
}

/** Every caller shares one refresh, because the API rotates the token. */
function refreshOnce(): Promise<string | null> {
  if (!refreshing) {
    refreshing = doRefresh().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

export async function request<T>(method: string, path: string, options: Options = {}): Promise<T> {
  let res = await send(method, path, options, loadTokens()?.accessToken ?? null);

  if (res.status === 401 && !options.noRefresh) {
    const fresh = await refreshOnce();
    if (fresh) res = await send(method, path, options, fresh);
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let parsed: unknown = undefined;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { message: text.slice(0, 200) };
    }
  }

  if (!res.ok) {
    const shape = parsed as { message?: string; code?: string } | undefined;
    throw new ApiError(
      res.status,
      shape?.message ?? `${method} ${path} failed with ${res.status}`,
      shape?.code,
    );
  }

  return parsed as T;
}

/* ------------------------------------------------------------------- auth */

export async function login(email: string, password: string) {
  const body = await request<{ user: User } & Tokens>("POST", "/api/auth/login", {
    json: { email, password },
    noRefresh: true,
  });
  saveTokens({ accessToken: body.accessToken, refreshToken: body.refreshToken });
  return body.user;
}

export async function logout() {
  const tokens = loadTokens();
  clearTokens();
  if (!tokens) return;
  try {
    await request<void>("POST", "/api/auth/logout", {
      json: { refreshToken: tokens.refreshToken },
      noRefresh: true,
    });
  } catch {
    // the local tokens are already gone, so the user is signed out either way
  }
}

export async function me() {
  const body = await request<{ user: User }>("GET", "/api/auth/me");
  return body.user;
}

/* ---------------------------------------------------------------- reading */

export async function listCourses() {
  return request<Paged<Course>>("GET", "/api/courses");
}

export async function listAssignments(courseId: string) {
  return request<Paged<Assignment>>("GET", `/api/courses/${courseId}/assignments`);
}

export async function getAssignment(assignmentId: string) {
  return request<{ assignment: Assignment }>("GET", `/api/assignments/${assignmentId}`);
}

export async function listResults(assignmentId: string, reviewStatus?: ReviewStatus) {
  const query = reviewStatus ? `?reviewStatus=${reviewStatus}` : "";
  return request<Paged<ResultRow>>("GET", `/api/assignments/${assignmentId}/results${query}`);
}

export async function getResult(submissionId: string) {
  return request<{ result: ResultDetail; revisions: number[] }>(
    "GET",
    `/api/submissions/${submissionId}/result`,
  );
}

/* ---------------------------------------------------------------- writing */

export async function reviewResult(submissionId: string, status: ReviewStatus, note: string) {
  return request<{ result: ResultDetail; audited: boolean }>(
    "PATCH",
    `/api/submissions/${submissionId}/review`,
    { json: { status, note } },
  );
}

export async function uploadSubmission(assignmentId: string, source: string | Blob, name: string) {
  return request<{ submission: { id: string; status: string } }>(
    "POST",
    `/api/assignments/${assignmentId}/submissions`,
    { file: { source, name } },
  );
}
