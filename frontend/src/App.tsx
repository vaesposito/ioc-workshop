import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import { queryClient } from "./query/client";
import { resumeSimulatedRuns } from "./cms/simulatedRuns";
import { ApplicationDetail } from "./pages/ApplicationDetail";
import { Applications } from "./pages/Applications";
import { AppSettings } from "./pages/AppSettings";
import { ConsoleApps } from "./console/ConsoleApps";
import { ConsoleTraceView } from "./console/ConsoleTraceView";
import { ConsoleAppDetail } from "./console/ConsoleAppDetail";
import { DetectiveResult } from "./pages/DetectiveResult";
import { Overview } from "./pages/Overview";
import { Investigations } from "./pages/Investigations";
import { InvestigationDetail } from "./pages/InvestigationDetail";
import { TraceVisualizer } from "./pages/TraceVisualizer";
import { StartInvestigationDrawerProvider } from "./hooks/useStartInvestigationDrawer";
import { ThemeProvider } from "./hooks/useTheme";

// React Router keeps the window offset across navigations and browsers restore
// it on reload, so a page opened from a scrolled list starts part way down.
function ScrollToTop() {
  const { hash, pathname } = useLocation();

  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);

  useEffect(() => {
    // A hash is an explicit request for a spot on the page; leave it alone.
    if (hash) {
      return;
    }
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [hash, pathname]);

  return null;
}

function PagesRouteRestore() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const savedRoute = sessionStorage.getItem("detective-pages-route");
    if (!savedRoute) {
      return;
    }

    sessionStorage.removeItem("detective-pages-route");
    if (savedRoute !== location.pathname + location.search + location.hash) {
      navigate(savedRoute, { replace: true });
    }
  }, [location.hash, location.pathname, location.search, navigate]);

  return null;
}

export function App() {
  // Served from the repository's own path on GitHub Pages, and from the
  // root when run locally.
  const basename = import.meta.env.BASE_URL;

  useEffect(() => {
    resumeSimulatedRuns();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter basename={basename}>
            <ScrollToTop />
            <PagesRouteRestore />
            <StartInvestigationDrawerProvider>
              <Routes>
                <Route path="/" element={<Overview />} />
                <Route path="/applications" element={<Applications />} />
                <Route
                  path="/applications/:id/traces/:traceFileId/result"
                  element={<DetectiveResult />}
                />
                <Route
                  path="/applications/:id/traces/:traceFileId"
                  element={<TraceVisualizer />}
                />
                <Route
                  path="/applications/:id"
                  element={<ApplicationDetail />}
                />
                <Route path="/investigations" element={<Investigations />} />
                <Route
                  path="/investigations/:id"
                  element={<InvestigationDetail />}
                />
                <Route path="/app-settings" element={<AppSettings />} />
                {/* The new console, on its own shell beside the demo's pages. */}
                <Route path="/console" element={<ConsoleApps />} />
                <Route
                  path="/console/apps/:id"
                  element={<ConsoleAppDetail />}
                />
                <Route
                  path="/console/apps/:id/traces/:traceId"
                  element={<ConsoleTraceView />}
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </StartInvestigationDrawerProvider>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
