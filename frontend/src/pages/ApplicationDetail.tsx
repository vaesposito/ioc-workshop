import { useMemo, useRef } from "react";
import {
  LuArrowLeft,
  LuLoaderCircle,
  LuPlay,
} from "react-icons/lu";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ComponentBubbleGraph } from "../components/ComponentBubbleGraph";
import { HealthBadge } from "../components/HealthBadge";
import { DemoLocked } from "../components/DemoLocked";
import { isPoolTrace, startSimulatedRun } from "../cms/simulatedRuns";
import { Layout } from "../components/Layout";
import { StatWidget } from "../components/StatWidget";
import { useApplications } from "../hooks/useApplications";
import { useInvestigations } from "../hooks/useInvestigations";
import { useStartInvestigationDrawer } from "../hooks/useStartInvestigationDrawer";
import { useTraceManager } from "../hooks/useTraceManager";
import { getApplicationCopy } from "../content/application-copy";
import { buildAppComponentGraph } from "../utils/componentGraph";
import {
  detectionStatusLabel,
  formatTraceDate,
  formatTraceDisplayName,
  getAppPortfolioStats,
  getApplicationInventory,
  getApplicationPurpose,
  getLatestCompletedInvestigation,
  getTraceIssueCounts,
  investigationReportPath,
  issueCountTotal,
  isHealthyTrace,
  isSuspiciousTrace,
  demoShuffleSeed,
  seededShuffle,
} from "../utils/portfolio";

type TraceView = "all" | "malicious" | "healthy";

function parseTraceView(value: string | null): TraceView {
  if (value === "malicious" || value === "suspicious") {
    return "malicious";
  }
  if (value === "healthy") {
    return "healthy";
  }
  return "all";
}

