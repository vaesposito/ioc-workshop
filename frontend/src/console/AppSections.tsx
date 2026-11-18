import { useMemo, useState } from "react";
import {
  LuArrowDown,
  LuArrowUp,
  LuCheck,
  LuPencil,
  LuPlus,
  LuSearch,
  LuTriangleAlert,
} from "react-icons/lu";

import { Link } from "react-router-dom";

import { DebateSection } from "../components/DebateSection";

import { ConsoleDial } from "./ConsoleDial";
import { ConsoleTraceRow } from "./ConsoleTraceRow";
import { compact } from "./consoleData";
import {
  PROTOCOL_OFFERS,
  usualCost,
  type AppDetail,
  type Protocol,
  type ProtocolBlock,
} from "./appDetailData";
import { isPicked, type Pickable } from "./pick";

/** Red through amber to green, by how well a reading is doing. */
function band(value: number): string {
  if (value < 0.4) return "#f05252";
  if (value < 0.7) return "#f6a356";
  return "#04a4ca";
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

type Props = { detail: AppDetail } & Pickable;

/**
 * What the application was pushed at: the calls it was refused, where they
 * fell, and the traces an investigation has or has not been through.
 */
export function SecuritySection({ detail, pick, onPick }: Props) {
  const { summary } = detail;
  const calls = summary.authorizedCalls + summary.deniedCalls;
  const looked = detail.sessions.filter((run) => run.investigated);
  const figures = [
    {
      id: "authorized",
      label: "Authorized calls",
      value: compact(summary.authorizedCalls),
    },
    {
      id: "denied",
      label: "Refused calls",
      value: `${summary.deniedCalls}`,
      bad: summary.deniedCalls > 0,
    },
    {
      id: "malicious",
      label: "Malicious traces",
      value: `${summary.maliciousTraces}`,
      bad: summary.maliciousTraces > 0,
    },
    {
      id: "looked",
      label: "Traces investigated",
      value: `${looked.length} of ${detail.sessions.length}`,
    },
  ];

  // Where the refusals fell: the share each tool took of them, worked out
  // from how often the runs reached for it.
  const reached = detail.tools.map((tool) => ({
    tool,
    runs: detail.sessions.filter((run) => run.tools.includes(tool)).length,
  }));
  const total = reached.reduce((sum, row) => sum + row.runs, 0) || 1;
  const refusals = reached
    .map((row) => ({
      ...row,
      share: row.runs / total,
      calls: Math.round((row.runs / total) * summary.deniedCalls),
    }))
    .filter((row) => row.calls > 0)
    .sort((left, right) => right.calls - left.calls);

  // What is off in a way worth a look: a session that broke down, and a
  // session that cost well over what the rest of them cost.
  const usual = usualCost(detail.sessions);
  const signs = detail.sessions
    .flatMap((run) => {
      const over = usual > 0 ? run.costScore / usual - 1 : 0;
      return [
        run.failures >= 2
          ? {
              id: `${run.id}-failures`,
              run: run.id,
              weight: run.failures,
              said: `${run.failures} cognitive failures in one session`,
              why: "Reasoning that broke down this often is either a bad run or a pushed one.",
            }
          : null,
        over >= 0.2
          ? {
              id: `${run.id}-cost`,
              run: run.id,
              weight: over * 10,
              said: `Cost ${percent(over)} over the usual session`,
              why: `${run.costScore} against the ${usual} this application usually spends.`,
            }
          : null,
      ];
    })
    .filter((sign): sign is NonNullable<typeof sign> => sign !== null)
    .sort((left, right) => right.weight - left.weight)
    .slice(0, 6);

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {figures.map((item) => (
          <div key={item.id} className="ioc-console-tile">
            <span className="ioc-console-stat-label">{item.label}</span>
            <span
              className="text-[18px] font-light"
              style={{ color: item.bad ? "#f05252" : "var(--ioc-text)" }}
            >
              {item.value}
            </span>
          </div>
        ))}
      </div>
      <p className="ioc-console-note mt-3">
        {percent(summary.deniedCalls / Math.max(calls, 1))} of what these agents
        reached for was outside what the application declares, and was refused
        before it went through.
      </p>

      {/* Nothing here is a finding. They are the things that are off in a
          way an attack would make them off, which is reason enough to look. */}
      <p className="ioc-kicker mt-7">Worth exploring</p>
      <p className="ioc-faint text-[11px] font-light">
        Sessions that broke down or cost more than they should. None of this is
        a security issue yet; an investigation is what would say.
      </p>
      {signs.length === 0 ? (
        <p className="ioc-faint mt-2 text-[11.5px] font-light">
          Nothing is out of the ordinary on this application.
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1.5">
          {signs.map((sign) => (
            <li key={sign.id}>
              <Link
                to={`/console/apps/${detail.app.id}/traces/${sign.run}`}
                className="ioc-console-sign"
                title={`Open ${sign.run}`}
              >
                <LuTriangleAlert size={13} className="shrink-0" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="ioc-fg block text-[12px]">{sign.said}</span>
                  <span className="ioc-faint block text-[11px] leading-[1.45] font-light">
                    {sign.why}
                  </span>
                </span>
                <span className="ioc-faint shrink-0 text-[11px] font-light">
                  {sign.run}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="ioc-kicker mt-7">Where the refusals fell</p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {refusals.map((row) => (
          <li key={row.tool}>
            <button
              type="button"
              aria-pressed={isPicked(pick, "tool", row.tool)}
              onClick={() =>
                onPick?.({ kind: "tool", id: row.tool, label: row.tool })
              }
              className={`ioc-console-bar-row${
                isPicked(pick, "tool", row.tool) ? " is-picked" : ""
              }`}
            >
              <span className="ioc-fg w-44 shrink-0 truncate text-[12px]">
                {row.tool}
              </span>
              <span className="ioc-console-meter" aria-hidden>
                <span
                  style={{
                    width: `${row.share * 100}%`,
                    background: "#f05252",
                  }}
                />
              </span>
              <span className="ioc-faint w-20 shrink-0 text-right text-[11px] font-light">
                {row.calls} refused
              </span>
            </button>
          </li>
        ))}
      </ul>

      <p className="ioc-kicker mt-7">Traces worth a look</p>
      <p className="ioc-faint text-[11px] font-light">
        The sessions that ended badly, and the ones an investigation has been
        through.
      </p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {detail.sessions
          .filter((run) => run.status !== "ok" || run.investigated)
          .map((run) => (
            <li key={run.id}>
              <ConsoleTraceRow
                appId={detail.app.id}
                session={run}
                usual={usual}
              />
            </li>
          ))}
      </ul>
    </div>
  );
}

export function HealthSection({ detail }: Props) {
  const tone = band(detail.healthScore);
  return (
    <div className="flex flex-col items-center">
      <ConsoleDial
        value={detail.healthScore}
        from={tone}
        to={tone}
        size={164}
        label={`Health score ${percent(detail.healthScore)}`}
      />
      <p className="ioc-console-dial-label">Health score</p>
    </div>
  );
}

/**
 * The console's own cyan, dim to bright, by how often a topic's answers held
 * up. Tone rather than traffic lights: nothing here is a verdict.
 */
function topicRgb(accuracy: number): [number, number, number] {
  const stops: { at: number; rgb: [number, number, number] }[] = [
    { at: 0, rgb: [74, 90, 112] },
    { at: 0.45, rgb: [40, 124, 160] },
    { at: 0.8, rgb: [4, 164, 202] },
    { at: 1, rgb: [126, 224, 240] },
  ];
  const share = Math.max(0, Math.min(1, accuracy));
  const upper =
    stops.find((stop) => share <= stop.at) ?? stops[stops.length - 1];
  const lower =
    [...stops].reverse().find((stop) => share >= stop.at) ?? stops[0];
  const span = upper.at - lower.at || 1;
  const mix = (share - lower.at) / span;
  return [0, 1, 2].map((index) =>
    Math.round(lower.rgb[index] + (upper.rgb[index] - lower.rgb[index]) * mix),
  ) as [number, number, number];
}

function paint(rgb: [number, number, number], lift = 0): string {
  const lit = rgb.map((channel) =>
    Math.round(channel + (255 - channel) * lift),
  );
  return `rgb(${lit[0]}, ${lit[1]}, ${lit[2]})`;
}

/** A point on the bloom, measured from the top and going clockwise. */
function onRing(centre: number, radius: number, degrees: number) {
  const radians = ((degrees - 90) * Math.PI) / 180;
  return {
    x: centre + Math.cos(radians) * radius,
    y: centre + Math.sin(radians) * radius,
  };
}

function arc(centre: number, radius: number, sweep: number): string {
  // A whole ring cannot be drawn as one arc, so it is held just short.
  const held = Math.min(sweep, 359.9);
  const from = onRing(centre, radius, 0);
  const to = onRing(centre, radius, held);
  return `M ${from.x} ${from.y} A ${radius} ${radius} 0 ${held > 180 ? 1 : 0} 1 ${to.x} ${to.y}`;
}

const BLOOM = 150;
const SWEEP = 300;

export function TopicsSection({ detail, pick, onPick }: Props) {
  const [over, setOver] = useState<string | null>(null);
  const ranked = [...detail.topics].sort(
    (left, right) => right.sessions - left.sessions,
  );
  const most = ranked[0]?.sessions ?? 1;
  const total = ranked.reduce((sum, topic) => sum + topic.sessions, 0);
  const lit = over ?? (pick?.kind === "topic" ? pick.id : null);

  const rings = ranked.map((topic, index) => ({
    topic,
    radius: 128 - index * 19,
    sweep: (topic.sessions / most) * SWEEP,
    rgb: topicRgb(topic.accuracy),
  }));

  return (
    <div>
      <div className="mt-2 flex flex-wrap items-center gap-8">
        <div className="relative">
          <svg
            viewBox={`0 0 ${BLOOM * 2} ${BLOOM * 2}`}
            className="ioc-console-bloom"
            aria-hidden
          >
            <defs>
              {rings.map((ring, index) => (
                <linearGradient
                  key={ring.topic.label}
                  id={`bloom-${index}`}
                  x1="0"
                  y1="0"
                  x2="1"
                  y2="1"
                >
                  <stop offset="0%" stopColor={paint(ring.rgb, 0.45)} />
                  <stop offset="100%" stopColor={paint(ring.rgb)} />
                </linearGradient>
              ))}
              <radialGradient id="bloom-core">
                <stop offset="0%" stopColor="rgba(4, 164, 202, 0.38)" />
                <stop offset="100%" stopColor="rgba(4, 164, 202, 0)" />
              </radialGradient>
            </defs>

            <circle cx={BLOOM} cy={BLOOM} r={60} fill="url(#bloom-core)" />

            {rings.map((ring, index) => {
              const on = lit === ring.topic.label;
              return (
                <g key={ring.topic.label}>
                  <path
                    d={arc(BLOOM, ring.radius, SWEEP)}
                    className="ioc-console-bloom-track"
                  />
                  <path
                    d={arc(BLOOM, ring.radius, ring.sweep)}
                    className={`ioc-console-bloom-arc${
                      lit && !on ? " is-far" : ""
                    }`}
                    stroke={`url(#bloom-${index})`}
                    strokeWidth={on ? 13 : 11}
                    style={{
                      filter: `drop-shadow(0 0 ${on ? 10 : 5}px ${paint(ring.rgb)})`,
                    }}
                  />
                </g>
              );
            })}
          </svg>

          <div className="ioc-console-bloom-core">
            <span className="ioc-fg text-[26px] font-light">{total}</span>
            <span className="ioc-faint text-[10.5px] font-light">sessions</span>
          </div>
        </div>

        <ul className="ioc-console-topics">
          {rings.map((ring) => {
            const on = isPicked(pick, "topic", ring.topic.label);
            return (
              <li key={ring.topic.label}>
                <button
                  type="button"
                  aria-pressed={on}
                  onMouseEnter={() => setOver(ring.topic.label)}
                  onMouseLeave={() => setOver(null)}
                  onFocus={() => setOver(ring.topic.label)}
                  onBlur={() => setOver(null)}
                  onClick={() =>
                    onPick?.({
                      kind: "topic",
                      id: ring.topic.label,
                      label: ring.topic.label,
                    })
                  }
                  className={`ioc-console-topic${on ? " is-picked" : ""}`}
                >
                  <span
                    className="ioc-console-topic-dot"
                    style={{
                      background: `linear-gradient(135deg, ${paint(ring.rgb, 0.45)}, ${paint(ring.rgb)})`,
                      boxShadow: `0 0 10px ${paint(ring.rgb)}`,
                    }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 text-left">
                    <span className="ioc-fg block truncate text-[12px] font-light">
                      {ring.topic.label}
                    </span>
                    <span className="ioc-console-topic-bar" aria-hidden>
                      <span
                        style={{
                          width: `${(ring.topic.sessions / most) * 100}%`,
                          background: `linear-gradient(90deg, ${paint(ring.rgb, 0.5)}, ${paint(ring.rgb)})`,
                        }}
                      />
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="ioc-fg block text-[12px] font-light">
                      {ring.topic.sessions}
                    </span>
                    <span
                      className="block text-[10.5px] font-light"
                      style={{ color: paint(ring.rgb, 0.2) }}
                    >
                      {percent(ring.topic.accuracy)} held
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <span className="ioc-console-stat-label">Answers held up</span>
        <span className="ioc-console-accuracy" aria-hidden />
        <span className="ioc-faint text-[10.5px] font-light">0% — 100%</span>
      </div>
    </div>
  );
}

type SortKey = "id" | "insight" | "spans" | "hours" | "code" | "session";

const COLUMNS: { key: SortKey; label: string; width: string }[] = [
  { key: "id", label: "Failure", width: "w-[8.5rem]" },
  { key: "insight", label: "Insight", width: "w-[14rem]" },
  { key: "code", label: "Cluster", width: "w-[5rem]" },
  { key: "session", label: "Trace", width: "w-[8.5rem]" },
  { key: "spans", label: "Spans", width: "w-[4.5rem]" },
  { key: "hours", label: "When", width: "w-[5rem]" },
];

export function FailuresSection({ detail, pick, onPick }: Props) {
  const [sort, setSort] = useState<{ key: SortKey; up: boolean }>({
    key: "hours",
    up: true,
  });
  const [query, setQuery] = useState("");

  // A cluster card above the list holds the list to that cluster; a row
  // holds the traces beside it to the trace the failure was found in.
  const cluster =
    pick?.kind === "failure" &&
    detail.failures.some((failure) => failure.code === pick.id)
      ? pick.id
      : null;

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const kept = detail.insights.filter((row) => {
      if (cluster && row.code !== cluster) return false;
      if (!needle) return true;
      return [row.id, row.insight, row.description, row.session, ...row.tags]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
    const turn = sort.up ? 1 : -1;
    return [...kept].sort((left, right) => {
      const a = left[sort.key];
      const b = right[sort.key];
      if (typeof a === "number" && typeof b === "number") {
        return (a - b) * turn;
      }
      return String(a).localeCompare(String(b)) * turn;
    });
  }, [cluster, detail.insights, query, sort]);

  const sortBy = (key: SortKey) =>
    setSort((current) =>
      current.key === key ? { key, up: !current.up } : { key, up: true },
    );

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {detail.failures.map((failure) => {
          const on = cluster === failure.code;
          return (
            <button
              key={failure.code}
              type="button"
              aria-pressed={on}
              onClick={() =>
                onPick?.({
                  kind: "failure",
                  id: failure.code,
                  label: failure.name,
                })
              }
              className={`ioc-console-tile is-link is-bad text-left${on ? " is-picked" : ""}`}
            >
              <span className="ioc-fg text-[12.5px] font-normal">
                {failure.name}
                <span className="ioc-faint ml-1.5 text-[11px]">
                  ({failure.code})
                </span>
              </span>
              <span className="ioc-copy text-[12px] font-light leading-[1.5]">
                {failure.what}
              </span>
              <span className="ioc-faint text-[11px] font-light">
                {failure.sessions} / {failure.of} sessions
              </span>
              <span className="ioc-console-meter" aria-hidden>
                <span
                  style={{
                    width: `${(failure.sessions / failure.of) * 100}%`,
                    background: "#f05252",
                  }}
                />
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <p className="ioc-kicker">Session failure insights</p>
        <label className="ioc-console-search is-inline">
          <LuSearch aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search insights"
            aria-label="Search failure insights"
          />
        </label>
        {cluster ? (
          <button
            type="button"
            onClick={() =>
              onPick?.({
                kind: "failure",
                id: cluster,
                label: cluster,
              })
            }
            className="ioc-link text-[11px]"
          >
            Clear {cluster}
          </button>
        ) : null}
        <span className="ioc-faint ml-auto text-[11px] font-light">
          {rows.length} of {detail.insights.length}
        </span>
      </div>

      <table className="ioc-console-table">
        <thead>
          <tr>
            {COLUMNS.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={column.width}
                aria-sort={
                  sort.key === column.key
                    ? sort.up
                      ? "ascending"
                      : "descending"
                    : "none"
                }
              >
                <button type="button" onClick={() => sortBy(column.key)}>
                  {column.label}
                  {sort.key === column.key ? (
                    sort.up ? (
                      <LuArrowUp aria-hidden />
                    ) : (
                      <LuArrowDown aria-hidden />
                    )
                  ) : null}
                </button>
              </th>
            ))}
            <th scope="col">Description</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const on = isPicked(pick, "failure", row.id);
            return (
              <tr
                key={row.id + row.ref}
                className={on ? "is-picked" : undefined}
                onClick={() =>
                  onPick?.({
                    kind: "failure",
                    id: row.id,
                    label: row.insight,
                  })
                }
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onPick?.({
                      kind: "failure",
                      id: row.id,
                      label: row.insight,
                    });
                  }
                }}
              >
                <td>
                  <span className="ioc-fg block text-[11.5px]">{row.id}</span>
                  <span className="ioc-faint block text-[10.5px]">
                    {row.ref}
                  </span>
                </td>
                <td>
                  <span className="ioc-console-insight">{row.insight}</span>
                </td>
                <td>
                  <span className="ioc-console-chip is-bad">{row.code}</span>
                </td>
                <td>
                  <Link
                    to={`/console/apps/${detail.app.id}/traces/${row.session}`}
                    onClick={(event) => event.stopPropagation()}
                    className="ioc-link text-[11.5px]"
                  >
                    {row.session}
                  </Link>
                </td>
                <td className="ioc-copy">{row.spans}</td>
                <td className="ioc-faint">{row.hours}h ago</td>
                <td>
                  <span className="ioc-copy block text-[11.5px] leading-[1.45]">
                    {row.description}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    {row.tags.map((tag) => (
                      <span key={tag} className="ioc-console-chip is-soft">
                        {tag}
                      </span>
                    ))}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length === 0 ? (
        <p className="ioc-faint mt-3 text-[11.5px] font-light">
          Nothing written up under that.
        </p>
      ) : null}
    </div>
  );
}

/** One measure of what a protocol takes, drawn as a row of bars. */
function UsagePanel({
  title,
  unit,
  rows,
}: {
  title: string;
  unit: string;
  rows: { code: string; value: number; said: string }[];
}) {
  const most = Math.max(...rows.map((row) => row.value), 1);
  return (
    <div className="ioc-console-tile">
      <span className="flex items-baseline justify-between gap-2">
        <span className="ioc-console-stat-label">{title}</span>
        <span className="ioc-faint text-[10px] font-light">{unit}</span>
      </span>
      <ul className="mt-1 flex flex-col gap-1.5">
        {rows.map((row) => (
          <li key={row.code} className="flex items-center gap-2">
            <span className="ioc-faint w-16 shrink-0 text-[10.5px] font-light">
              {row.code}
            </span>
            <span className="ioc-console-meter is-wide" aria-hidden>
              <span
                style={{
                  width: `${(row.value / most) * 100}%`,
                  background: "var(--ioc-kicker)",
                }}
              />
            </span>
            <span className="ioc-copy w-14 shrink-0 text-right text-[10.5px] font-light">
              {row.said}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Where the runs on one topic landed, from the tight middle to the tail. */
function SpreadRow({
  row,
  scale,
}: {
  row: AppDetail["cost"]["spread"][number];
  scale: number;
}) {
  const at = (value: number) => `${Math.min((value / scale) * 100, 100)}%`;
  const rgb = topicRgb(0.55 + (row.median / scale) * 0.4);
  const tone = paint(rgb);
  return (
    <li className="ioc-console-spread">
      <span className="ioc-copy truncate text-[11px] font-light">
        {row.topic}
      </span>
      <span className="ioc-console-spread-track">
        <span
          className="ioc-console-spread-whisker"
          style={{
            left: at(row.low),
            right: `${100 - (row.high / scale) * 100}%`,
          }}
        />
        <span
          className="ioc-console-spread-box"
          style={{
            left: at(row.q1),
            width: `${((row.q3 - row.q1) / scale) * 100}%`,
            borderColor: tone,
            background: `color-mix(in srgb, ${tone} 28%, transparent)`,
          }}
        />
        <span
          className="ioc-console-spread-median"
          style={{ left: at(row.median), background: tone }}
        />
        {row.points.map((point, index) => (
          <span
            key={index}
            className="ioc-console-spread-dot"
            style={{ left: at(point), background: tone }}
          />
        ))}
      </span>
    </li>
  );
}

export function CostSection({ detail }: Props) {
  const { cost, app } = detail;
  const [worst, setWorst] = useState(cost.worst[0]?.id ?? "");
  const shown = cost.worst.find((run) => run.id === worst) ?? cost.worst[0];
  const scale = Math.max(
    ...cost.spread.flatMap((row) => [...row.points, row.high]),
    10,
  );
  const tiles = [
    {
      id: "top-session",
      label: "Top cost contributor",
      value: cost.topSession,
    },
    { id: "top-topic", label: "Highest cost topic", value: cost.topTopic },
    {
      id: "efficient",
      label: "Efficient sessions",
      value: `${cost.efficientSessions}`,
    },
    {
      id: "waste",
      label: "Average waste per session",
      value: percent(cost.waste),
    },
  ];

  return (
    <div>
      <p className="ioc-copy text-[12px] leading-[1.55] font-light">
        {cost.note}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((item) => (
          <div key={item.id} className="ioc-console-tile">
            <span className="ioc-console-stat-label">{item.label}</span>
            <span className="ioc-fg text-[13px] font-light">{item.value}</span>
          </div>
        ))}
      </div>

      <DebateSection
        label="Protocol resource usage"
        preview="What each protocol takes on an average session"
      >
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <UsagePanel
            title="Tokens per session"
            unit="tokens"
            rows={cost.protocols.map((entry) => ({
              code: entry.code,
              value: entry.tokens,
              said: entry.tokens.toLocaleString(),
            }))}
          />
          <UsagePanel
            title="Cost per session"
            unit="USD"
            rows={cost.protocols.map((entry) => ({
              code: entry.code,
              value: entry.cost,
              said: `$${entry.cost.toFixed(2)}`,
            }))}
          />
          <UsagePanel
            title="Duration per session"
            unit="milliseconds"
            rows={cost.protocols.map((entry) => ({
              code: entry.code,
              value: entry.duration,
              said: `${entry.duration} ms`,
            }))}
          />
        </div>
      </DebateSection>

      <DebateSection
        label="Cost efficiency by topic"
        preview="Each session is a dot; a long tail to the right is where the money goes"
      >
        <ul className="ioc-console-spreads">
          {cost.spread.map((row) => (
            <SpreadRow key={row.topic} row={row} scale={scale} />
          ))}
        </ul>
        <p className="ioc-faint mt-1 text-center text-[10px] font-light">
          Cost efficiency score
        </p>
      </DebateSection>

      <DebateSection
        label="Least efficient sessions"
        preview="What pulled each of them down, and what held it up"
      >
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[14rem_minmax(0,1fr)]">
          <ul className="flex flex-col gap-1.5">
            {cost.worst.map((run) => (
              <li key={run.id}>
                <button
                  type="button"
                  aria-pressed={run.id === worst}
                  onClick={() => setWorst(run.id)}
                  className={`ioc-console-worst${run.id === worst ? " is-picked" : ""}`}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="ioc-fg text-[11.5px]">{run.id}</span>
                    <span className="ioc-fg text-[13px] font-light">
                      {run.score}
                    </span>
                  </span>
                  <span className="ioc-faint mt-0.5 block truncate text-[10.5px] font-light">
                    {run.topic}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {shown ? (
            <div className="ioc-console-tile">
              <span className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="ioc-fg text-[12.5px]">
                  {shown.id}
                  <span className="ioc-faint ml-2 text-[11px] font-light">
                    {shown.topic}
                  </span>
                </span>
                <span className="ioc-fg text-[15px] font-light">
                  {shown.score}
                </span>
              </span>
              <span className="ioc-faint text-[10.5px] font-light">
                What pulled this run's efficiency down, and what held it up.
              </span>
              <ul className="mt-2 flex flex-col gap-1">
                {shown.features.map((feature) => (
                  <li key={feature.label} className="ioc-console-feature">
                    <span className="ioc-copy truncate text-[10.5px] font-light">
                      {feature.label}
                    </span>
                    <span className="ioc-console-feature-track">
                      <span
                        className="ioc-console-feature-bar"
                        style={{
                          left: feature.weight >= 0 ? "50%" : undefined,
                          right: feature.weight < 0 ? "50%" : undefined,
                          width: `${Math.abs(feature.weight) * 45}%`,
                          background:
                            feature.weight >= 0 ? "#f05252" : "#04a4ca",
                        }}
                      />
                    </span>
                    <span className="ioc-faint w-10 shrink-0 text-right text-[10px] font-light">
                      {feature.weight > 0 ? "+" : ""}
                      {feature.weight}
                    </span>
                  </li>
                ))}
              </ul>
              <span className="mt-2 flex gap-4">
                <span className="ioc-faint flex items-center gap-1.5 text-[10px] font-light">
                  <span
                    className="ioc-console-key-dot"
                    style={{ background: "#f05252" }}
                  />
                  Reduces efficiency
                </span>
                <span className="ioc-faint flex items-center gap-1.5 text-[10px] font-light">
                  <span
                    className="ioc-console-key-dot"
                    style={{ background: "#04a4ca" }}
                  />
                  Increases efficiency
                </span>
              </span>
            </div>
          ) : null}
        </div>

        <p className="ioc-faint mt-5 text-[11px] font-light">
          {compact(app.tokens)} tokens over the period,{" "}
          {app.costChange > 0 ? "up" : "down"}{" "}
          {Math.abs(Math.round(app.costChange * 100))}% against the one before.
        </p>
      </DebateSection>
    </div>
  );
}

export function ReasoningSection({ detail, pick, onPick }: Props) {
  const { columns, links, outcome, of } = detail.reasoning;
  const rows = Math.max(...columns.map((column) => column.nodes.length), 1);
  const span = 100 / columns.length;
  const gutter = 2.6;

  // Where each step sits in the grid, so the wires can be drawn behind the
  // cards without measuring anything at runtime.
  const seats = new Map<string, { column: number; row: number }>();
  columns.forEach((column, index) =>
    column.nodes.forEach((node, row) =>
      seats.set(node.title, { column: index, row }),
    ),
  );

  const busiest = Math.max(...links.map((link) => link.traces), 1);
  const picked = pick?.kind === "step" ? pick.id : null;

  // The outcome is only worth saying if it also says what caused it, so the
  // step that failed and the ones still open are named here.
  const seated = columns.flatMap((column) =>
    column.nodes.map((node) => ({ node, stage: column.title })),
  );
  const broke = seated.find((entry) => entry.node.tone === "bad");
  const watching = seated.filter((entry) => entry.node.tone === "watch");

  return (
    <div>
      <p className="ioc-console-outcome is-alone">Outcome: {outcome}</p>

      {broke ? (
        <p className="ioc-copy mt-2 text-[12px] leading-[1.55] font-light">
          Because{" "}
          <button
            type="button"
            onClick={() =>
              onPick?.({
                kind: "step",
                id: broke.node.title,
                label: `${broke.node.title} · ${broke.node.status}`,
              })
            }
            className="ioc-link"
          >
            {broke.node.title.toLowerCase()}
          </button>{" "}
          {broke.node.status.toLowerCase()} in {broke.stage.toLowerCase()},{" "}
          {broke.node.step.toLowerCase()}: {broke.node.body.toLowerCase()}
          {watching.length > 0 ? (
            <>
              {" "}
              {watching.length === 1
                ? "One step is"
                : `${watching.length} steps are`}{" "}
              still open:{" "}
              {watching.map((entry, index) => (
                <span key={entry.node.title}>
                  {index > 0
                    ? index === watching.length - 1
                      ? " and "
                      : ", "
                    : ""}
                  <button
                    type="button"
                    onClick={() =>
                      onPick?.({
                        kind: "step",
                        id: entry.node.title,
                        label: `${entry.node.title} · ${entry.node.status}`,
                      })
                    }
                    className="ioc-link"
                  >
                    {entry.node.title.toLowerCase()}
                  </button>
                </span>
              ))}
              .
            </>
          ) : null}
        </p>
      ) : watching.length > 0 ? (
        <p className="ioc-copy mt-2 text-[12px] leading-[1.55] font-light">
          Nothing broke down.{" "}
          {watching.length === 1
            ? "One step is"
            : `${watching.length} steps are`}{" "}
          still open, which is what holds the answer short of standing on its
          own.
        </p>
      ) : (
        <p className="ioc-copy mt-2 text-[12px] leading-[1.55] font-light">
          Every step held, and the answer was checked before it went out.
        </p>
      )}

      <div className="ioc-console-path-scroll ioc-no-scrollbar">
        <div className="ioc-console-path">
          <div
            className="ioc-console-path-heads"
            style={{
              gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`,
            }}
          >
            {columns.map((column) => (
              <p key={`head-${column.title}`} className="ioc-kicker">
                {column.title}
              </p>
            ))}
          </div>

          <div
            className="ioc-console-path-cards"
            style={{
              gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
            }}
          >
            <svg
              className="ioc-console-path-wires"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden
            >
              {links.map((link) => {
                const from = seats.get(link.from);
                const to = seats.get(link.to);
                if (!from || !to) return null;
                const x1 = (from.column + 1) * span - gutter / 2;
                const x2 = to.column * span + gutter / 2;
                const y1 = ((from.row + 0.5) * 100) / rows;
                const y2 = ((to.row + 0.5) * 100) / rows;
                const bend = (x2 - x1) / 2;
                const near =
                  !picked || link.from === picked || link.to === picked;
                return (
                  <path
                    key={`${link.from}-${link.to}`}
                    d={`M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`}
                    className={`ioc-console-wire${link.tone === "bad" ? " is-bad" : ""}${
                      near ? "" : " is-far"
                    }`}
                    strokeWidth={0.8 + (link.traces / busiest) * 3.2}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            </svg>

            {Array.from({ length: rows }, (_, row) =>
              columns.map((column) => {
                const node = column.nodes[row];
                if (!node) {
                  return <span key={`${column.title}-${row}`} />;
                }
                const on = isPicked(pick, "step", node.title);
                return (
                  <button
                    key={node.title}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      onPick?.({
                        kind: "step",
                        id: node.title,
                        label: `${node.title} · ${node.status}`,
                      })
                    }
                    className={`ioc-console-step is-${node.tone} is-link text-left${
                      on ? " is-picked" : ""
                    }`}
                  >
                    <span className="ioc-fg text-[12px] font-normal">
                      {node.title}
                    </span>
                    <span className={`ioc-console-step-tag is-${node.tone}`}>
                      {node.status}
                    </span>
                    <span className="ioc-copy mt-1.5 block text-[11.5px] leading-[1.45] font-light">
                      {node.body}
                    </span>
                    <span className="ioc-faint mt-1.5 block text-[10.5px] font-light">
                      {node.step}
                    </span>
                  </button>
                );
              }),
            )}
          </div>
        </div>
      </div>

      <ul className="ioc-console-path-key">
        <li>
          <span className="ioc-console-wire-key is-thin" aria-hidden />
          Few traces
        </li>
        <li>
          <span className="ioc-console-wire-key is-thick" aria-hidden />
          Most traces, up to {of}
        </li>
        <li>
          <span className="ioc-console-wire-key is-bad" aria-hidden />
          Where the trouble travels
        </li>
      </ul>
    </div>
  );
}

export function MetricsSection({ detail, pick, onPick }: Props) {
  // The three are read against each other, so they stand side by side and
  // all the way open.
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-3">
      {detail.metrics.map((group) => {
        const weakest = group.metrics.reduce((low, metric) =>
          metric.value < low.value ? metric : low,
        );
        return (
          <div key={group.title} className="min-w-0">
            <p className="ioc-kicker">{group.title}</p>
            <p className="ioc-faint text-[11px] font-light">
              Weakest {weakest.label.toLowerCase()} at {percent(weakest.value)}.
            </p>
            <ul className="mt-2 flex flex-col gap-1">
              {group.metrics.map((metric) => {
                const on = isPicked(pick, "metric", metric.label);
                return (
                  <li key={metric.label}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        onPick?.({
                          kind: "metric",
                          id: metric.label,
                          label: `${metric.label} ${percent(metric.value)}`,
                        })
                      }
                      className={`ioc-console-metric-row is-stacked${on ? " is-picked" : ""}`}
                    >
                      <span className="flex w-full items-baseline justify-between gap-2">
                        <span className="ioc-copy truncate text-left text-[11.5px] font-light">
                          {metric.label}
                        </span>
                        <span className="ioc-fg shrink-0 text-[11.5px] font-light">
                          {percent(metric.value)}
                        </span>
                      </span>
                      <span className="ioc-console-meter mt-1" aria-hidden>
                        <span
                          style={{
                            width: `${metric.value * 100}%`,
                            background: band(metric.value),
                          }}
                        />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function ProtocolBlockBody({
  block,
  code,
  pick,
  onPick,
}: { block: ProtocolBlock; code: string } & Pickable) {
  const most = Math.max(...(block.bars ?? []).map((bar) => bar.value), 1);
  return (
    <div className="mt-3">
      <p className="ioc-kicker">{block.title}</p>
      {block.note ? (
        <p className="ioc-faint mt-1 text-[11px] font-light">{block.note}</p>
      ) : null}

      {block.chips ? (
        <div className="mt-2 flex flex-col gap-2">
          {block.chips.map((group) => (
            <div key={group.label}>
              <p className="ioc-faint text-[10.5px] font-light">
                {group.label}
              </p>
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {group.names.map((name) => (
                  <li key={name}>
                    <button
                      type="button"
                      aria-pressed={isPicked(pick, "agent", name)}
                      onClick={() =>
                        onPick?.({ kind: "agent", id: name, label: name })
                      }
                      className={`ioc-console-tag is-link${
                        isPicked(pick, "agent", name) ? " is-picked" : ""
                      }`}
                    >
                      {name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}

      {block.terms ? (
        <ul className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
          {block.terms.map((term) => {
            const id = `${code}:${term.name}`;
            const on = isPicked(pick, "protocol", id);
            return (
              <li key={term.name}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    onPick?.({
                      kind: "protocol",
                      id,
                      label: `${code} · ${term.name}`,
                    })
                  }
                  className={`ioc-console-term${on ? " is-picked" : ""}`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="ioc-fg text-[11.5px]">{term.name}</span>
                    <span className={`ioc-console-step-tag is-${term.tone}`}>
                      {term.status}
                    </span>
                  </span>
                  <span className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                    {term.figures.map((figure) => (
                      <span key={figure.label} className="flex flex-col">
                        <span className="ioc-faint text-[10px] font-light">
                          {figure.label}
                        </span>
                        <span className="ioc-copy text-[11px] font-light">
                          {figure.value}
                        </span>
                      </span>
                    ))}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {block.bars ? (
        <ul className="mt-2 flex flex-col gap-1.5">
          {block.bars.map((bar) => (
            <li key={bar.label} className="ioc-console-bar-row is-read">
              <span className="ioc-copy w-20 shrink-0 text-left text-[11px] font-light">
                {bar.label}
              </span>
              <span className="ioc-console-meter is-wide" aria-hidden>
                <span
                  style={{
                    width: `${(bar.value / most) * 100}%`,
                    background: "var(--ioc-kicker)",
                  }}
                />
              </span>
              <span className="ioc-faint w-24 shrink-0 text-right text-[11px] font-light">
                {bar.value.toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ProtocolCard({
  protocol,
  open,
  onToggle,
  pick,
  onPick,
}: {
  protocol: Protocol;
  open: boolean;
  onToggle: () => void;
} & Pickable) {
  return (
    <DebateSection
      label={protocol.code}
      preview={`${protocol.name} · ${percent(protocol.share)} of the run`}
      open={open}
      onOpenChange={onToggle}
    >
      <div>
        <div className="flex flex-wrap items-center gap-5">
          <ConsoleDial
            value={protocol.share}
            from="#04a4ca"
            to="#7ee0f0"
            size={92}
            label={`${protocol.code} ${percent(protocol.share)}`}
          />
          <p className="ioc-copy min-w-[12rem] flex-1 text-[12px] leading-[1.5] font-light">
            {protocol.what}
          </p>
          <div className="flex flex-wrap gap-5">
            {protocol.figures.map((figure) => (
              <div key={figure.label} className="flex flex-col gap-1">
                <span className="ioc-console-stat-label">{figure.label}</span>
                <span className="ioc-fg text-[14px] font-light">
                  {figure.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
          {protocol.tiles.map((tile) => (
            <div key={tile.label} className="ioc-console-tile">
              <span className="ioc-console-stat-label">{tile.label}</span>
              <span className="ioc-fg text-[12.5px] font-light">
                {tile.value}
              </span>
              <span className="ioc-faint text-[10.5px] font-light">
                {tile.note}
              </span>
            </div>
          ))}
        </div>

        {protocol.blocks.map((block) => (
          <ProtocolBlockBody
            key={block.title}
            block={block}
            code={protocol.code}
            pick={pick}
            onPick={onPick}
          />
        ))}
      </div>
    </DebateSection>
  );
}

export function ProtocolsSection({
  detail,
  pick,
  onPick,
  picking = false,
  onAdded,
}: Props & {
  /** Opened straight into the list to pick from, from a banner. */
  picking?: boolean;
  /** Called the first time a protocol is put on. */
  onAdded?: () => void;
}) {
  // One protocol is open at a time, and what is open is what the traces
  // beside it are held to.
  const [open, setOpen] = useState<string | null>(
    detail.protocols[0]?.code ?? null,
  );
  // Which protocols are on. The list is read as it stands; picking from it
  // is a thing you go into, so the reading is not a form.
  const [on, setOn] = useState<string[]>(
    detail.protocols.map((entry) => entry.code),
  );
  const [editing, setEditing] = useState(picking);

  const offered = PROTOCOL_OFFERS.filter(
    (offer) => !detail.protocols.some((entry) => entry.code === offer.code),
  );
  const rows = [
    ...detail.protocols.map((entry) => ({
      code: entry.code,
      name: entry.name,
      what: entry.what,
    })),
    ...offered,
  ];
  const left = rows.filter((row) => !on.includes(row.code));
  const live = detail.protocols.filter((entry) => on.includes(entry.code));
  const added = offered.filter((offer) => on.includes(offer.code));

  const toggle = (code: string) =>
    setOn((current) => {
      if (current.includes(code)) {
        return current.filter((entry) => entry !== code);
      }
      onAdded?.();
      return [...current, code];
    });

  const terms = live.reduce(
    (count, protocol) =>
      count +
      protocol.blocks.reduce(
        (inner, block) => inner + (block.terms?.length ?? 0),
        0,
      ),
    0,
  );
  const busiest = live.reduce<Protocol | null>(
    (top, protocol) => (!top || protocol.share > top.share ? protocol : top),
    null,
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="ioc-faint text-[11.5px] font-light">
          {on.length === 0
            ? "No protocol is running on this application."
            : `${on.length} ${on.length === 1 ? "protocol is" : "protocols are"} running on this application.`}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setEditing((shown) => !shown)}
            className="ioc-console-act is-quiet"
          >
            {editing ? <LuCheck size={13} /> : <LuPencil size={13} />}
            {editing ? "Done" : "Edit"}
          </button>
          {/* With nothing left to put on, the only move is taking one off. */}
          <button
            type="button"
            disabled={left.length === 0}
            onClick={() => setEditing(true)}
            title={
              left.length === 0
                ? "Every protocol is already running. Edit the list to take one off."
                : `${left.length} more can be put on this application.`
            }
            className="ioc-console-act"
          >
            <LuPlus size={13} />
            Add cognition protocol
          </button>
        </div>
      </div>

      {editing ? (
        <ul className="ioc-console-picks">
          {rows.map((row) => {
            const lit = on.includes(row.code);
            return (
              <li key={row.code}>
                <button
                  type="button"
                  aria-pressed={lit}
                  onClick={() => toggle(row.code)}
                  className={`ioc-console-pick${lit ? " is-on" : ""}`}
                  title={lit ? `Take ${row.code} off` : `Put ${row.code} on`}
                >
                  <span className="ioc-console-pick-mark" aria-hidden>
                    {lit ? <LuCheck size={11} /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className="ioc-fg block text-left text-[12.5px]">
                      {row.code} · {row.name}
                    </span>
                    <span className="ioc-faint block text-left text-[11px] leading-[1.45] font-light">
                      {row.what}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-3">
        {[
          {
            label: "Active protocols",
            value: `${on.length}`,
            note: on.length > 0 ? on.join(" · ") : "Nothing running",
          },
          {
            label: "Coordination terms",
            value: `${terms}`,
            note: "Locked and scored across the session",
          },
          {
            label: "Largest token share",
            value: busiest ? percent(busiest.share) : "—",
            note: busiest ? busiest.code : "Nothing running",
          },
        ].map((tile) => (
          <div key={tile.label} className="ioc-console-tile">
            <span className="ioc-console-stat-label">{tile.label}</span>
            <span className="ioc-fg text-[16px] font-light">{tile.value}</span>
            <span className="ioc-faint text-[10.5px] font-light">
              {tile.note}
            </span>
          </div>
        ))}
      </div>

      {added.length === 0 ? null : (
        <ul className="mt-4 flex flex-col gap-1.5">
          {added.map((offer) => (
            <li key={offer.code} className="ioc-console-move is-settled">
              <p className="ioc-fg text-[12.5px]">
                {offer.code} · {offer.name}
              </p>
              <p className="ioc-faint mt-1 text-[11px] leading-[1.45] font-light">
                Put on just now. Nothing has run under it yet.
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="ioc-debate-stack mt-5">
        {live.map((protocol) => (
          <ProtocolCard
            key={protocol.code}
            protocol={protocol}
            open={open === protocol.code}
            onToggle={() => {
              const next = open === protocol.code ? null : protocol.code;
              setOpen(next);
              if (next) {
                onPick?.({
                  kind: "protocol",
                  id: next,
                  label: next,
                });
              }
            }}
            pick={pick}
            onPick={onPick}
          />
        ))}
      </div>
    </div>
  );
}
