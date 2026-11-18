import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { IconType } from "react-icons";
import {
  LuBedDouble,
  LuBot,
  LuCalendar,
  LuCloud,
  LuFileSpreadsheet,
  LuFilter,
  LuGlobe,
  LuLinkedin,
  LuMail,
  LuMessageSquare,
  LuPlane,
  LuTriangleAlert,
  LuUser,
  LuUtensils,
  LuWallet,
  LuWrench,
} from "react-icons/lu";
import { Link } from "react-router-dom";
import type { ApplicationCopy } from "../content/application-copy";
import { ExpandMark } from "./ExpandCue";
import { ToolTagList } from "./ToolTagList";
import {
  describeComponent,
  groupMaliciousCites,
  selectionKindLabel,
  type LaidOutGraph,
  type LaidOutNode,
  type MaliciousCite,
} from "../utils/componentGraph";
import { formatTraceDisplayName } from "../utils/portfolio";

function rootRemPx(): number {
  if (typeof window === "undefined") {
    return 16;
  }
  const raw = getComputedStyle(document.documentElement).fontSize;
  return Number.parseFloat(raw) || 16;
}

function discRadiusPx(kind: LaidOutNode["kind"], rem: number): number {
  return ((kind === "agent" ? 3.15 : 2.9) * rem) / 2;
}

const ELBOW_STUB = 26;
const ELBOW_CORNER = 9;

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

// A disc that a connector must not run across, in graph units.
interface Obstacle {
  x: number;
  y: number;
  r: number;
}

// Connectors are built in "along/across" space: along is the axis the graph
// flows on, across is the perpendicular one. That keeps one router for both the
// horizontal application graph and the vertical trace graph.
interface RoutePoint {
  along: number;
  across: number;
}

function segmentClear(
  from: RoutePoint,
  to: RoutePoint,
  horizontal: boolean,
  obstacles: Obstacle[],
): boolean {
  const onAlongAxis = Math.abs(to.across - from.across) < 0.01;
  const runsHorizontal = onAlongAxis ? horizontal : !horizontal;
  const start = onAlongAxis ? from.along : from.across;
  const end = onAlongAxis ? to.along : to.across;
  const fixed = onAlongAxis ? from.across : from.along;
  const lo = Math.min(start, end);
  const hi = Math.max(start, end);
  return !obstacles.some((obstacle) => {
    const centreAlong = runsHorizontal ? obstacle.x : obstacle.y;
    const centreFixed = runsHorizontal ? obstacle.y : obstacle.x;
    return (
      Math.abs(centreFixed - fixed) < obstacle.r &&
      centreAlong > lo - obstacle.r &&
      centreAlong < hi + obstacle.r
    );
  });
}

function routeClear(
  points: RoutePoint[],
  horizontal: boolean,
  obstacles: Obstacle[],
): boolean {
  for (let index = 1; index < points.length; index += 1) {
    if (!segmentClear(points[index - 1], points[index], horizontal, obstacles)) {
      return false;
    }
  }
  return true;
}

function samples(from: number, to: number, count: number): number[] {
  const out: number[] = [];
  for (let index = 1; index <= count; index += 1) {
    out.push(from + ((to - from) * index) / (count + 1));
  }
  return out;
}

