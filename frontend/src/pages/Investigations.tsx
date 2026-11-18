import {
  LuChevronLeft,
  LuChevronRight,
  LuClipboardList,
  LuPlay,
  LuSearch,
  LuSearchX,
} from "react-icons/lu";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Layout } from "../components/Layout";
import { TechniqueBadge } from "../components/TechniqueBadge";
import { VeredictBadge } from "../components/VeredictBadge";
import { useInvestigations } from "../hooks/useInvestigations";
import { useApplications } from "../hooks/useApplications";
import { useStartInvestigationDrawer } from "../hooks/useStartInvestigationDrawer";
import type { Investigation } from "../utils/investigationStore";
import { investigationMatchesListQuery } from "../utils/investigationFinding";
import { formatTraceDisplayName } from "../utils/portfolio";
import { getDisplayTechnique } from "../utils/techniques";

const PAGE_SIZE = 10;

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;
  if (totalSeconds < 3600) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
}

function runDurationLabel(inv: Investigation): string {
  if (
    typeof inv.durationSeconds === "number" &&
    Number.isFinite(inv.durationSeconds)
  ) {
    return formatDuration(inv.durationSeconds * 1000);
  }

  const startedAt = inv.startedAt;
  if (!startedAt) {
    if (inv.status === "pending" || inv.status === "started") {
      return "Running...";
    }
    return "-";
  }

  if (inv.completedAt) {
    return formatDuration(inv.completedAt - startedAt);
  }

  return "Running...";
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function FindingCell({ inv }: { inv: Investigation }) {
  const isRunning = inv.status === "pending" || inv.status === "started";
  if (isRunning) {
    return (
      <span className="sev-warning inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-medium uppercase tracking-[0.12em] animate-pulse">
        Running
      </span>
    );
  }

  return <VeredictBadge verdict={inv.verdict} />;
}

export function Investigations() {
  const { investigations } = useInvestigations(undefined, {
    enableStream: false,
  });
  const { applications } = useApplications();
  const { openStartInvestigationDrawer } = useStartInvestigationDrawer();
  const appMap = new Map(applications.map((a) => [a.id, a.name]));
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState(
    () => searchParams.get("q") ?? "",
  );
  const [appFilter, setAppFilter] = useState(
    () => searchParams.get("app") ?? "",
  );
  const [verdictFilter, setVerdictFilter] = useState(
    () => searchParams.get("verdict") ?? "",
  );
  const [page, setPage] = useState(1);
  const [expandedApps, setExpandedApps] = useState<Set<string>>(new Set());

  const uniqueAppIds = [
    ...new Set(investigations.map((inv) => inv.applicationId)),
  ];

  const query = search.trim();
  const filtered = investigations.filter((inv) => {
    if (query && !investigationMatchesListQuery(inv, query)) {
      return false;
    }
    if (appFilter && inv.applicationId !== appFilter) return false;
    if (verdictFilter && inv.verdict !== verdictFilter) return false;
    return true;
  });

  const investigationsByApp = new Map<
    string,
    { appName: string; investigations: Investigation[] }
  >();

  for (const app of applications) {
    const appInvs = filtered
      .filter((i) => i.applicationId === app.id)
      .sort((a, b) => b.createdAt - a.createdAt);

    if (appInvs.length > 0) {
      investigationsByApp.set(app.id, { appName: app.name, investigations: appInvs });
    }
  }

  for (const inv of filtered) {
    if (investigationsByApp.has(inv.applicationId)) {
      continue;
    }
    const matchingInvs = filtered
      .filter((i) => i.applicationId === inv.applicationId)
      .sort((a, b) => b.createdAt - a.createdAt);
    investigationsByApp.set(inv.applicationId, {
      appName: appMap.get(inv.applicationId) ?? "Unknown",
      investigations: matchingInvs,
    });
  }

  const appEntries = Array.from(investigationsByApp.entries());
  const totalPages = Math.max(1, Math.ceil(appEntries.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedAppEntries = appEntries.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  function writeListParams(next: {
    app?: string;
    verdict?: string;
    q?: string;
  }) {
    const params: Record<string, string> = {};
    if (next.app) {
      params.app = next.app;
    }
    if (next.verdict) {
      params.verdict = next.verdict;
    }
    const query = next.q?.trim();
    if (query) {
      params.q = query;
    }
    setSearchParams(params, { replace: true });
  }

  function handleSearch(value: string) {
    setSearch(value);
    setPage(1);
    writeListParams({ app: appFilter, verdict: verdictFilter, q: value });
  }

  function handleAppFilter(value: string) {
    setAppFilter(value);
    setPage(1);
    writeListParams({ app: value, verdict: verdictFilter, q: search });
  }

  function handleVerdictFilter(value: string) {
    setVerdictFilter(value);
    setPage(1);
    writeListParams({ app: appFilter, verdict: value, q: search });
  }

  const hasActiveFilters =
    search !== "" ||
    appFilter !== "" ||
    verdictFilter !== "";

  function clearFilters() {
    setSearch("");
    setAppFilter("");
    setVerdictFilter("");
    setPage(1);
    setSearchParams({}, { replace: true });
  }

  function toggleApp(appId: string) {
    setExpandedApps((prev) => {
      const next = new Set(prev);
      if (next.has(appId)) next.delete(appId);
      else next.add(appId);
      return next;
    });
  }

  return (
    <Layout
      pageTitle="Investigations"
      pageActions={
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
      }
    >
      <div className="flex flex-col gap-6 py-2">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="ioc-title text-3xl">Investigations</h1>
            <p className="ioc-copy mt-3 max-w-2xl text-[15px]">
              Completed Detective Agent runs. Start a new investigation to
              choose or create an application, pick or upload a trace, then
              detect.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <LuSearch
              size={14}
              className="ioc-faint pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search by name, ID, or finding"
              className="ioc-field ioc-field-with-icon w-56"
            />
          </div>
          <select
            value={appFilter}
            onChange={(e) => handleAppFilter(e.target.value)}
            className="ioc-field"
          >
            <option value="">All applications</option>
            {uniqueAppIds.map((id) => (
              <option key={id} value={id}>
                {appMap.get(id) ?? id}
              </option>
            ))}
          </select>
          <select
            value={verdictFilter}
            onChange={(e) => handleVerdictFilter(e.target.value)}
            className="ioc-field"
          >
            <option value="">All verdicts</option>
            <option value="malicious">Malicious</option>
            <option value="benign">Benign</option>
            <option value="error">Error</option>
          </select>
          {hasActiveFilters && (
            <button type="button" onClick={clearFilters} className="ioc-btn-ghost">
              <LuSearchX size={14} />
              Clear filters
            </button>
          )}
        </div>

        {investigations.length === 0 ? (
          <div className="ioc-glass flex flex-col items-center justify-center gap-3 rounded-xl px-6 py-16">
            <LuClipboardList size={36} className="ioc-faint" />
            <p className="ioc-copy text-sm">No investigations yet</p>
            <p className="ioc-faint max-w-md text-center text-sm font-light">
              Start an investigation to choose an application, pick a trace, and
              run Detective.
            </p>
            <button
              type="button"
              onClick={() =>
                openStartInvestigationDrawer({ mode: "start-investigation" })
              }
              className="ioc-btn-primary mt-1"
            >
              <LuPlay size={14} />
              Start investigation
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="ioc-glass flex flex-col items-center justify-center gap-3 rounded-xl px-6 py-16">
            <LuSearchX size={36} className="ioc-faint" />
            <p className="ioc-copy text-sm">No investigations match your search</p>
          </div>
        ) : (
          <>
            <div className="ioc-glass overflow-hidden rounded-xl">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] table-auto">
                  <thead>
                    <tr className="ioc-hairline border-b">
                      <th className="ioc-th">Application</th>
                      <th className="ioc-th">Investigation</th>
                      <th className="ioc-th">Description</th>
                      <th className="ioc-th">Detector</th>
                      <th className="ioc-th">Finding</th>
                      <th className="ioc-th ioc-th-right">When</th>
                      <th className="ioc-th ioc-th-right">Model</th>
                      <th className="ioc-th ioc-th-right">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--ioc-glass-border)]">
                    {paginatedAppEntries.map(
                      ([appId, { appName, investigations: appInvs }]) => {
                        const latestInv = appInvs[0];
                        const isExpanded = expandedApps.has(appId);
                        const visibleInvs = isExpanded ? appInvs : [latestInv];

                        return visibleInvs.map((inv, index) => {
                          const compactDescription = inv.description
                            ?.split(" ")
                            .slice(0, 12)
                            .join(" ")
                            .trim();

                          return (
                            <tr
                              key={inv.id}
                              className="ioc-click-row"
                              onClick={() =>
                                navigate(`/investigations/${inv.id}`)
                              }
                            >
                              {index === 0 ? (
                                <td
                                  rowSpan={visibleInvs.length}
                                  className="ioc-hairline box-border border-r px-4 py-3.5 align-top"
                                >
                                  <div className="ioc-fg w-full overflow-hidden whitespace-nowrap text-[14px] font-light leading-5">
                                    {appName}
                                  </div>
                                  <div className="ioc-faint mt-0.5 w-full overflow-hidden whitespace-nowrap text-[11px] leading-4">
                                    {appInvs.length} recent ·{" "}
                                    {isExpanded ? "expanded" : "latest shown"}
                                  </div>
                                  {appInvs.length > 1 ? (
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        toggleApp(appId);
                                      }}
                                      className="ioc-btn-ghost mt-2 px-2 py-1 text-[11px]"
                                    >
                                      {isExpanded
                                        ? `Hide ${appInvs.length - 1} run${appInvs.length - 1 > 1 ? "s" : ""}`
                                        : `Show ${appInvs.length - 1} more run${appInvs.length - 1 > 1 ? "s" : ""}`}
                                    </button>
                                  ) : null}
                                </td>
                              ) : null}
                              <td className="ioc-fg px-4 py-3.5 text-[13px] font-light leading-5">
                                {formatTraceDisplayName(inv.name)}
                              </td>
                              <td className="ioc-copy px-4 py-3.5 text-[12px] leading-4">
                                {compactDescription &&
                                compactDescription.length > 0
                                  ? compactDescription
                                  : "-"}
                              </td>
                              <td className="px-4 py-3.5 whitespace-nowrap">
                                <TechniqueBadge
                                  technique={getDisplayTechnique(
                                    inv.technique,
                                    inv.effectiveTechnique,
                                  )}
                                />
                              </td>
                              <td className="px-4 py-3.5 whitespace-nowrap">
                                <FindingCell inv={inv} />
                              </td>
                              <td className="ioc-copy whitespace-nowrap px-4 py-3.5 text-right text-[12px] tabular-nums leading-4">
                                {relativeTime(inv.createdAt)}
                              </td>
                              <td className="ioc-copy whitespace-nowrap px-4 py-3.5 text-right text-[12px] leading-4">
                                {inv.model ?? "-"}
                              </td>
                              <td className="ioc-copy whitespace-nowrap px-4 py-3.5 text-right text-[12px] leading-4">
                                {runDurationLabel(inv)}
                              </td>
                            </tr>
                          );
                        });
                      },
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="ioc-hairline flex items-center justify-between border-t pt-4">
              <span className="ioc-copy text-sm">
                {filtered.length} investigation
                {filtered.length !== 1 ? "s" : ""}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className="ioc-icon-btn"
                  aria-label="Previous page"
                >
                  <LuChevronLeft size={16} />
                </button>
                <span className="ioc-fg text-sm font-light">
                  {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  className="ioc-icon-btn"
                  aria-label="Next page"
                >
                  <LuChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
