/**
 * Routes.
 *
 * Declarative routing rather than createBrowserRouter, because this shape is
 * the one most React material explains and there is nothing here that needs
 * data loaders.
 *
 * Everything except sign in renders inside AppShell, which is a layout route:
 * the frame mounts once and the page changes underneath it, so the sidebar
 * and the background do not rebuild on every navigation.
 */
import { Navigate, Route, Routes } from "react-router-dom";

import { useAuth } from "./auth/AuthProvider";
import { RequireRole } from "./auth/RequireRole";
import { AppShell } from "./components/AppShell";
import { SpatialBackground } from "./components/SpatialBackground";
import { AdminPeople } from "./pages/AdminPeople";
import { CoursesPage } from "./pages/CoursesPage";
import { ManagePage } from "./pages/ManagePage";
import { EvidencePage } from "./pages/EvidencePage";
import { FacultyHome } from "./pages/FacultyHome";
import { LoginPage } from "./pages/LoginPage";
import { QueuePage } from "./pages/QueuePage";
import { StudentHome } from "./pages/StudentHome";
import { SubmitPage } from "./pages/SubmitPage";

/**
 * Two dashboards behind one route. Which one you get is decided by the role
 * on your token rather than by a link, so there is no address a student can
 * type to reach the faculty view.
 */
function Home() {
  const { user } = useAuth();
  return user?.role === "student" ? <StudentHome /> : <FacultyHome />;
}

export function App() {
  return (
    <>
      {/* mounted here rather than per page, so it survives navigation and the
          field does not restart every time a route changes */}
      <SpatialBackground />

      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          element={
            <RequireRole roles={["student", "faculty", "admin"]}>
              <AppShell />
            </RequireRole>
          }
        >
          <Route path="/" element={<Home />} />
          <Route path="/courses" element={<CoursesPage />} />

          {/* staff only: creating courses and enrolling students */}
          <Route
            path="/manage"
            element={
              <RequireRole roles={["faculty", "admin"]}>
                <ManagePage />
              </RequireRole>
            }
          />

          {/* the only screen where a role is chosen */}
          <Route
            path="/people"
            element={
              <RequireRole roles={["admin"]}>
                <AdminPeople />
              </RequireRole>
            }
          />

          {/* students only: faculty and admin do not submit work */}
          <Route
            path="/assignments/:assignmentId/submit"
            element={
              <RequireRole roles={["student"]}>
                <SubmitPage />
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
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
