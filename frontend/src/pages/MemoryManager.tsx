import { Layout } from "../components/Layout";
import { LuArrowRight } from "react-icons/lu";
import { useApplications } from "../hooks/useApplications";
import { useInvestigations } from "../hooks/useInvestigations";
import { useStartInvestigationDrawer } from "../hooks/useStartInvestigationDrawer";
import { Button as ActionButton } from "../components/Button";
import { useNavigate } from "react-router-dom";
import type { Application } from "../utils/applicationStore";
import { getApplicationCopy } from "../content/application-copy";
import { getDisplayTechnique } from "../utils/techniques";

type TechniqueKey = "evoguard";

const TECHNIQUES: Array<{
  key: TechniqueKey;
  label: string;
  subtitle: string;
}> = [
  {
    key: "evoguard",
    label: "Agent-ToM",
    subtitle: "behavior detection",
  },
];

function normalizeTechnique(value: string): TechniqueKey | null {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes("evo")) {
    return "evoguard";
  }
  return null;
}

function formatRelativeTime(timestamp?: number): string {
  if (!timestamp || !Number.isFinite(timestamp)) {
    return "-";
  }

  const elapsedMs = Date.now() - timestamp;
  if (elapsedMs < 0) {
    return "now";
  }

  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  if (elapsedMs < hourMs) {
    return `${Math.max(1, Math.floor(elapsedMs / minuteMs))}m ago`;
  }
  if (elapsedMs < dayMs) {
    return `${Math.floor(elapsedMs / hourMs)}h ago`;
  }

  return `${Math.floor(elapsedMs / dayMs)}d ago`;
}

function clampReadiness(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function readinessBarColor(value: number): string {
  if (value >= 80) return "bg-green-700";
  if (value >= 50) return "bg-amber-500";
  return "bg-red-500";
}

function MetricCard({
  label,
  value,
  valueClassName = "text-gray-900",
  loading = false,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  loading?: boolean;
}) {
  return (
    <div className="lg:col-span-1 bg-white rounded-lg border border-gray-200 px-[16px] py-[14px] w-full">
      <p className="text-[11px] uppercase tracking-[0.2em] text-gray-500 font-semibold leading-none">
        {label}
      </p>
      {loading ? (
        <div className="mt-4 h-[26px] w-20 animate-pulse rounded bg-gray-200" />
      ) : (
        <p
          className={`mt-4 text-[26px] font-light leading-none ${valueClassName}`}
        >
          {value}
        </p>
      )}
    </div>
  );
}

function ApplicationCardSkeleton() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="rounded-t-lg bg-gray-50 p-2">
        <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
        <div className="mt-2 h-3 w-64 animate-pulse rounded bg-gray-200" />
      </div>
      <div className="mb-4 grid grid-cols-1 divide-y divide-gray-200 border-b border-t border-gray-200 md:grid-cols-2 md:divide-x md:divide-y-0">
        <div className="px-3 py-2">
          <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
          <div className="mt-4 h-2 w-full animate-pulse rounded bg-gray-200" />
          <div className="mt-3 h-3 w-20 animate-pulse rounded bg-gray-200" />
        </div>
        <div className="px-3 py-2">
          <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
          <div className="mt-4 h-2 w-full animate-pulse rounded bg-gray-200" />
          <div className="mt-3 h-3 w-20 animate-pulse rounded bg-gray-200" />
        </div>
      </div>
      <div className="mb-4 flex justify-end gap-2 px-3">
        <div className="h-8 w-24 animate-pulse rounded bg-gray-200" />
        <div className="h-8 w-32 animate-pulse rounded bg-gray-200" />
      </div>
    </div>
  );
}

interface ApplicationCardProps {
  application: Application;
  tracesCount: number;
  readinessByTechnique: Record<TechniqueKey, number>;
  runsByTechnique: Record<TechniqueKey, number>;
  maliciousByTechnique: Record<TechniqueKey, number>;
  benignByTechnique: Record<TechniqueKey, number>;
  lastRunByTechnique: Partial<Record<TechniqueKey, number>>;
  statsLoading: boolean;
  statsError: string | null;
  onNavigate: (path: string) => void;
  onAddTrace: (application: Application) => void;
  onRunInvestigation: (appId: string) => void;
}

