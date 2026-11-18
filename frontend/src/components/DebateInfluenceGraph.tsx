import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { LuX } from "react-icons/lu";
import { DebateLinkTip } from "./DebateLinkTip";
import { FloatingTip, pointInBox } from "./FloatingTip";
import { modelIconFor } from "./ModelMark";
import { describeModel } from "../utils/modelBadge";
import {
  answerWithoutLetter,
  linkOutcomeDescription,
  linkOutcomeLabel,
  seatTone,
  turnTone,
  type DebateEdge,
  type DebateSeat,
  type DebateTurn,
  type LinkCategory,
} from "../utils/madDebates";

// Agents sit on a ring rather than the application graph's left-to-right flow:
// every seat talks to every other, so there is no direction to lay out along.
const STAGE_W = 320;
const STAGE_H = 300;
const CENTER_X = STAGE_W / 2;
const CENTER_Y = 146;
const ORBIT = 98;
// How far off the centre a line passes, so a pair that cites each other
// still reads as two lines rather than one drawn twice.
/** How far a directional arrow bows out from the straight line. */
const BOW = 26;
const ARROW = 8;

function rootRemPx(): number {
  if (typeof window === "undefined") {
    return 16;
  }
  return (
    Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
  );
}

interface Placed {
  seat: DebateSeat;
  turn?: DebateTurn;
  x: number;
  y: number;
}

function placeSeats(seats: DebateSeat[], turns: DebateTurn[]): Placed[] {
  return seats.map((seat, index) => {
    const angle = (-90 + (360 / seats.length) * index) * (Math.PI / 180);
    return {
      seat,
      turn: turns.find((turn) => turn.seat === seat.id),
      x: CENTER_X + ORBIT * Math.cos(angle),
      y: CENTER_Y + ORBIT * Math.sin(angle),
    };
  });
}

/**
 * A line between two orbs. Where the arrows carry a direction they bow
 * around the outside, one way or the other depending on seat order, so a
 * pair that moved each other draws two arcs rather than one line with a
 * head at each end. Where they carry none — the report's picture of the
 * whole run — they run straight through a hub in the middle instead, which
 * is one line per pair however many turns are behind it.
 */
function edgeGeometry(
  from: Placed,
  to: Placed,
  flip: boolean,
  radius: number,
  plain = false,
) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  // What the line bends around: the hub in plain mode, a point off to one
  // side of the midpoint otherwise.
  const bow = flip ? -BOW : BOW;
  const control = plain
    ? { x: CENTER_X, y: CENTER_Y }
    : {
        x: (from.x + to.x) / 2 + (-dy / length) * bow,
        y: (from.y + to.y) / 2 + (dx / length) * bow,
      };

  const towards = (point: Placed, pull: number) => {
    const vx = control.x - point.x;
    const vy = control.y - point.y;
    const len = Math.hypot(vx, vy) || 1;
    return { x: point.x + (vx / len) * pull, y: point.y + (vy / len) * pull };
  };

  const start = towards(from, radius + 3);
  const tip = towards(to, radius + 4);
  const angle = Math.atan2(tip.y - control.y, tip.x - control.x);
  const end = plain
    ? tip
    : {
        x: tip.x - Math.cos(angle) * ARROW * 0.8,
        y: tip.y - Math.sin(angle) * ARROW * 0.8,
      };
  const wing = (spread: number) => ({
    x: tip.x - Math.cos(angle - spread) * ARROW,
    y: tip.y - Math.sin(angle - spread) * ARROW,
  });
  const left = wing(0.45);
  const right = wing(-0.45);
  const round = (value: number) => value.toFixed(1);

  return {
    line: plain
      ? `M ${round(start.x)} ${round(start.y)} L ${round(control.x)} ${round(control.y)} L ${round(end.x)} ${round(end.y)}`
      : `M ${round(start.x)} ${round(start.y)} Q ${round(control.x)} ${round(control.y)} ${round(end.x)} ${round(end.y)}`,
    head: `M ${round(tip.x)} ${round(tip.y)} L ${round(left.x)} ${round(left.y)} L ${round(right.x)} ${round(right.y)} Z`,
    // Halfway along the line, where a tooltip reads as belonging to it
    // rather than to the orb at either end.
    mid: plain
      ? { x: (control.x + end.x) / 2, y: (control.y + end.y) / 2 }
      : {
          x: (start.x + 2 * control.x + end.x) / 4,
          y: (start.y + 2 * control.y + end.y) / 4,
        },
  };
}

function truncate(value: string, limit = 12): string {
  return value.length > limit ? `${value.slice(0, limit - 1)}…` : value;
}