export function ApplicationDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { applications, loading: appsLoading } = useApplications();
  const { traces, loading: tracesLoading } = useTraceManager();
  const { investigations } = useInvestigations(id, { enableStream: false });
  const { openStartInvestigationDrawer } = useStartInvestigationDrawer();

  const application = applications.find((app) => app.id === id);
  const shuffleSeedRef = useRef<string>("");
  if (!shuffleSeedRef.current) {
    shuffleSeedRef.current = demoShuffleSeed();
  }
  const appTraces = useMemo(
    () => traces.filter((trace) => trace.appId === id),
    [traces, id],
  );
  const stats = getAppPortfolioStats(appTraces);
  const inventory = application
    ? getApplicationInventory(application)
    : { tools: 0, agents: 1 };
  const copy = application ? getApplicationPurpose(application) : null;
  const componentGraph = useMemo(
    () =>
      application
        ? buildAppComponentGraph(application, investigations)
        : null,
    [application, investigations],
  );
  const traceView = parseTraceView(searchParams.get("traces"));
  const visibleTraces = useMemo(() => {
    const filtered =
      traceView === "malicious"
        ? appTraces.filter(isSuspiciousTrace)
        : traceView === "healthy"
          ? appTraces.filter(isHealthyTrace)
          : appTraces;
    return seededShuffle(
      filtered,
      (trace) => trace.traceFileId,
      shuffleSeedRef.current,
    );
  }, [appTraces, traceView]);
  const investigationCount = investigations.filter(
    (investigation) => investigation.applicationId === id,
  ).length;
  // Matches the portfolio widgets: only classified traces, so the slices add
  // up to the headline figure.
  const resultMix = [
    {
      label: "Malicious",
      value: stats.suspiciousTraces,
      tone: "danger" as const,
    },
    { label: "Healthy", value: stats.healthyTraces, tone: "success" as const },
  ];

  function setTraceView(value: TraceView) {
    const next = new URLSearchParams(searchParams);
    if (value === "all") {
      next.delete("traces");
    } else {
      next.set("traces", value);
    }
    setSearchParams(next, { replace: true });
  }

  function openStart() {
    if (!id) {
      return;
    }
    openStartInvestigationDrawer({
      mode: "start-investigation",
      defaultApplicationId: id,
      initialStep: 2,
    });
  }

  if (!appsLoading && !application) {
    return (
      <Layout pageTitle="Application">
        <div className="py-10">
          <p className="ioc-copy">Application not found.</p>
          <button
            type="button"
            onClick={() => navigate("/applications")}
            className="ioc-link mt-3 text-sm"
          >
            Back to applications
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout pageTitle={application?.name ?? "Application"}>
      <div className="flex flex-col gap-8 py-2">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-3xl">
            <button
              type="button"
              onClick={() => navigate("/applications")}
              className="ioc-back mb-3"
            >
              <LuArrowLeft size={14} />
              Applications
            </button>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="ioc-title text-3xl">
                {application?.name ?? "Application"}
              </h1>
            </div>
            <p className="ioc-copy mt-3 text-[15px]">{copy?.purpose}</p>
          </div>
          <button type="button" onClick={openStart} className="ioc-btn-primary">
            <LuPlay size={14} />
            Start investigation
          </button>
        </div>

        <div className="relative z-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatWidget
            label="Tools"
            value={inventory.tools}
            description="Tools this agent can call. Click to show the component graph."
            onClick={() =>
              document.getElementById("components")?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              })
            }
          />
          <StatWidget
            label="Traces"
            value={stats.totalTraces}
            description="All traces in this workspace. Click to show the full list."
            onClick={() => {
              setTraceView("all");
              document.getElementById("traces")?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            }}
          />
          <StatWidget
            label="Investigations"
            value={investigationCount}
            description="Investigations run against this application."
          />
          <StatWidget
            label="Investigation results"
            value={stats.healthyTraces + stats.suspiciousTraces}
            chart
            description="Verdicts returned so far, split between malicious and healthy. Click to filter the table to malicious traces."
            segments={resultMix}
            onClick={() =>
              setTraceView(traceView === "malicious" ? "all" : "malicious")
            }
          />
        </div>

        {componentGraph ? (
          <div id="components">
            <ComponentBubbleGraph
              graph={componentGraph}
              usage="application"
              horizontal
              framed
              appDetail={
                application ? getApplicationCopy(application)?.detail : undefined
              }
              traceNameById={Object.fromEntries(
                appTraces.map((row) => [row.traceFileId, row.traceName]),
              )}
              caption="The user talks to the agentic app. Every component is linked to that app."
            />
          </div>
        ) : null}

        <div id="traces" className="ioc-glass rounded-xl">
          <div className="ioc-hairline border-b px-4 py-3">
            <h2 className="ioc-fg text-[15px] font-light">Traces</h2>
            <p className="ioc-faint mt-1 text-[12px] font-light">
              Collection date, analysis date, investigation status, and latest
              verdict. Run Detective on an existing trace row.
            </p>
          </div>

          {tracesLoading ? (
            <p className="ioc-faint px-6 py-8 text-center text-sm font-light">
              Loading traces...
            </p>
          ) : appTraces.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <p className="ioc-copy">
                No traces uploaded for this application yet.
              </p>
              <p className="ioc-faint mt-2 text-sm font-light">
                Start an investigation to upload a trace and run Detective
                Agent.
              </p>
            </div>
          ) : visibleTraces.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <p className="ioc-copy">No traces match this filter.</p>
              <button
                type="button"
                onClick={() => setTraceView("all")}
                className="ioc-btn-ghost mt-4"
              >
                Show all traces
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1040px] text-[13px]">
                <thead>
                  <tr className="ioc-hairline border-b">
                    {[
                      "Trace",
                      "Collection date",
                      "Analysis date",
                      "Investigation status",
                      "Latest verdict",
                      "Evidence",
                    ].map((heading) => (
                      <th key={heading} className="ioc-th">
                        {heading}
                      </th>
                    ))}
                    <th className="ioc-th ioc-th-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--ioc-glass-border)]">
                {visibleTraces.map((trace) => {
                    const completed = getLatestCompletedInvestigation(
                      investigations,
                      trace.traceFileId,
                    );
                    const traceIssues = getTraceIssueCounts(completed, trace);
                    const running =
                      trace.latestStatus === "pending" ||
                      trace.latestStatus === "started";
                    const failed = trace.latestStatus === "failed";
                    const visualizerPath = `/applications/${id}/traces/${trace.traceFileId}`;
                    const reportPath =
                      investigationReportPath(trace) ??
                      (completed ? `/investigations/${completed.id}` : null);
                    const openPath = reportPath ?? visualizerPath;
                    const statusClass = running
                      ? "sev-warning-text"
                      : failed
                        ? "sev-danger-text"
                        : "ioc-copy";

                    return (
                      <tr
                        key={trace.traceFileId}
                        className="ioc-click-row"
                        onClick={() => navigate(openPath)}
                      >
                        <td className="ioc-fg max-w-[240px] truncate px-4 py-3 font-light">
                          {formatTraceDisplayName(trace.traceName)}
                        </td>
                        <td className="ioc-copy whitespace-nowrap px-4 py-3 font-light">
                          {formatTraceDate(trace.submittedAtMs)}
                        </td>
                        <td className="ioc-copy whitespace-nowrap px-4 py-3 font-light">
                          {formatTraceDate(trace.latestAnalyzedAtMs)}
                        </td>
                        <td className={`px-4 py-3 font-light ${statusClass}`}>
                          {running ? (
                            <span className="inline-flex items-center gap-1.5">
                              <LuLoaderCircle size={13} className="animate-spin" />
                              Investigating...
                            </span>
                          ) : (
                            detectionStatusLabel(trace)
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {trace.latestLabel === "malicious" ? (
                            <HealthBadge health="suspicious" />
                          ) : trace.latestLabel === "benign" ? (
                            <HealthBadge health="healthy" />
                          ) : (
                            <HealthBadge health="unanalyzed" />
                          )}
                        </td>
                        <td className="ioc-copy px-4 py-3 font-light tabular-nums">
                          {/* A trace with no finished run has no evidence to
                              count, which is not the same as a count of zero. */}
                          {completed ? issueCountTotal(traceIssues) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            {trace.latestStatus === null && isPoolTrace(trace.traceFileId) ? (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  startSimulatedRun(trace.traceFileId);
                                  navigate(visualizerPath);
                                }}
                                className="ioc-link inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-light hover:bg-[color:var(--ioc-row-hover)]"
                              >
                                <LuPlay size={13} />
                                Start investigation
                              </button>
                            ) : running && isPoolTrace(trace.traceFileId) ? (
                              <span className="sev-warning-text inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-light">
                                <LuLoaderCircle size={13} className="animate-spin" />
                                Running...
                              </span>
                            ) : (
                              <DemoLocked>
                                <button
                                  type="button"
                                  disabled
                                  className="ioc-link inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-light disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <LuPlay size={13} />
                                  Start investigation
                                </button>
                              </DemoLocked>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
