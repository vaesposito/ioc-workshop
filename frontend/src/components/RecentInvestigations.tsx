import { useNavigate } from "react-router-dom";
import type { Application } from "../utils/applicationStore";
import type { Investigation } from "../utils/investigationStore";
import { formatTraceDisplayName } from "../utils/portfolio";
import { getDisplayTechnique } from "../utils/techniques";
import { TechniqueBadge } from "./TechniqueBadge";
import { VeredictBadge } from "./VeredictBadge";
import React, { useState } from "react";
import { BiArrowToRight } from "react-icons/bi";

interface RecentInvestigationsProps {
  investigations: Investigation[];
  applications: Application[];
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

function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
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
  if (typeof inv.durationSeconds === "number" && Number.isFinite(inv.durationSeconds)) {
    return formatDuration(inv.durationSeconds * 1000);
  }

  if (inv.startedAt && inv.completedAt) {
    return formatDuration(inv.completedAt - inv.startedAt);
  }

  if (inv.status === "pending" || inv.status === "started") {
    return "Running...";
  }

  return "-";
}

function formatCost(token: Investigation["token"]): string {
  if (typeof token === "number" && Number.isFinite(token)) {
    return new Intl.NumberFormat("en-US").format(Math.trunc(token));
  }
  return "-";
}

function FindingCell({ inv }: { inv: Investigation }) {
  const isRunning = inv.status === "pending" || inv.status === "started";
  if (isRunning) {
    return (
      <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-[11px] font-semibold text-blue-700 animate-pulse">
        Running
      </span>
    );
  }

  return <VeredictBadge verdict={inv.verdict} />;
}

function InvestigationCells({ inv }: { inv: Investigation }) {
  const compactDescription = inv.description?.split(" ").slice(0, 8).join(" ");

  return (
    <>
      <td className="px-4 py-3.5 text-[13px] leading-5 text-gray-800">
        <div className="font-medium">{formatTraceDisplayName(inv.name)}</div>
        {compactDescription ? (
          <div className="text-[11px] leading-4 text-gray-500 mt-0.5">
            {compactDescription}
          </div>
        ) : null}
      </td>
      <td className="px-4 py-3.5 whitespace-nowrap">
        <TechniqueBadge
          technique={getDisplayTechnique(inv.technique, inv.effectiveTechnique)}
        />
      </td>
      <td className="px-4 py-3.5 whitespace-nowrap">
        <FindingCell inv={inv} />
      </td>
      <td className="text-right text-[12px] leading-4 px-4 py-3.5 text-gray-500 whitespace-nowrap tabular-nums">
        {relativeTime(inv.createdAt)}
      </td>
      <td className="text-right px-4 py-3.5 text-[12px] leading-4 text-gray-600 whitespace-nowrap">
        {inv.model ?? "-"}
      </td>
      <td className="text-right px-4 py-3.5 text-[12px] leading-4 text-gray-600 whitespace-nowrap">
        {runDurationLabel(inv)}
      </td>
      <td className="text-right px-4 py-3.5 text-[12px] leading-4 text-gray-600 whitespace-nowrap">
        {formatCost(inv.token)}
      </td>
    </>
  );
}