export function DebateInfluenceGraph({
  seats,
  turns,
  spans,
  edges,
  plain = false,
  selectedLinkId,
  linkTipOpen,
  onSelectLink,
  activeSeat,
  seatTip,
  legendOpen,
  onCloseLegend,
  onSelectSeat,
}: {
  seats: DebateSeat[];
  turns: DebateTurn[];
  /** Where each agent started and where it ended, for the overview, where no
      single round is on screen to label the orbs with. */
  spans?: Record<string, { from: string; to: string; correct: boolean }>;
  edges: DebateEdge[];
  /** Draws every arrow the same: one dashed cyan line that says only that
      the two agents were connected, lit on click and nothing more. */
  plain?: boolean;
  selectedLinkId: string | null;
  /** False when the arrow was picked from the explanation, which reads it out
      where the click was rather than over the graph. */
  linkTipOpen: boolean;
  onSelectLink: (linkId: string | null) => void;
  /** Seat whose tooltip is open, anchored to its orb. */
  activeSeat: string | null;
  seatTip: ReactNode;
  /** Owned by the page, since the link that opens it sits in the heading. */
  legendOpen: boolean;
  onCloseLegend: () => void;
  onSelectSeat: (seat: string) => void;
}) {
  const placed = useMemo(() => placeSeats(seats, turns), [seats, turns]);
  const byId = useMemo(
    () => new Map(placed.map((node) => [node.seat.id, node])),
    [placed],
  );
  const categories = useMemo(() => {
    const seen: LinkCategory[] = [];
    for (const edge of edges) {
      if (!seen.includes(edge.category)) {
        seen.push(edge.category);
      }
    }
    return seen;
  }, [edges]);

  // Discs are sized in container units, so the radius the arrows have to clear
  // is only known once the stage has been measured.
  // In plain mode the arrows mean nothing, so a click only lights one.
  const [lit, setLit] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageWidth, setStageWidth] = useState(0);
  const rem = useMemo(() => rootRemPx(), []);
  useEffect(() => {
    const node = svgRef.current;
    if (!node) {
      return;
    }
    const update = () => setStageWidth(node.getBoundingClientRect().width);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const scale = stageWidth > 8 ? stageWidth / STAGE_W : 1;
  const radius = (3.15 * rem) / 2 / scale;

  const tipAnchor = placed.find((node) => node.seat.id === activeSeat);

  // Drawn up front rather than inside the map, so the selected arrow's
  // midpoint is available to anchor its tooltip.
  // Plain mode draws a connection rather than a direction, so a pair that
  // moved each other is one line, not two laid on top of one another.
  const seen = new Set<string>();
  const drawn = edges.flatMap((edge) => {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (!from || !to) {
      return [];
    }
    if (plain) {
      const pair = [edge.from, edge.to].sort().join("~");
      if (seen.has(pair)) {
        return [];
      }
      seen.add(pair);
    }
    const flip =
      seats.findIndex((seat) => seat.id === edge.from) >
      seats.findIndex((seat) => seat.id === edge.to);
    return [{ edge, geometry: edgeGeometry(from, to, flip, radius, plain) }];
  });
  const selected = selectedLinkId
    ? drawn.find((entry) =>
        entry.edge.links.some((link) => link.id === selectedLinkId),
      )
    : undefined;

  return (
    <div
      className={`ioc-bubble-graph is-vertical is-bare ioc-debate-graph${
        !plain && selected ? " is-link-focused" : ""
      }`}
    >
      <div
        ref={stageRef}
        className="ioc-bubble-stage"
        style={
          {
            "--ioc-graph-w": STAGE_W,
            "--ioc-graph-h": STAGE_H,
          } as CSSProperties
        }
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
          className="ioc-bubble-graph-svg"
          preserveAspectRatio="xMidYMid meet"
          fill="none"
          role="img"
          aria-label="Which agents used which peers' arguments this round"
        >
          {/* The knot the lines run through, drawn under them. */}
          {drawn.length > 0 ? (
            <circle
              cx={CENTER_X}
              cy={CENTER_Y}
              r={3}
              className="ioc-debate-hub"
            />
          ) : null}
          {drawn.map(({ edge, geometry }) => {
            const active = plain
              ? lit === edge.key
              : selected?.edge.key === edge.key;
            const danger =
              !plain &&
              (edge.category === "attack-adopted" ||
                edge.category === "tom-suspect");
            const tone = plain
              ? " is-plain"
              : `${danger ? " is-danger" : ""} is-${edge.category}`;
            const title = plain
              ? `${edge.links[0].fromName} — ${edge.links[0].toName}`
              : `${edge.links[0].fromName} → ${edge.links[0].toName} · ${linkOutcomeLabel(edge.category)}`;
            const pick = plain
              ? () => setLit((key) => (key === edge.key ? null : edge.key))
              : () => onSelectLink(active ? null : edge.links[0].id);
            return (
              <g key={edge.key}>
                <title>{title}</title>
                {/* Safari honours vector-effect only as an attribute, not from
                    CSS, so the scaled viewBox would resize strokes. */}
                <path
                  d={geometry.line}
                  fill="none"
                  vectorEffect="non-scaling-stroke"
                  className="ioc-bubble-edge-hit"
                  role="button"
                  tabIndex={0}
                  aria-label={title}
                  onClick={pick}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      pick();
                    }
                  }}
                />
                {/* Normalised length, so every connection is drawn with the
                    same number of dashes however far apart the two agents
                    sit on the ring. */}
                <path
                  d={geometry.line}
                  fill="none"
                  pathLength={plain ? 100 : undefined}
                  vectorEffect="non-scaling-stroke"
                  className={`ioc-bubble-edge is-${active ? "on" : "idle"}${tone}`}
                />
                {plain ? null : (
                  <path
                    d={geometry.head}
                    className={`ioc-bubble-arrow is-${active ? "on" : "idle"}${tone}`}
                  />
                )}
              </g>
            );
          })}
        </svg>

        {placed.map((node) => {
          const Logo = modelIconFor(node.seat.model);
          const span = spans?.[node.seat.id];
          return (
            <button
              key={node.seat.id}
              type="button"
              onClick={() => onSelectSeat(node.seat.id)}
              // Inside a round the orb carries the reading of that round;
              // the verdict belongs to the overview, where the ring shows the
              // whole run.
              className={`ioc-bubble-orb agent${
                node.turn ? turnTone(node.turn) : seatTone(node.seat)
              }${activeSeat === node.seat.id ? " is-selected" : ""}`}
              style={{
                left: `${(node.x / STAGE_W) * 100}%`,
                top: `${(node.y / STAGE_H) * 100}%`,
              }}
              title={
                node.seat.model
                  ? `${node.seat.name} · ${describeModel(node.seat.model).name}`
                  : node.seat.name
              }
            >
              <span className="ioc-bubble-disc">
                <Logo size={17} aria-hidden="true" />
              </span>
              <span className="ioc-bubble-orb-label">{node.seat.name}</span>
              {node.turn ? (
                <span
                  className={`ioc-debate-orb-vote${node.turn.correct ? " is-correct" : ""}`}
                >
                  {node.turn.optionLetter ? (
                    <span className="ioc-debate-orb-vote-key">
                      {node.turn.optionLetter}
                    </span>
                  ) : null}
                  {truncate(answerWithoutLetter(node.turn))}
                </span>
              ) : span ? (
                // No round on screen, so the orb carries the whole run of the
                // debate instead: the answer it opened on and the one it was
                // holding at the end.
                <span
                  className={`ioc-debate-orb-vote${span.correct ? " is-correct" : ""}`}
                  title={`${node.seat.name} answered ${span.from} first and ${span.to} last`}
                >
                  {span.from === span.to ? (
                    <span className="ioc-debate-orb-span">{span.to}</span>
                  ) : (
                    <>
                      <span className="ioc-debate-orb-span is-was">
                        {span.from}
                      </span>
                      <span className="ioc-debate-orb-span-arrow" aria-hidden>
                        →
                      </span>
                      <span className="ioc-debate-orb-span">{span.to}</span>
                    </>
                  )}
                </span>
              ) : null}
            </button>
          );
        })}

        {/* Anchored to the orb it belongs to, and flipped to the other side of
            it when the seat sits in the lower half of the ring. */}
        {tipAnchor && seatTip ? (
          <FloatingTip
            key={tipAnchor.seat.id}
            anchor={pointInBox(
              stageRef,
              (tipAnchor.x / STAGE_W) * 100,
              (tipAnchor.y / STAGE_H) * 100,
            )}
            side={tipAnchor.y < CENTER_Y ? "below" : "above"}
          >
            {seatTip}
          </FloatingTip>
        ) : null}

        {!plain && selected && linkTipOpen ? (
          <FloatingTip
            key={selected.edge.key}
            anchor={pointInBox(
              stageRef,
              (selected.geometry.mid.x / STAGE_W) * 100,
              (selected.geometry.mid.y / STAGE_H) * 100,
            )}
            side={selected.geometry.mid.y < CENTER_Y ? "below" : "above"}
          >
            <DebateLinkTip
              edge={selected.edge}
              selectedLinkId={selectedLinkId}
              onClose={() => onSelectLink(null)}
            />
          </FloatingTip>
        ) : null}

        {!plain && legendOpen && categories.length > 0 ? (
          <FloatingTip
            key="legend"
            anchor={pointInBox(stageRef, 50, 50)}
            side="below"
          >
            <aside className="ioc-answer-panel">
              <div className="ioc-answer-panel-head">
                <span className="ioc-agent-name">Legend</span>
                <button
                  type="button"
                  onClick={onCloseLegend}
                  aria-label="Close legend"
                  className="ioc-icon-btn"
                >
                  <LuX size={14} />
                </button>
              </div>
              <ul className="ioc-debate-legend">
                {categories.map((category) => (
                  <li key={category} title={linkOutcomeDescription(category)}>
                    <span
                      className={`ioc-debate-key is-${category}`}
                      aria-hidden
                    />
                    {linkOutcomeLabel(category)}
                  </li>
                ))}
              </ul>
            </aside>
          </FloatingTip>
        ) : null}
      </div>
    </div>
  );
}