// Prefer the shortest route that clears every other disc: a straight run, then
// a single bend, then a detour through a clear corridor. Length matters less
// than not drawing a line over a node.
function routePoints(
  alongStart: number,
  alongEnd: number,
  acrossStart: number,
  acrossEnd: number,
  horizontal: boolean,
  obstacles: Obstacle[],
): RoutePoint[] {
  const start: RoutePoint = { along: alongStart, across: acrossStart };
  const end: RoutePoint = { along: alongEnd, across: acrossEnd };
  const aligned = Math.abs(acrossEnd - acrossStart) < 1;
  const alongSpan = alongEnd - alongStart;
  const sign = Math.sign(alongSpan) || 1;

  if (aligned) {
    if (routeClear([start, end], horizontal, obstacles)) {
      return [start, end];
    }
  } else {
    const near =
      alongEnd - sign * Math.min(ELBOW_STUB, Math.abs(alongSpan) / 2);
    for (const turn of [near, ...samples(alongEnd, alongStart, 9)]) {
      const bend = [
        start,
        { along: turn, across: acrossStart },
        { along: turn, across: acrossEnd },
        end,
      ];
      if (routeClear(bend, horizontal, obstacles)) {
        return bend;
      }
    }
  }

  const lane = Math.min(ELBOW_STUB, Math.abs(alongSpan) / 3);
  const laneA = alongStart + sign * lane;
  const laneB = alongEnd - sign * lane;
  const corridors = [
    ...samples(acrossStart, acrossEnd, 7),
    acrossStart - 54,
    acrossStart + 54,
    acrossEnd - 54,
    acrossEnd + 54,
    acrossStart - 108,
    acrossStart + 108,
    acrossEnd - 108,
    acrossEnd + 108,
  ];
  for (const corridor of corridors) {
    const detour = [
      start,
      { along: laneA, across: acrossStart },
      { along: laneA, across: corridor },
      { along: laneB, across: corridor },
      { along: laneB, across: acrossEnd },
      end,
    ];
    if (routeClear(detour, horizontal, obstacles)) {
      return detour;
    }
  }

  if (aligned) {
    return [start, end];
  }
  const fallback = alongEnd - sign * Math.min(ELBOW_STUB, Math.abs(alongSpan) / 2);
  return [
    start,
    { along: fallback, across: acrossStart },
    { along: fallback, across: acrossEnd },
    end,
  ];
}

function roundedPath(points: Array<{ x: number; y: number }>): string {
  const parts = [`M ${round(points[0].x)} ${round(points[0].y)}`];
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const corner = points[index];
    const next = points[index + 1];
    const inLength =
      Math.hypot(corner.x - previous.x, corner.y - previous.y) || 1;
    const outLength = Math.hypot(next.x - corner.x, next.y - corner.y) || 1;
    const radius = Math.min(ELBOW_CORNER, inLength / 2, outLength / 2);
    const inX = corner.x - ((corner.x - previous.x) / inLength) * radius;
    const inY = corner.y - ((corner.y - previous.y) / inLength) * radius;
    const outX = corner.x + ((next.x - corner.x) / outLength) * radius;
    const outY = corner.y + ((next.y - corner.y) / outLength) * radius;
    parts.push(`L ${round(inX)} ${round(inY)}`);
    parts.push(
      `Q ${round(corner.x)} ${round(corner.y)} ${round(outX)} ${round(outY)}`,
    );
  }
  const last = points[points.length - 1];
  parts.push(`L ${round(last.x)} ${round(last.y)}`);
  return parts.join(" ");
}

function connectorPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  horizontal: boolean,
  obstacles: Obstacle[],
): string {
  const points = routePoints(
    horizontal ? x1 : y1,
    horizontal ? x2 : y2,
    horizontal ? y1 : x1,
    horizontal ? y2 : x2,
    horizontal,
    obstacles,
  );
  return roundedPath(
    points.map((point) =>
      horizontal
        ? { x: point.along, y: point.across }
        : { x: point.across, y: point.along },
    ),
  );
}

function edgeGeometry(
  from: LaidOutNode,
  to: LaidOutNode,
  fromR: number,
  toR: number,
  arrow: number,
  obstacles: Obstacle[],
  horizontal: boolean,
): { line: string; head: string } | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.hypot(dx, dy) < fromR + toR + arrow + 4) {
    return null;
  }
  const sx = Math.sign(dx) || 1;
  const sy = Math.sign(dy) || 1;
  // Leave and enter each disc along the dominant axis so both ends stay square.
  const x1 = horizontal ? from.x + sx * (fromR + 2) : from.x;
  const y1 = horizontal ? from.y : from.y + sy * (fromR + 2);
  const tipX = horizontal ? to.x - sx * (toR + 1.25) : to.x;
  const tipY = horizontal ? to.y : to.y - sy * (toR + 1.25);
  const ux = horizontal ? sx : 0;
  const uy = horizontal ? 0 : sy;
  const endX = tipX - ux * arrow;
  const endY = tipY - uy * arrow;
  const hx = -uy * arrow * 0.42;
  const hy = ux * arrow * 0.42;
  return {
    line: connectorPath(x1, y1, endX, endY, horizontal, obstacles),
    head: `M ${round(tipX)} ${round(tipY)} L ${round(endX + hx)} ${round(endY + hy)} L ${round(endX - hx)} ${round(endY - hy)} Z`,
  };
}

