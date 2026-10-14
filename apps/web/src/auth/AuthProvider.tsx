/**
 * Who is signed in, for the whole app.
 *
 * The tokens themselves live in api/client.ts, because the fetch wrapper needs
 * them from outside any component. This holds only the *user*, which is what
 * screens actually render and route on.
 *
 * On first load it asks GET /api/auth/me rather than trusting whatever is in
 * localStorage. A stored token can be expired, revoked, or belong to an account
 * that has since been deactivated, and the only authority on that is the API.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import * as api from "../api/client";
import type { User } from "../api/types";

type AuthState = {
  user: User | null;
  /** true until the first /me call settles, so routes do not redirect too early */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // `cancelled` guards against setting state after this effect is torn down,
    // which React's development mode makes happen by mounting twice
    let cancelled = false;

    async function restore() {
      if (!api.loadTokens()) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        const current = await api.me();
        if (!cancelled) setUser(current);
      } catch {
        api.clearTokens();
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setUser(await api.login(email, password));
  }, []);

  const signOut = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  // memoised so every consumer does not re-render whenever this component does
  const value = useMemo(() => ({ user, loading, signIn, signOut }), [user, loading, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  // a clear error beats "cannot read property user of null" three files away
  if (!value) throw new Error("useAuth was called outside AuthProvider");
  return value;
}
