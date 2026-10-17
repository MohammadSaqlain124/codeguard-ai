/**
 * Routes.
 *
 * Declarative routing rather than createBrowserRouter, because this shape is
 * the one most React material explains and there is nothing here that needs
 * data loaders.
 */
import { Navigate, Route, Routes } from "react-router-dom";

import { RequireRole } from "./auth/RequireRole";
import { CoursesPage } from "./pages/CoursesPage";
import { EvidencePage } from "./pages/EvidencePage";
import { LoginPage } from "./pages/LoginPage";
import { QueuePage } from "./pages/QueuePage";

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
            <EvidencePage />
          </RequireRole>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