function ApplicationCard({
  application,
  tracesCount,
  readinessByTechnique,
  runsByTechnique,
  maliciousByTechnique,
  benignByTechnique,
  lastRunByTechnique,
  statsLoading,
  statsError,
  onNavigate,
  onAddTrace,
  onRunInvestigation,
}: ApplicationCardProps) {
  return (
    <div
      onClick={() => onNavigate(`/applications/${application.id}`)}
      className="border rounded-lg border-gray-200 bg-white hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3 p-2 bg-gray-50 rounded-t-lg">
        <div>
          <p className="text-[13px] font-semibold text-gray-900">
            {application.name}
          </p>
          <p className="mt-1 text-[11px] text-gray-600 leading-[1.4]">
            {getApplicationCopy(application)?.shortDescription ||
              application.description ||
              "No description"}
          </p>
        </div>
        <p className="text-[11px] text-gray-500 whitespace-nowrap">
          {tracesCount.toLocaleString()} trace{tracesCount !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 mb-4 border-t border-b border-gray-200 divide-y divide-gray-200 md:grid-cols-2 md:divide-y-0 md:divide-x">
        {TECHNIQUES.map((technique) => {
          const readiness = readinessByTechnique[technique.key];
          const readinessPercent = clampReadiness(readiness);
          const runCount = runsByTechnique[technique.key];
          const maliciousCount = maliciousByTechnique[technique.key];
          const benignCount = benignByTechnique[technique.key];
          const lastRunAt = lastRunByTechnique[technique.key];

          return (
            <div
              key={`${application.id}-${technique.key}`}
              className="px-3 py-2"
            >
              <div className="flex flex-col gap-2 w-full">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12px] font-semibold text-gray-900">
                    {technique.label}
                  </p>
                  <p className="text-[10px] tracking-[0.15em] text-gray-500">
                    {technique.subtitle}
                  </p>
                </div>
                <div className="flex flex-col w-full gap-1 mb-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-gray-500">
                      Readiness
                    </p>

                    <p
                      className={`text-[14px] font-semibold ${
                        readiness < 51 ? "text-red-600" : "text-green-700"
                      }`}
                    >
                      {readiness}
                    </p>
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-gray-200">
                    <div
                      className={`h-1.5 rounded-full ${readinessBarColor(readinessPercent)}`}
                      style={{ width: `${readinessPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              {statsLoading ? (
                <div className="mt-2">
                  <div className="h-3 w-24 animate-pulse rounded bg-gray-200" />
                  <div className="mt-2 h-3 w-32 animate-pulse rounded bg-gray-200" />
                  <div className="mt-2 h-3 w-20 animate-pulse rounded bg-gray-200" />
                </div>
              ) : statsError ? (
                <p className="mt-2 text-[11px] text-amber-700">Stats unavailable</p>
              ) : runCount > 0 ? (
                <>
                  <p className="mt-2 text-[12px] font-medium text-gray-800">
                    {runCount} run{runCount !== 1 ? "s" : ""}
                  </p>
                  <p className="mt-1 text-[11px] text-gray-600">
                    <span className="text-red-600">
                      {maliciousCount} malicious
                    </span>
                    <span className="mx-1">·</span>
                    <span className="text-green-700">{benignCount} benign</span>
                  </p>
                  <p className="mt-1 text-[11px] text-gray-500">
                    last run {formatRelativeTime(lastRunAt)}
                  </p>
                </>
              ) : (
                <div className="flex items-center gap-2 flex-col">
                  <p className="text-[11px] text-gray-500">No runs yet</p>
                  <button
                    type="button"
                    className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-700"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRunInvestigation(application.id);
                    }}
                  >
                    Run {technique.label}
                    <LuArrowRight size={12} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-end gap-2 px-3 mb-4">
        <ActionButton
          text="+ Add trace"
          variant="secondary"
          onClick={() => onAddTrace(application)}
        />
        <ActionButton
          text="Run investigation"
          variant="primary"
          onClick={() => onRunInvestigation(application.id)}
        />
      </div>
    </div>
  );
}

export function MemoryManager() {
  const navigate = useNavigate();
  const {
    applications,
    loading: appsLoading,
    error: appsError,
  } = useApplications();
  const {
    investigations,
    loading: investigationsLoading,
    error: investigationsError,
  } = useInvestigations(undefined, {
    enableStream: false,
  });
  const { openStartInvestigationDrawer } = useStartInvestigationDrawer();

  const applicationsCount = applications.length;
  const tracesUploaded = investigationsLoading
    ? 0
    : new Set(investigations.map((investigation) => investigation.trace_id)).size;
  const investigationsRunCount = investigationsLoading ? 0 : investigations.length;
  const maliciousFoundCount = investigationsLoading
    ? 0
    : investigations.filter((investigation) => investigation.verdict === "malicious")
        .length;

  const traceIdsByApplication = new Map<string, Set<string>>();
  const runsByApplicationAndTechnique = new Map<
    string,
    Record<TechniqueKey, number>
  >();
  const maliciousByApplicationAndTechnique = new Map<
    string,
    Record<TechniqueKey, number>
  >();
  const benignByApplicationAndTechnique = new Map<
    string,
    Record<TechniqueKey, number>
  >();
  const lastRunByApplicationAndTechnique = new Map<
    string,
    Partial<Record<TechniqueKey, number>>
  >();

  if (!investigationsLoading) {
    for (const investigation of investigations) {
    const traceIds =
      traceIdsByApplication.get(investigation.applicationId) ??
      new Set<string>();
    traceIds.add(investigation.trace_id);
    traceIdsByApplication.set(investigation.applicationId, traceIds);

      const technique = normalizeTechnique(
        getDisplayTechnique(
          investigation.technique,
          investigation.effectiveTechnique,
        ),
      );
      if (!technique) {
        continue;
      }

      const runs =
        runsByApplicationAndTechnique.get(investigation.applicationId) ?? {
          evoguard: 0,
        };
      runs[technique] += 1;
      runsByApplicationAndTechnique.set(investigation.applicationId, runs);

      const maliciousCounts =
        maliciousByApplicationAndTechnique.get(investigation.applicationId) ?? {
          evoguard: 0,
        };
      if (investigation.verdict === "malicious") {
        maliciousCounts[technique] += 1;
      }
      maliciousByApplicationAndTechnique.set(
        investigation.applicationId,
        maliciousCounts,
      );

      const benignCounts =
        benignByApplicationAndTechnique.get(investigation.applicationId) ?? {
          evoguard: 0,
        };
      if (investigation.verdict === "benign") {
        benignCounts[technique] += 1;
      }
      benignByApplicationAndTechnique.set(
        investigation.applicationId,
        benignCounts,
      );

      const runTimestamp = investigation.completedAt ?? investigation.createdAt;
      if (Number.isFinite(runTimestamp)) {
        const lastRun =
          lastRunByApplicationAndTechnique.get(investigation.applicationId) ?? {};
        const current = lastRun[technique] ?? 0;
        if (runTimestamp > current) {
          lastRun[technique] = runTimestamp;
        }
        lastRunByApplicationAndTechnique.set(
          investigation.applicationId,
          lastRun,
        );
      }
    }
  }

  return (
    <Layout pageTitle="Memory manager">
      <section className="p-[24px] w-full">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          Memory Manager
        </h1>
        <p className="mt-1 text-[13px] text-slate-500 tracking-tight leading-tight">
          Run investigations · review findings per application
        </p>

        <div className="mt-8">
          <div className="grid grid-cols-2 gap-[12px] md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Applications"
              value={applicationsCount.toLocaleString()}
              loading={appsLoading}
            />
            <MetricCard
              label="Traces uploaded"
              value={tracesUploaded.toLocaleString()}
              loading={investigationsLoading}
            />
            <MetricCard
              label="Investigations run"
              value={investigationsRunCount.toLocaleString()}
              loading={investigationsLoading}
            />
            <MetricCard
              label="Malicious found"
              value={maliciousFoundCount.toLocaleString()}
              valueClassName="text-red-600"
              loading={investigationsLoading}
            />
          </div>
          {investigationsError ? (
            <p className="mt-3 text-[12px] text-amber-700">{investigationsError}</p>
          ) : null}
        </div>
      </section>

      <section className="px-[24px] pb-[24px]">
        {appsError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-6 py-4">
            <p className="text-[13px] text-red-700">{appsError}</p>
          </div>
        ) : appsLoading ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ApplicationCardSkeleton />
            <ApplicationCardSkeleton />
          </div>
        ) : applications.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center">
            <p className="text-[13px] text-gray-600">
              No applications available.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {applications.map((application) => {
              const defaultTechniqueStats = {
                evoguard: 0,
              };

              const runCounts =
                runsByApplicationAndTechnique.get(application.id) ??
                defaultTechniqueStats;
              const maliciousCounts =
                maliciousByApplicationAndTechnique.get(application.id) ??
                defaultTechniqueStats;
              const benignCounts =
                benignByApplicationAndTechnique.get(application.id) ??
                defaultTechniqueStats;
              const readinessByTechnique: Record<TechniqueKey, number> = {
                evoguard: application.memoryReadinessByTechnique.evoguard,
              };

              return (
                <ApplicationCard
                  key={application.id}
                  application={application}
                  tracesCount={
                    traceIdsByApplication.get(application.id)?.size ?? 0
                  }
                  readinessByTechnique={readinessByTechnique}
                  runsByTechnique={runCounts}
                  maliciousByTechnique={maliciousCounts}
                  benignByTechnique={benignCounts}
                  lastRunByTechnique={
                    lastRunByApplicationAndTechnique.get(application.id) ?? {}
                  }
                  statsLoading={investigationsLoading}
                  statsError={investigationsError}
                  onNavigate={navigate}
                  onAddTrace={(app) =>
                    openStartInvestigationDrawer({
                      mode: "start-investigation",
                      defaultApplicationId: app.id,
                      sourceInvestigationName: app.name,
                      lockApplicationSelection: true,
                    })
                  }
                  onRunInvestigation={(appId) =>
                    openStartInvestigationDrawer({
                      mode: "run-detector",
                      defaultApplicationId: appId,
                    })
                  }
                />
              );
            })}
          </div>
        )}
      </section>
    </Layout>
  );
}
