import { lazy, Suspense, type ReactElement } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import SignIn from "./pages/SignIn";
import AuthCallback from "./pages/AuthCallback";

import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";

const Landing = lazy(() => import("./pages/Landing"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ProjectDetail = lazy(() => import("./pages/ProjectDetail"));
const MultiTechWorkspace = lazy(() => import("./pages/MultiTechWorkspace"));
const TechniqueWorkspace = lazy(() => import("./pages/TechniqueWorkspace"));
const WorkspaceLauncher = lazy(() => import("./pages/WorkspaceLauncher"));
const NotebookLab = lazy(() => import("./pages/NotebookLab"));
const ReportBuilder = lazy(() => import("./pages/ReportBuilder"));
const AgentDemo = lazy(() => import("./pages/AgentDemo"));
const HistoryPage = lazy(() => import("./pages/History"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const XRDWorkspace = lazy(() => import("./pages/XRDWorkspace"));
const XPSWorkspace = lazy(() => import("./pages/XPSWorkspace"));
const FTIRWorkspace = lazy(() => import("./pages/FTIRWorkspace"));
const RamanWorkspace = lazy(() => import("./pages/RamanWorkspace"));
const FusionWorkspace = lazy(() => import("./pages/FusionWorkspace"));
const AnalysisWorkspaceHome = lazy(() =>
  import("./pages/AnalysisWorkspace").then((module) => ({
    default: module.AnalysisWorkspaceHome,
  }))
);
const AnalysisNew = lazy(() =>
  import("./pages/AnalysisWorkspace").then((module) => ({
    default: module.AnalysisNew,
  }))
);
const AnalysisSessionPage = lazy(() =>
  import("./pages/AnalysisWorkspace").then((module) => ({
    default: module.AnalysisSessionPage,
  }))
);
const ProjectEvidenceRegistry = lazy(() =>
  import("./pages/AnalysisWorkspace").then((module) => ({
    default: module.ProjectEvidenceRegistry,
  }))
);

function AppRouteLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-slate-700">
      <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 text-sm font-semibold shadow-sm">
        Loading workspace...
      </div>
    </main>
  );
}

function protectedRoute(element: ReactElement) {
  return <ProtectedRoute>{element}</ProtectedRoute>;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Suspense fallback={<AppRouteLoading />}>
          <Routes>
            <Route path="/" element={<Landing />} />

            <Route path="/login" element={<SignIn />} />
            <Route path="/signin" element={<SignIn />} />
            <Route path="/auth/callback" element={<AuthCallback />} />

            <Route path="/dashboard" element={protectedRoute(<Dashboard />)} />
            <Route path="/projects" element={protectedRoute(<Dashboard />)} />

            <Route
              path="/project/:projectId"
              element={protectedRoute(<ProjectDetail />)}
            />

            <Route
              path="/project/:projectId/evidence"
              element={protectedRoute(<ProjectEvidenceRegistry />)}
            />

            <Route
              path="/analysis"
              element={protectedRoute(<AnalysisWorkspaceHome />)}
            />

            <Route
              path="/analysis/new"
              element={protectedRoute(<AnalysisNew />)}
            />

            <Route
              path="/analysis/session/:analysisId"
              element={protectedRoute(<AnalysisSessionPage />)}
            />

            <Route
              path="/analysis/session/:analysisId/save"
              element={protectedRoute(<AnalysisSessionPage />)}
            />

            <Route
              path="/analysis/session/:analysisId/attach"
              element={protectedRoute(<AnalysisSessionPage />)}
            />

            <Route
              path="/analysis/session/:analysisId/export"
              element={protectedRoute(<AnalysisSessionPage />)}
            />

            <Route
              path="/analysis/session/:analysisId/versions"
              element={protectedRoute(<AnalysisSessionPage />)}
            />

            <Route
              path="/workspace"
              element={protectedRoute(<WorkspaceLauncher />)}
            />

            <Route
              path="/workspace/multi"
              element={protectedRoute(<MultiTechWorkspace />)}
            />

            {/* Analysis Workspace alias - project-scoped entry that surfaces
               technique selection and recent workspace history for the project. */}
            <Route
              path="/workspace/analysis"
              element={protectedRoute(<WorkspaceLauncher />)}
            />

            <Route
              path="/workspace/xrd"
              element={protectedRoute(<XRDWorkspace />)}
            />

            <Route
              path="/workspace/xps"
              element={protectedRoute(<XPSWorkspace />)}
            />

            <Route
              path="/workspace/ftir"
              element={protectedRoute(<FTIRWorkspace />)}
            />

            <Route
              path="/workspace/raman"
              element={protectedRoute(<RamanWorkspace />)}
            />

            <Route
              path="/workspace/fusion"
              element={protectedRoute(<FusionWorkspace />)}
            />

            <Route
              path="/workspace/:technique"
              element={protectedRoute(<TechniqueWorkspace />)}
            />

            <Route
              path="/notebook"
              element={protectedRoute(<NotebookLab />)}
            />

            <Route
              path="/reports"
              element={protectedRoute(<ReportBuilder />)}
            />

            <Route
              path="/report"
              element={protectedRoute(<ReportBuilder />)}
            />

            <Route
              path="/history"
              element={protectedRoute(<HistoryPage />)}
            />

            <Route
              path="/settings"
              element={protectedRoute(<SettingsPage />)}
            />

            <Route
              path="/agent"
              element={protectedRoute(<AgentDemo />)}
            />

            <Route
              path="/demo/agent"
              element={protectedRoute(<AgentDemo />)}
            />
          </Routes>
        </Suspense>
      </Router>
    </AuthProvider>
  );
}

export default App;
