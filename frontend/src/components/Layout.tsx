import { LuRotateCcw, LuX } from "react-icons/lu";
import { useEffect, useRef } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useInvestigations } from "../hooks/useInvestigations";
import { useApplications } from "../hooks/useApplications";
import { useAuth } from "../hooks/useAuth";
import { useTraceManager } from "../hooks/useTraceManager";
import { useStartInvestigationDrawer } from "../hooks/useStartInvestigationDrawer";
import { simulationStore } from "../cms/simulationStore";
import { getPoolInvestigation, getPoolEntryByInvestigationId, isPoolTrace, onSimulatedRunQueued, startSimulatedRun } from "../cms/simulatedRuns";
import { queryClient } from "../query/client";
import { NotificationCenter } from "./NotificationCenter";
import { NotificationToasts } from "./NotificationToasts";
import { Breadcrumbs, type Crumb } from "./Breadcrumbs";
import { PageTitle } from "./PageTitle";
import { RunDetectorPanel } from "./RunDetectorPanel";
import { StartInvestigationPanel } from "./StartInvestigationPanel";
import { ThemeToggle } from "./ThemeToggle";
import type { StartInvestigationValues } from "./StartInvestigationPanel";
import { queryKeys } from "../query/keys";
import type { Investigation } from "../utils/investigationStore";
import { resetDemoShuffleSeed, traceHasInvestigation } from "../utils/portfolio";