export function RecentInvestigations({
  investigations,
  applications,
}: RecentInvestigationsProps) {
  const navigate = useNavigate();
  const [expandedApps, setExpandedApps] = useState<Set<string>>(new Set());

  function toggleApp(appId: string) {
    setExpandedApps((prev) => {
      const next = new Set(prev);
      if (next.has(appId)) next.delete(appId);
      else next.add(appId);
      return next;
    });
  }

  // Group investigations by app, sorted by date descending
  const investigationsByApp = new Map<
    string,
    { app: Application; investigations: typeof investigations }
  >();

  for (const app of applications) {
    const appInvs = investigations
      .filter((i) => i.applicationId === app.id)
      .sort((a, b) => b.createdAt - a.createdAt);

    if (appInvs.length > 0) {
      investigationsByApp.set(app.id, { app, investigations: appInvs });
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div className="flex gap-2 items-center">
          <h3>
            Recent investigations
          </h3>
          <p className="text-[11px] leading-4 text-gray-400 mt-0.5">
            Latest per application · earlier investigations grouped by application
          </p>
        </div>
        <button
          onClick={() => navigate("/investigations")}
          className="flex items-center gap-1 text-[12px] font-medium text-gray-500 hover:text-indigo-600 transition-colors"
        >
          View all
          <BiArrowToRight size={12} />
        </button>
      </div>
      {investigationsByApp.size === 0 ? (
        <p className="px-6 py-8 text-sm text-gray-400 text-center">
          No investigations yet
        </p>
      ) : (
        <table className="w-full table-auto">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left text-[10px] font-semibold text-slate-400 uppercase tracking-[0.1em] px-4 py-2.5">
                Application
              </th>
              <th className="text-left text-[10px] font-semibold text-slate-400 uppercase tracking-[0.1em] px-4 py-2.5">
                Investigation
              </th>
              <th className="text-left text-[10px] font-semibold text-slate-400 uppercase tracking-[0.1em] px-4 py-2.5">
                Detector
              </th>
              <th className="text-left text-[10px] font-semibold text-slate-400 uppercase tracking-[0.1em] px-4 py-2.5">
                Finding
              </th>
              <th className="text-right text-[10px] font-semibold text-slate-400 uppercase tracking-[0.1em] px-4 py-2.5">
                When
              </th>
              <th className="text-right text-[10px] font-semibold text-slate-400 uppercase tracking-[0.1em] px-4 py-2.5">
                Model
              </th>
              <th className="text-right text-[10px] font-semibold text-slate-400 uppercase tracking-[0.1em] px-4 py-2.5">
                Duration
              </th>
              <th className="text-right text-[10px] font-semibold text-slate-400 uppercase tracking-[0.1em] px-4 py-2.5">
                Cost
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 font-mono">
            {Array.from(investigationsByApp.entries()).map(
              ([appId, { app, investigations: appInvs }]) => {
                const latestInv = appInvs[0];
                const isExpanded = expandedApps.has(appId);
                const visibleInvs = isExpanded ? appInvs : [latestInv];

                return (
                  <React.Fragment key={appId}>
                    {visibleInvs.map((inv, index) => (
                      <tr
                        key={inv.id}
                        className="cursor-pointer hover:bg-gray-50/70"
                        onClick={() => navigate(`/investigations/${inv.id}`)}
                      >
                        {index === 0 ? (
                          <td
                            rowSpan={visibleInvs.length}
                            className="box-border border-r border-gray-100 px-4 py-3.5 align-top"
                          >
                            <div className="w-full whitespace-nowrap overflow-hidden box-border font-semibold text-[14px] leading-5 text-gray-900">
                              {app.name}
                            </div>
                            <div className="text-[11px] leading-4 text-gray-400 w-full box-border overflow-hidden whitespace-nowrap mt-0.5">
                              {appInvs.length} recent · {isExpanded ? "expanded" : "latest shown"}
                            </div>
                            {appInvs.length > 1 ? (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  toggleApp(appId);
                                }}
                                className="mt-2 inline-flex items-center rounded-md border border-gray-200 px-2 py-1 text-[11px] font-medium text-gray-600 hover:bg-gray-50"
                              >
                                {isExpanded ? `Hide ${appInvs.length - 1} run${appInvs.length - 1 > 1 ? "s" : ""}` : `Show ${appInvs.length - 1} more run${appInvs.length - 1 > 1 ? "s" : ""}`}
                              </button>
                            ) : null}
                          </td>
                        ) : null}
                        <InvestigationCells inv={inv} />
                      </tr>
                    ))}
                  </React.Fragment>
                );
              },
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
