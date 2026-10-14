/**
 * Routes.
 *
 * Declarative routing rather than createBrowserRouter, because this shape is
 * the one most React material explains and there is nothing here that needs
 * data loaders.
 *
 * The evidence route is deliberately left unbuilt. It is the next feature, and
 * QueuePage already links to it, so the link will start working the moment the
 * component exists.
 */
import { Navigate, Route, Routes } from "react-router-dom";

import { RequireRole } from "./auth/RequireRole";
import { CoursesPage } from "./pages/CoursesPage";
import { LoginPage } from "./pages/LoginPage";
import { QueuePage } from "./pages/QueuePage";

function NotBuiltYet({ what }: { what: string }) {
  return (
    <main className="narrow">
      <h1>{what}</h1>
      <p className="muted">Not built yet. This is the next thing to write.</p>
      <p>
        <a href="/">Back to courses</a>
      </p>
    </main>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/"
        element={
          <RequireRole roles={["student", "faculty", "admin"]}>
            <CoursesPage />
          </RequireRole>
        }
      />

      <Route
        path="/assignments/:assignmentId/queue"
        element={
          <RequireRole roles={["faculty", "admin"]}>
            <QueuePage />
          </RequireRole>
        }
      />

      <Route
        path="/submissions/:submissionId/evidence"
        element={
          <RequireRole roles={["faculty", "admin"]}>
            <NotBuiltYet what="Evidence" />
          </RequireRole>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