interface LayoutProps {
  children: React.ReactNode;
  pageTitle?: React.ReactNode;
  breadcrumbs?: Crumb[];
  pageActions?: React.ReactNode;
  isFullWidth?: boolean;
  wideContent?: boolean;
  /** Replaces the default header tools (reset, theme, notifications, avatar). */
  headerAction?: React.ReactNode;
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `ioc-nav-link ${isActive ? "ioc-nav-link-active" : ""}`;

export function Layout({
  children,
  pageTitle,
  breadcrumbs,
  pageActions,
  isFullWidth = false,
  wideContent = false,
  headerAction,
}: LayoutProps) {
  const navigate = useNavigate();
  useAuth({ verifyBackendAuth: true });
  const { investigations, addInvestigation, rerunInvestigation } = useInvestigations(undefined, {
    // No backend, so there is no websocket to stream from.
    enableStream: false,
  });
  const { applications } = useApplications();
  const { traces } = useTraceManager();
  const {
    state: drawerState,
    resetStartInvestigationDrawer,
  } = useStartInvestigationDrawer();
  const pendingReportIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!drawerState.isOpen) {
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        resetStartInvestigationDrawer();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerState.isOpen, resetStartInvestigationDrawer]);

  function openQueuedInvestigationReport() {
    const pendingId = pendingReportIdRef.current;
    if (!pendingId) {
      return;
    }
    const cached =
      queryClient.getQueryData<Investigation[]>(
        queryKeys.investigations.list(undefined),
      ) ?? investigations;
    const investigation = cached.find((row) => row.id === pendingId);
    const poolTraceFileId =
      investigation?.traceFileId ??
      getPoolEntryByInvestigationId(pendingId)?.traceFileId;
    const simulated = poolTraceFileId
      ? simulationStore.get(poolTraceFileId)
      : undefined;
    if (!investigation) {
      return;
    }
    if (
      investigation.status === "completed" ||
      investigation.status === "failed" ||
      simulated?.status === "completed"
    ) {
      pendingReportIdRef.current = null;
      navigate(`/investigations/${pendingId}`);
    }
  }

  useEffect(() => {
    openQueuedInvestigationReport();
  }, [investigations, navigate]);

  useEffect(() => {
    return simulationStore.subscribe(() => {
      openQueuedInvestigationReport();
    });
  }, [investigations, navigate]);

  useEffect(() => {
    return onSimulatedRunQueued((investigationId) => {
      pendingReportIdRef.current = investigationId;
      openQueuedInvestigationReport();
    });
  }, [investigations, navigate]);

  function queueInvestigationReport(investigationId: string) {
    pendingReportIdRef.current = investigationId;
    openQueuedInvestigationReport();
  }

  async function handleStartInvestigation(values: StartInvestigationValues) {
    if (values.traceFileId) {
      const existing = traces.find(
        (trace) => trace.traceFileId === values.traceFileId,
      );
      if (existing && traceHasInvestigation(existing)) {
        return;
      }
    }
    const runName = `Detective: ${values.traceName || "trace"}`;
    resetStartInvestigationDrawer();

    // Traces seeded from preload_artifacts are simulated client-side; everything else
    // (real uploads, non-demo traces) still goes through the live BFF rerun endpoint.
    if (values.traceFileId && isPoolTrace(values.traceFileId)) {
      startSimulatedRun(values.traceFileId);
      const poolInvestigation = getPoolInvestigation(values.traceFileId);
      if (poolInvestigation) {
        if (poolInvestigation.applicationId) {
          navigate(
            `/applications/${poolInvestigation.applicationId}/traces/${values.traceFileId}`,
          );
        }
        queueInvestigationReport(poolInvestigation.id);
      }
      return;
    }

    try {
      if (values.traceFileId) {
        const created = await rerunInvestigation({
          appId: values.applicationId,
          technique: values.technique,
          traceFileId: values.traceFileId,
          namePrefix: runName,
        });
        if (created[0]) {
          queueInvestigationReport(created[0]);
        }
        return;
      }
      const formData = new FormData();
      formData.append("name", runName);
      formData.append("technique", values.technique);
      if (values.applicationId) formData.append("app_id", values.applicationId);
      if (values.file) formData.append("file", values.file);
      const createdId = await addInvestigation(formData);
      queueInvestigationReport(createdId);
    } catch {
      // Surface via the investigations hook error; keep the current page.
    }
  }

  function handleStartAgain() {
    resetStartInvestigationDrawer();
    if (!window.confirm("Reset demo? This clears any simulated investigation runs.")) {
      return;
    }
    simulationStore.resetAll();
    resetDemoShuffleSeed();
    queryClient.clear();
    window.location.reload();
  }

  return (
    <div className="ioc-shell flex min-h-screen flex-col">
      <div className="ioc-rainbow shrink-0" />
      <NotificationToasts />

      <header className="ioc-header sticky top-0 z-[60] h-[48px] shrink-0">
        <div className="flex h-full items-center gap-0 px-6 py-0">
          <NavLink
            to="/"
            className="ioc-fg mr-3 flex shrink-0 cursor-pointer items-center text-[12px] font-light leading-4 tracking-[0.18em] uppercase opacity-80"
          >
            Cognitive Security Demo
          </NavLink>
          <div className="mx-1 h-5 w-px shrink-0 bg-[color:var(--ioc-glass-border)]" />
          <nav className="ml-1 flex h-full items-stretch">
            <NavLink to="/" end className={navLinkClass}>
              Overview
            </NavLink>
            <NavLink to="/applications" className={navLinkClass}>
              Applications
              {applications.length > 0 && (
                <span className="ioc-faint ml-1 text-[11px] font-light leading-4">
                  {applications.length}
                </span>
              )}
            </NavLink>
            <NavLink to="/investigations" className={navLinkClass}>
              Investigations
              {investigations.length > 0 && (
                <span className="ioc-faint ml-1 text-[11px] font-light leading-4">
                  {investigations.length}
                </span>
              )}
            </NavLink>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {headerAction ?? (
              <>
                <button
                  type="button"
                  onClick={handleStartAgain}
                  className="ioc-btn-ghost"
                >
                  <LuRotateCcw size={14} />
                  Reset demo
                </button>
                <ThemeToggle />
                <NotificationCenter />
              </>
            )}
          </div>
        </div>
      </header>

      {pageTitle || breadcrumbs?.length || pageActions ? (
        <div className="ioc-page-bar ioc-page-bar-sticky flex w-full items-center gap-3">
          <div className="min-w-0 flex-1">
            {breadcrumbs?.length ? (
              <div className="px-6 py-2">
                <Breadcrumbs items={breadcrumbs} />
              </div>
            ) : pageTitle ? (
              <PageTitle title={pageTitle} />
            ) : null}
          </div>
          {pageActions ? (
            <div className="flex shrink-0 items-center gap-2 px-6 py-2">
              {pageActions}
            </div>
          ) : null}
        </div>
      ) : null}

      <main className="flex w-full flex-1 flex-col">
        <div
          className={
            isFullWidth
              ? "w-full"
              : wideContent
                ? "mx-auto w-[90%] p-6"
                : "mx-auto w-full max-w-[1390px] p-6 xl:max-w-[1680px] 2xl:max-w-[1920px]"
          }
        >
          {children}
        </div>
      </main>

      {/* ── Slide-from-right investigation drawer ─────────────────────────── */}

      {/* Backdrop */}
      <div
        className={`fixed inset-0 top-[48px] z-40 bg-black/60 transition-opacity duration-300 ${
          drawerState.isOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
        onClick={resetStartInvestigationDrawer}
      />

      {/* Drawer panel */}
      <div
        className={`ioc-menu ioc-hairline fixed top-[48px] right-0 z-50 flex h-[calc(100vh-48px)] w-[580px] max-w-[92vw] flex-col border-l backdrop-blur-[20px] transition-transform duration-300 ease-in-out ${
          drawerState.isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Drawer header */}
        <div className="ioc-hairline flex shrink-0 items-center justify-between border-b px-6 py-3">
          <h2 className="ioc-fg text-base font-light tracking-wide">
            Start investigation
          </h2>
          <button
            onClick={resetStartInvestigationDrawer}
            className="ioc-icon-btn"
            aria-label="Close"
          >
            <LuX size={16} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="ioc-drawer-form flex min-h-0 flex-1 flex-col overflow-hidden">
          {drawerState.mode === "run-detector" ? (
            drawerState.defaultApplicationId && drawerState.traceFileId ? (
              <RunDetectorPanel
                appId={drawerState.defaultApplicationId}
                traceFileId={drawerState.traceFileId}
                traceName={drawerState.traceName ?? "Trace"}
                defaultTechnique={drawerState.defaultTechnique}
                onCancel={resetStartInvestigationDrawer}
                onStarted={queueInvestigationReport}
              />
            ) : (
              <p className="ioc-copy px-6 py-6 text-sm font-light">
                Re-run unavailable because the original trace reference could
                not be found.
              </p>
            )
          ) : null}
          {drawerState.mode === "start-investigation" && drawerState.isOpen ? (
            <StartInvestigationPanel
              key={`${drawerState.defaultApplicationId ?? "any"}-${drawerState.traceFileId ?? "trace"}-${drawerState.initialStep ?? 1}`}
              applications={applications}
              defaultApplicationId={drawerState.defaultApplicationId}
              lockApplicationSelection={drawerState.lockApplicationSelection}
              defaultTraceFileId={drawerState.traceFileId}
              defaultTraceName={drawerState.traceName}
              traces={traces}
              initialStep={drawerState.initialStep}
              onCancel={resetStartInvestigationDrawer}
              onSubmit={handleStartInvestigation}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
