import { ConsoleDial } from "./ConsoleDial";
import type { AppDetail } from "./appDetailData";

/** Red through amber to green, by how well a reading is doing. */
function band(value: number): string {
  if (value < 0.4) return "#f05252";
  if (value < 0.7) return "#f6a356";
  return "#04a4ca";
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

interface Widget {
  id: string;
  label: string;
  /** What the ring is filled to, as a share of one. */
  value: number;
  /** What is read in large: a share, or a count where that is the point. */
  figure: string;
  tone: string;
  /** What the ring stands for, where the figure alone does not say it. */
  said?: string;
  /** The reading this opens, where there is one behind it. */
  opens?: string;
}

/**
 * The four readings the application is summed up by: health, the two angles
 * it is made of, and what was found. A label, a number, and a ring each;
 * anything more belongs in the reading itself.
 */
export function ConsoleOverview({
  detail,
  onOpen,
}: {
  detail: AppDetail;
  onOpen: (view: string) => void;
}) {
  const { summary } = detail;
  // The ring stands for how much of the record is affected, not for a score:
  // it fills as more traces are caught up in something.
  const caught = detail.sessions.filter(
    (session) => session.failures > 0,
  ).length;
  const share = caught / Math.max(detail.sessions.length, 1);
  const alarm = share > 0.3 ? "#f05252" : share > 0.1 ? "#f6a356" : "#04a4ca";

  const widgets: Widget[] = [
    {
      id: "health",
      label: "Health score",
      value: summary.health,
      figure: percent(summary.health),
      tone: band(summary.health),
      said: "How well it runs and how well it holds against being pushed at, read as one figure.",
    },
    {
      id: "performance",
      label: "Performance",
      value: summary.performance,
      figure: percent(summary.performance),
      tone: band(summary.performance),
      said: `${summary.fatalErrors} sessions stopped before answering, ${summary.minorErrors} answered the wrong way.`,
      opens: "metrics",
    },
    {
      id: "security",
      label: "Security",
      value: summary.security,
      figure: percent(summary.security),
      tone: band(summary.security),
      said: `${summary.deniedCalls} calls refused, ${summary.maliciousTraces} traces came back malicious.`,
    },
    {
      id: "failures",
      label: "Failures",
      value: share,
      figure: `${summary.cognitiveFailures}`,
      tone: alarm,
      said: `${summary.cognitiveFailures} cognitive failures across ${caught} of ${detail.sessions.length} traces`,
      opens: "failures",
    },
  ];

  return (
    <ul className="ioc-console-overview">
      {widgets.map((widget) => {
        const body = (
          <>
            <span className="min-w-0 flex-1">
              <span className="ioc-console-stat-label">{widget.label}</span>
              <span className="ioc-fg mt-1 block text-[24px] leading-none font-light">
                {widget.figure}
              </span>
            </span>
            <ConsoleDial
              value={widget.value}
              from={widget.tone}
              to={widget.tone}
              size={46}
              bare
              label={widget.said ?? `${widget.label} ${percent(widget.value)}`}
            />
          </>
        );

        return (
          <li key={widget.id}>
            {widget.opens ? (
              <button
                type="button"
                onClick={() => onOpen(widget.opens as string)}
                className="ioc-console-widget is-link"
              >
                {body}
              </button>
            ) : (
              <div className="ioc-console-widget">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
