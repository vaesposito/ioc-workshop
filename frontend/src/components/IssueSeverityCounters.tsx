import {
  LuCircleAlert,
  LuCircleSlash,
  LuInfo,
  LuTriangleAlert,
} from "react-icons/lu";
import type { IconType } from "react-icons";
import type {
  IssueSeverity,
  IssueSeverityCounts,
} from "../utils/portfolio";
import { issueCountTotal } from "../utils/portfolio";

const LEVELS: {
  key: IssueSeverity;
  label: string;
  Icon: IconType;
  textClass: string;
}[] = [
  {
    key: "critical",
    label: "Critical",
    Icon: LuCircleSlash,
    textClass: "sev-critical-text",
  },
  {
    key: "high",
    label: "High",
    Icon: LuCircleAlert,
    textClass: "sev-high-text",
  },
  {
    key: "medium",
    label: "Medium",
    Icon: LuTriangleAlert,
    textClass: "sev-medium-text",
  },
  {
    key: "low",
    label: "Low",
    Icon: LuInfo,
    textClass: "sev-low-text",
  },
];

function breakdownLabel(counts: IssueSeverityCounts): string {
  const parts = LEVELS.map(
    (level) => `${counts[level.key]} ${level.label.toLowerCase()}`,
  );
  return `Total ${issueCountTotal(counts)}. ${parts.join(", ")}.`;
}

export function IssueSeverityCounters({
  counts,
  showTotal = true,
  align = "end",
  emptyLabel = "No issues",
}: {
  counts: IssueSeverityCounts;
  showTotal?: boolean;
  align?: "start" | "end";
  emptyLabel?: string | null;
}) {
  const total = issueCountTotal(counts);
  const visible = LEVELS.filter((level) => counts[level.key] > 0);
  const alignClass = align === "end" ? "items-end" : "items-start";

  return (
    <div
      className={`group relative z-0 flex flex-col gap-1.5 hover:z-40 focus-visible:z-40 ${alignClass}`}
      tabIndex={0}
      aria-label={breakdownLabel(counts)}
    >
      <div className="flex items-center gap-1.5">
        {showTotal ? (
          <span className="ioc-faint text-[11px] font-light tracking-wide">
            Total {total}
          </span>
        ) : null}
        {total === 0 ? (
          emptyLabel ? (
            <span className="ioc-faint text-[11px] font-light">{emptyLabel}</span>
          ) : (
            <span className="ioc-faint">—</span>
          )
        ) : (
          visible.map((level) => {
            const value = counts[level.key];
            const Icon = level.Icon;
            return (
              <span
                key={level.key}
                className={`inline-flex items-center gap-1 ${level.textClass}`}
              >
                <Icon size={13} aria-hidden />
                <span className="text-[12px] font-medium tabular-nums leading-none">
                  {value}
                </span>
              </span>
            );
          })
        )}
      </div>

      <div
        role="tooltip"
        className={`ioc-tooltip pointer-events-none invisible absolute top-full z-30 mt-2 opacity-0 transition-opacity group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100 ${
          align === "end" ? "right-0" : "left-0"
        }`}
      >
        <p className="ioc-kicker mb-2">Issues by severity</p>
        <ul className="space-y-1.5">
          {LEVELS.map((level) => {
            const Icon = level.Icon;
            return (
              <li
                key={level.key}
                className="flex items-center justify-between gap-6 text-[12px]"
              >
                <span className={`inline-flex items-center gap-1.5 ${level.textClass}`}>
                  <Icon size={13} aria-hidden />
                  {level.label}
                </span>
                <span className="tabular-nums text-[color:var(--ioc-text)]">
                  {counts[level.key]}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