function edgeKey(from: string, to: string): string {
  return `${from}>${to}`;
}

function iconForNode(node: LaidOutNode): IconType {
  switch (node.id) {
    case "user":
      return LuUser;
    case "agent":
      return LuBot;
    case "email_tools":
      return LuMail;
    case "calendar_tools":
      return LuCalendar;
    case "drive_tools":
      return LuCloud;
    case "financial_transfer":
      return LuWallet;
    case "communication_tools":
      return LuMessageSquare;
    case "web_tools":
      return LuGlobe;
    case "linkedin_tools":
      return LuLinkedin;
    case "spam_filter_tools":
      return LuFilter;
    case "flight_tools":
      return LuPlane;
    case "hotel_tools":
      return LuBedDouble;
    case "restaurant_tools":
      return LuUtensils;
    case "excel_tools":
      return LuFileSpreadsheet;
    case "undeclared":
      return LuTriangleAlert;
    default:
      return LuWrench;
  }
}

function BubbleOrb({
  node,
  active,
  onActivate,
  onClear,
  onSelect,
  style,
}: {
  node: LaidOutNode;
  active: boolean;
  onActivate: () => void;
  onClear: () => void;
  onSelect: () => void;
  style?: CSSProperties;
}) {
  const Icon = iconForNode(node);
  return (
    <button
      type="button"
      className={`ioc-bubble-orb ${node.kind} ${
        node.malicious || node.undeclared ? "is-danger" : ""
      } ${active ? "is-active" : ""}`}
      style={style}
      aria-label={node.label}
      aria-pressed={active}
      onMouseEnter={onActivate}
      onMouseLeave={onClear}
      onFocus={onActivate}
      onBlur={onClear}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
    >
      <span className="ioc-bubble-disc">
        <Icon size={node.kind === "agent" ? 18 : 16} aria-hidden="true" />
      </span>
      <span className="ioc-bubble-orb-label">{node.label}</span>
    </button>
  );
}

type GraphPick =
  | { type: "node"; id: string }
  | { type: "edge"; id: string };

