import { LuPlay } from "react-icons/lu";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { HealthBadge } from "../components/HealthBadge";
import { Layout } from "../components/Layout";
import { StatCounter, StatWidget } from "../components/StatWidget";
import { useApplications } from "../hooks/useApplications";
import { useInvestigations } from "../hooks/useInvestigations";
import { useStartInvestigationDrawer } from "../hooks/useStartInvestigationDrawer";
import { useTraceManager } from "../hooks/useTraceManager";
import {
  formatTraceDate,
  getAppPortfolioStats,
  getApplicationInventory,
  getApplicationPurpose,
  isHealthyTrace,
  isSuspiciousTrace,
} from "../utils/portfolio";

export function Applications() {
  const navigate = useNavigate();
  const { applications, loading: appsLoading } = useApplications();
  const { traces, loading: tracesLoading } = useTraceManager();
  const { investigations } = useInvestigations(undefined, {
    enableStream: false,
  });
  const { openStartInvestigationDrawer } = useStartInvestigationDrawer();

  const cards = useMemo(
    () =>
      applications
        .map((app) => {
          const appTraces = traces.filter((trace) => trace.appId === app.id);
          const stats = getAppPortfolioStats(appTraces);
          const copy = getApplicationPurpose(app);
          const inventory = getApplicationInventory(app);
          // Newest first, so the head of the list is the run to report on.
          const appInvestigations = investigations
            .filter((investigation) => investigation.applicationId === app.id)
            .sort(
              (left, right) =>
                (right.completedAt ?? right.createdAt) -
                (left.completedAt ?? left.createdAt),
            );
          // Prefer the newest finished run, since a queued or failed one has no
          // verdict to show; fall back to the newest of any status.
          const lastInvestigation =
            appInvestigations.find(
              (investigation) => investigation.status === "completed",
            ) ?? appInvestigations[0];
          return {
            app,
            stats,
            copy,
            inventory,
            investigationCount: appInvestigations.length,
            lastInvestigation,
          };
        })
        .sort((left, right) => {
          const byTraces = right.stats.totalTraces - left.stats.totalTraces;
          if (byTraces !== 0) {
            return byTraces;
          }
          return left.app.name.localeCompare(right.app.name);
        }),
    [applications, traces, investigations],
  );

  const healthyTraces = traces.filter(isHealthyTrace).length;
  const maliciousTraces = traces.filter(isSuspiciousTrace).length;
  // Only classified traces, so the slices add up to the headline figure. An
  // uninvestigated trace has no verdict and belongs in neither.
  const resultMix = [
    { label: "Malicious", value: maliciousTraces, tone: "danger" as const },
    { label: "Healthy", value: healthyTraces, tone: "success" as const },
  ];

  return (
    <Layout pageTitle="Applications">
      <div className="flex flex-col gap-8 py-2">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-3xl">
            <h1 className="ioc-title text-3xl md:text-4xl">
              Application portfolio
            </h1>
            <p className="ioc-copy mt-3 max-w-2xl text-[15px]">
              Workspaces for agentic applications. Choose an application, pick
              one of its recorded traces, then run an investigation on it.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() =>
                openStartInvestigationDrawer({ mode: "start-investigation" })
              }
              className="ioc-btn-primary"
            >
              <LuPlay size={14} />
              Start investigation
            </button>
          </div>
        </div>

        <div className="relative z-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatWidget
            label="Apps"
            value={applications.length}
            description="Agentic applications in this workspace."
          />
          <StatWidget
            label="Traces"
            value={traces.length}
            description="Uploaded traces across applications."
          />
          <StatWidget
            label="Investigations"
            value={investigations.length}
            description="Investigations run across applications."
          />
          <StatWidget
            label="Investigation results"
            value={maliciousTraces + healthyTraces}
            chart
            description="Verdicts returned so far, split between malicious and healthy."
            segments={resultMix}
          />
        </div>

        {appsLoading || tracesLoading ? (
          <p className="ioc-faint px-1 py-8 text-center text-sm font-light">
            Loading applications...
          </p>
        ) : cards.length === 0 ? (
          <div className="ioc-glass rounded-xl px-6 py-12 text-center">
            <p className="ioc-copy">No applications yet.</p>
            <p className="ioc-faint mt-2 text-sm font-light">
              Start an investigation to create an application, attach a trace,
              and run Detective.
            </p>
            <button
              type="button"
              onClick={() =>
                openStartInvestigationDrawer({ mode: "start-investigation" })
              }
              className="ioc-btn-primary mt-4"
            >
              <LuPlay size={14} />
              Start investigation
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {cards.map(
              ({
                app,
                stats,
                copy,
                inventory,
                investigationCount,
                lastInvestigation,
              }) => (
                <article
                  key={app.id}
                  className="ioc-glass ioc-click-card relative z-0 flex h-full flex-col rounded-xl hover:z-20"
                  onClick={() => navigate(`/applications/${app.id}`)}
                >
                  <div className="ioc-hairline flex items-start justify-between gap-3 border-b px-5 py-4">
                    <div>
                      <h2 className="ioc-fg text-[18px] font-light tracking-tight">
                        {app.name}
                      </h2>
                      <p className="ioc-copy mt-1 text-[13px]">
                        {copy.shortDescription}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <p className="ioc-faint text-[12px] font-light">
                        {lastInvestigation
                          ? `Last investigation · ${formatTraceDate(
                              lastInvestigation.completedAt ??
                                lastInvestigation.createdAt,
                            )}`
                          : "No investigation yet"}
                      </p>
                      <HealthBadge health={stats.health} />
                    </div>
                  </div>

                <div className="flex flex-1 flex-col px-5 py-4">
                  <p className="ioc-kicker">Description</p>
                  <p className="ioc-copy mt-2 text-[13px]">{copy.purpose}</p>

                  {/* Pushed down so the counter rows line up across cards,
                      whatever length the descriptions above them run to. */}
                  <div className="mt-auto grid grid-cols-2 gap-3 pt-5 sm:grid-cols-4">
                      <StatCounter
                        label="Tools"
                        value={inventory.tools}
                        size="sm"
                      />
                      <StatCounter
                        label="Traces"
                        value={stats.totalTraces}
                        size="sm"
                      />
                      <StatCounter
                      label="Investigations"
                      value={investigationCount}
                        size="sm"
                      />
                      <StatCounter
                      label="Investigation results"
                      value={stats.healthyTraces + stats.suspiciousTraces}
                      // Flags the card when anything malicious turned up.
                      tone={stats.suspiciousTraces > 0 ? "danger" : "default"}
                      size="sm"
                      description={`Traces with a verdict so far: ${stats.suspiciousTraces} malicious, ${stats.healthyTraces} healthy. Turns red when any malicious result is present.`}
                      />
                    </div>
                  </div>
                </article>
              ),
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
