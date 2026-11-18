import { useMemo, useRef, useState } from "react";
import { LuPlay, LuSearch, LuSearchX } from "react-icons/lu";
import { Layout } from "../components/Layout";
import { useStartInvestigationDrawer } from "../hooks/useStartInvestigationDrawer";
import { useTraceManager } from "../hooks/useTraceManager";
import { demoShuffleSeed, formatTraceDisplayName, seededShuffle } from "../utils/portfolio";

function relativeTimeLabel(timestampMs: number): string {
  if (!Number.isFinite(timestampMs)) {
    return "-";
  }

  const diffMs = Math.max(0, Date.now() - timestampMs);
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function renderLabelBadge(label: "malicious" | "benign" | null) {
  if (label === "malicious") {
    return (
      <span className="inline-flex items-center rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
        Malicious
      </span>
    );
  }

  if (label === "benign") {
    return (
      <span className="inline-flex items-center rounded-md border border-green-200 bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">
        Benign
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-gray-500">
      Unlabeled
    </span>
  );
}

export function TraceManager() {
  const { traces, loading, error } = useTraceManager();
  const { openStartInvestigationDrawer } = useStartInvestigationDrawer();
  const [search, setSearch] = useState("");
  const [appFilter, setAppFilter] = useState("");
  const [labelFilter, setLabelFilter] = useState<"" | "malicious" | "benign" | "unlabeled">("");
  const shuffleSeedRef = useRef<string>("");
  if (!shuffleSeedRef.current) {
    shuffleSeedRef.current = demoShuffleSeed();
  }

  const appOptions = useMemo(
    () =>
      Array.from(
        new Map(
          traces
            .filter((trace) => trace.appId && trace.appName)
            .map((trace) => [trace.appId as string, trace.appName as string]),
        ).entries(),
      ),
    [traces],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return traces.filter((trace) => {
      if (
        q &&
        !trace.traceName.toLowerCase().includes(q) &&
        !trace.traceFileId.toLowerCase().includes(q) &&
        !(trace.appName ?? "").toLowerCase().includes(q)
      ) {
        return false;
      }

      if (appFilter && trace.appId !== appFilter) {
        return false;
      }

      if (labelFilter === "unlabeled" && trace.latestLabel !== null) {
        return false;
      }

      if ((labelFilter === "malicious" || labelFilter === "benign") && trace.latestLabel !== labelFilter) {
        return false;
      }

      return true;
    });
  }, [traces, search, appFilter, labelFilter]);

  const orderedTraces = useMemo(
    () =>
      seededShuffle(
        filtered,
        (trace) => trace.traceFileId,
        shuffleSeedRef.current,
      ),
    [filtered],
  );

  const hasActiveFilters = search !== "" || appFilter !== "" || labelFilter !== "";

  return (
    <Layout pageTitle="Trace manager">
      <div className="flex flex-col flex-1 px-6 py-5">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold leading-none text-gray-900 tracking-tight">Trace manager</h1>
            <p className="text-sm text-gray-500">{filtered.length} of {traces.length} traces</p>
          </div>
          <button
            type="button"
            onClick={() =>
              openStartInvestigationDrawer({ mode: "start-investigation" })
            }
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <LuPlay size={12} />
            Start investigation
          </button>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative">
            <LuSearch
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search trace id, app…"
              className="w-72 rounded-md border border-gray-300 bg-white py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>

          <select
            value={appFilter}
            onChange={(e) => setAppFilter(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900"
          >
            <option value="">All apps</option>
            {appOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>

          <select
            value={labelFilter}
            onChange={(e) => setLabelFilter(e.target.value as "" | "malicious" | "benign" | "unlabeled")}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900"
          >
            <option value="">All labels</option>
            <option value="benign">Benign</option>
            <option value="malicious">Malicious</option>
            <option value="unlabeled">Unlabeled</option>
          </select>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setAppFilter("");
                setLabelFilter("");
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-900"
            >
              <LuSearchX size={14} />
              Clear filters
            </button>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 shadow-sm bg-white overflow-hidden">
          <table className="w-full table-auto">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-[0.1em] px-4 py-2.5">Trace</th>
                <th className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-[0.1em] px-4 py-2.5">App</th>
                <th className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-[0.1em] px-4 py-2.5">Label</th>
                <th className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-[0.1em] px-4 py-2.5">Investigations</th>
                <th className="text-right text-[10px] font-semibold text-gray-500 uppercase tracking-[0.1em] px-4 py-2.5">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td className="px-4 py-8 text-sm text-gray-500" colSpan={5}>
                    Loading traces...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td className="px-4 py-8 text-sm text-red-600" colSpan={5}>
                    {error}
                  </td>
                </tr>
              ) : traces.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-sm text-gray-500" colSpan={5}>
                    No traces uploaded yet.
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-sm text-gray-500" colSpan={5}>
                    No traces match your current filters.
                  </td>
                </tr>
              ) : (
                orderedTraces.map((trace) => (
                  <tr
                    key={trace.traceFileId}
                    className="transition-colors"
                  >
                    <td className="px-4 py-3.5 text-[13px] leading-5 text-gray-800">
                      <span className="font-mono text-gray-400 text-[11px]">{formatTraceDisplayName(trace.traceName)}</span>
                    </td>
                    <td className="px-4 py-3.5 text-[13px] font-medium leading-5">{trace.appName ?? "-"}</td>
                    <td className="px-4 py-3.5">{renderLabelBadge(trace.latestLabel)}</td>
                    <td className="px-4 py-3.5 text-[13px] leading-5 text-gray-600">
                      {trace.investigationsCount} {trace.investigationsCount === 1 ? "run" : "runs"}
                    </td>
                    <td className="text-right text-[12px] leading-4 px-4 py-3.5 text-gray-500 whitespace-nowrap tabular-nums">
                      {relativeTimeLabel(trace.submittedAtMs)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