function MaliciousCiteList({
  cites,
  traceNameById,
}: {
  cites: MaliciousCite[];
  traceNameById?: Record<string, string>;
}) {
  const groups = groupMaliciousCites(cites, traceNameById).slice(0, 8);
  const [openKey, setOpenKey] = useState<string | null>(null);

  useEffect(() => {
    setOpenKey(null);
  }, [cites]);

  return (
    <div className="mt-3">
      <p className="text-[11px] uppercase tracking-[0.14em] text-[color:var(--sev-danger)]">
        Malicious
      </p>
      {groups.length === 0 ? (
        <p className="ioc-copy mt-1 text-[12px]">
          Cited in a malicious investigation of this trace.
        </p>
      ) : (
        <ul className="ioc-bubble-cite-list">
          {groups.map((group) => {
            const open = openKey === group.key;
            const traceHref =
              group.applicationId && group.traceFileId
                ? `/applications/${group.applicationId}/traces/${group.traceFileId}`
                : `/investigations/${group.steps[0]?.investigationId}`;
            const canExpand = group.steps.length > 0;
            return (
              <li key={group.key} className="ioc-bubble-cite-group">
                <div className="ioc-bubble-cite-line">
                  {canExpand ? (
                    <button
                      type="button"
                      className="ioc-bubble-cite-toggle"
                      aria-expanded={open}
                      title={open ? "Hide steps" : "Show steps"}
                      onClick={(event) => {
                        event.stopPropagation();
                        setOpenKey(open ? null : group.key);
                      }}
                    >
                      <ExpandMark open={open} />
                    </button>
                  ) : (
                    <span className="ioc-bubble-cite-toggle" aria-hidden="true" />
                  )}
                  <span className="ioc-bubble-cite-kicker">Trace</span>
                  <Link
                    to={traceHref}
                    className="ioc-link ioc-bubble-cite-name"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {formatTraceDisplayName(group.traceLabel)}
                  </Link>
                </div>
                {open ? (
                  <ul className="ioc-bubble-cite-steps">
                    {group.steps.slice(0, 8).map((step) => {
                      const href = step.evidenceId
                        ? `/investigations/${step.investigationId}?evidence=${encodeURIComponent(step.evidenceId)}`
                        : `/investigations/${step.investigationId}`;
                      const stepMark =
                        step.stepLabel.match(/\[(\d+)\]/)?.[0] ??
                        step.stepLabel;
                      const numbered = Boolean(
                        step.stepLabel.match(/\[(\d+)\]/),
                      );
                      return (
                        <li key={step.key} className="ioc-bubble-cite-line">
                          <span className="ioc-bubble-cite-kicker">
                            {numbered ? "Step" : "Evidence"}
                          </span>
                          <Link
                            to={href}
                            className="ioc-link ioc-bubble-cite-name"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {stepMark}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function ComponentBubbleGraph({
  graph,
  caption,
  showEdges = true,
  showNodeCount = true,
  usage = "trace",
  horizontal = false,
  framed = true,
  collapsible = false,
  defaultOpen = true,
  expandSignal,
  traceNameById,
  appDetail,
}: {
  graph: LaidOutGraph;
  caption?: string;
  showEdges?: boolean;
  showNodeCount?: boolean;
  usage?: "application" | "trace";
  horizontal?: boolean;
  framed?: boolean;
  collapsible?: boolean;
  defaultOpen?: boolean;
  expandSignal?: number;
  traceNameById?: Record<string, string>;
  appDetail?: ApplicationCopy["detail"];
}) {
  const isHorizontal = Boolean(horizontal);
  const [open, setOpen] = useState(defaultOpen);

  // Lets a parent expand the panel programmatically (e.g. on completion).
  useEffect(() => {
    if (expandSignal && expandSignal > 0) {
      setOpen(true);
    }
  }, [expandSignal]);
  const [selected, setSelected] = useState<GraphPick | null>(null);
  const [hovered, setHovered] = useState<GraphPick | null>(null);
  const highlight = selected ?? hovered;
  const highlightNodeId = highlight?.type === "node" ? highlight.id : null;
  const highlightEdgeId = highlight?.type === "edge" ? highlight.id : null;
  const pinned = selected != null;
  const activeNode =
    selected?.type === "node"
      ? graph.nodes.find((node) => node.id === selected.id) ?? null
      : null;
  const activeEdge =
    selected?.type === "edge"
      ? graph.edges.find((edge) => edgeKey(edge.from, edge.to) === selected.id) ??
        null
      : null;
  const edgeFrom = activeEdge
    ? graph.nodes.find((node) => node.id === activeEdge.from)
    : null;
  const edgeTo = activeEdge
    ? graph.nodes.find((node) => node.id === activeEdge.to)
    : null;

  const svgRef = useRef<SVGSVGElement>(null);
  const [stageWidth, setStageWidth] = useState(0);
  const rem = useMemo(() => rootRemPx(), [graph.width, graph.height]);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) {
      return;
    }
    const update = () => {
      setStageWidth(el.getBoundingClientRect().width);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [graph.width, graph.height, showEdges]);

  const scale = stageWidth > 8 ? stageWidth / Math.max(graph.width, 1) : 1;
  const arrow = 7 / scale;
  function radiusFor(node: LaidOutNode): number {
    return discRadiusPx(node.kind, rem) / scale;
  }

  function selectNode(id: string) {
    setHovered(null);
    setSelected({ type: "node", id });
  }

  function selectEdge(id: string) {
    setHovered(null);
    setSelected({ type: "edge", id });
  }

  function edgeState(from: string, to: string): "on" | "idle" {
    const key = edgeKey(from, to);
    return highlightEdgeId === key ||
      (selected?.type === "edge" && selected.id === key)
      ? "on"
      : "idle";
  }

  return (
    <section className={framed ? "ioc-glass overflow-hidden rounded-xl" : ""}>
      <header
        className={
          framed
            ? "ioc-hairline flex items-start justify-between gap-3 border-b px-4 py-3"
            : "flex items-start justify-between gap-3 px-0 pb-2"
        }
      >
        <div>
          {collapsible ? (
            <button
              type="button"
              className="ioc-collapse-head"
              aria-expanded={open}
              onClick={() => setOpen((value) => !value)}
            >
              <span className="ioc-kicker">Components</span>
              <ExpandMark open={open} />
            </button>
          ) : (
            <p className="ioc-kicker">Components</p>
          )}
          {caption ? (
            <p className="ioc-faint mt-1 text-[12px] font-light">{caption}</p>
          ) : null}
        </div>
        {showNodeCount ? (
          <p className="ioc-faint text-[12px]">
            {graph.nodes.length} node{graph.nodes.length === 1 ? "" : "s"}
          </p>
        ) : null}
      </header>
      {collapsible && !open ? null : (
      <div
        className={`ioc-bubble-graph ${showEdges ? "" : "is-compact"} ${
          isHorizontal ? "is-horizontal" : "is-vertical"
        } ${framed ? "" : "is-bare"} ${
          activeNode || activeEdge ? "has-detail" : ""
        }`}
        onClick={() => setSelected(null)}
      >
        {showEdges ? (
          <div
            className="ioc-bubble-stage"
            style={
              {
                "--ioc-graph-w": Math.max(graph.width, 1),
                "--ioc-graph-h": Math.max(graph.height, 1),
              } as CSSProperties
            }
          >
            <svg
              ref={svgRef}
              viewBox={`0 0 ${Math.max(graph.width, 1)} ${Math.max(graph.height, 1)}`}
              className="ioc-bubble-graph-svg"
              preserveAspectRatio="xMidYMid meet"
              fill="none"
              role="img"
              aria-label="Component graph"
              onClick={() => setSelected(null)}
            >
              {graph.edges.map((edge) => {
                const from = graph.nodes.find((node) => node.id === edge.from);
                const to = graph.nodes.find((node) => node.id === edge.to);
                if (!from || !to) {
                  return null;
                }
                const geometry = edgeGeometry(
                  from,
                  to,
                  radiusFor(from),
                  radiusFor(to),
                  arrow,
                  graph.nodes
                    .filter(
                      (node) => node.id !== edge.from && node.id !== edge.to,
                    )
                    .map((node) => ({
                      x: node.x,
                      y: node.y,
                      r: radiusFor(node) + 6,
                    })),
                  isHorizontal,
                );
                if (!geometry) {
                  return null;
                }
                const key = edgeKey(edge.from, edge.to);
                const state = edgeState(edge.from, edge.to);
                return (
                  <g key={key}>
                    <title>{`${from.label} → ${to.label} · ${edge.count} call${edge.count === 1 ? "" : "s"}`}</title>
                    <path
                      d={geometry.line}
                      fill="none"
                      // Safari honours vector-effect only as an attribute, not
                      // from CSS, so the scaled viewBox would resize strokes.
                      vectorEffect="non-scaling-stroke"
                      className="ioc-bubble-edge-hit"
                      onMouseEnter={() =>
                        setHovered({ type: "edge", id: key })
                      }
                      onMouseLeave={() => setHovered(null)}
                      onClick={(event) => {
                        event.stopPropagation();
                        selectEdge(key);
                      }}
                    />
                    <path
                      d={geometry.line}
                      fill="none"
                      vectorEffect="non-scaling-stroke"
                      className={`ioc-bubble-edge is-${state}${
                        edge.malicious ? " is-danger" : ""
                      }`}
                    />
                    <path
                      d={geometry.head}
                      className={`ioc-bubble-arrow is-${state}${
                        edge.malicious ? " is-danger" : ""
                      }`}
                    />
                  </g>
                );
              })}
            </svg>
            {graph.nodes.map((node) => (
              <BubbleOrb
                key={node.id}
                node={node}
                active={highlightNodeId === node.id}
                onActivate={() => setHovered({ type: "node", id: node.id })}
                onClear={() => setHovered(null)}
                onSelect={() => selectNode(node.id)}
                style={{
                  left: `${(node.x / graph.width) * 100}%`,
                  top: `${(node.y / graph.height) * 100}%`,
                }}
              />
            ))}
          </div>
        ) : (
          <div className="ioc-bubble-orbs">
            {graph.nodes.map((node) => (
              <BubbleOrb
                key={node.id}
                node={node}
                active={highlightNodeId === node.id}
                onActivate={() => setHovered({ type: "node", id: node.id })}
                onClear={() => setHovered(null)}
                onSelect={() => selectNode(node.id)}
              />
            ))}
          </div>
        )}
        {activeEdge && edgeFrom && edgeTo ? (
          <div
            className={`ioc-bubble-tooltip ioc-glass ${pinned ? "is-pinned" : ""}`}
            role="status"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="ioc-bubble-cite-kicker">Selected path</p>
            <p className="ioc-fg mt-1 text-[14px] font-light">
              {edgeFrom.label} → {edgeTo.label}
            </p>
            <p className="ioc-copy mt-2 text-[12px] leading-5">
              {usage === "application"
                ? edgeFrom.id === "user" && edgeTo.id === "agent"
                  ? "The user communicates with the agentic app."
                  : `The agentic app is linked to ${edgeTo.label}.`
                : `${edgeFrom.label} called ${edgeTo.label} ${activeEdge.count} time${
                    activeEdge.count === 1 ? "" : "s"
                  } in this trace.`}
            </p>
          </div>
        ) : activeNode ? (
          <div
            className={`ioc-bubble-tooltip ioc-glass ${pinned ? "is-pinned" : ""}`}
            role="status"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="ioc-bubble-cite-kicker">
              {usage === "application" && activeNode.kind === "agent"
                ? "Selected agentic app"
                : selectionKindLabel(activeNode.kind)}
            </p>
            <p className="ioc-fg mt-1 text-[14px] font-light">
              {activeNode.label}
            </p>
            <p className="ioc-copy mt-2 text-[12px] leading-5">
              {usage === "application" && activeNode.id === "agent"
                ? "The agentic application the user talks to. Every tool component is linked to it."
                : describeComponent(activeNode.id)}
            </p>
            {usage === "application" && activeNode.id === "agent" && appDetail ? (
              <div className="mt-3">
                <p className="ioc-copy text-[12px] leading-5">
                  {appDetail.lead}
                </p>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {appDetail.components.map((item) => (
                    <li
                      key={item.label}
                      className="ioc-copy text-[12px] leading-5"
                    >
                      <span className="ioc-fg font-medium">{item.label}:</span>{" "}
                      {item.text}
                    </li>
                  ))}
                </ul>
                <p className="ioc-copy mt-2 text-[12px] leading-5">
                  {appDetail.note}
                </p>
              </div>
            ) : null}
            {usage === "application" ? (
              activeNode.kind === "agent" && appDetail ? null : (
                <p className="ioc-copy mt-2 text-[12px]">
                  {activeNode.kind === "user"
                    ? "Talks to the agentic app in this application."
                    : activeNode.kind === "agent"
                      ? "Receives the user task and calls the linked components."
                      : "Available in this application."}
                </p>
              )
            ) : showEdges ? (
              activeNode.calls > 0 ? (
                <p className="ioc-copy mt-2 text-[12px]">
                  {activeNode.calls} call{activeNode.calls === 1 ? "" : "s"} in
                  this trace
                  {activeNode.kind === "tool"
                    ? ` of ${activeNode.label.toLowerCase()} tools`
                    : ""}
                  .
                </p>
              ) : (
                <p className="ioc-copy mt-2 text-[12px]">
                  Not used in this trace.
                </p>
              )
            ) : (
              <p className="ioc-copy mt-2 text-[12px]">
                Available in this application.
              </p>
            )}
            {activeNode.undeclared ? (
              <p className="ioc-copy mt-2 text-[12px] leading-5">
                Tool called not present in app manifest.
              </p>
            ) : null}
            {activeNode.tools.length > 0 ? (
              <div className="mt-3">
                <p className="ioc-bubble-cite-kicker">Tools</p>
                <div className="mt-2.5">
                  <ToolTagList tools={activeNode.tools} />
                </div>
              </div>
            ) : null}
            {showEdges && activeNode.malicious ? (
              <MaliciousCiteList
                cites={activeNode.cites}
                traceNameById={traceNameById}
              />
            ) : null}
          </div>
        ) : null}
      </div>
      )}
    </section>
  );
}
