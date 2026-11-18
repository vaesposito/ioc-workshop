import { LuBot } from "react-icons/lu";
import type { TopologyEdge, TopologyNode } from "./appDetailData";
import { isPicked, type Pickable } from "./pick";

/** Where the ring sits inside its square, as shares of the stage. */
const RADIUS = 0.34;
const CENTER = 0.5;
/** How far short of a node an arrow stops, so the head sits off the orb. */
const CLEAR = 6;

/** The ring's tones: an agent takes its own reading, a tool its own colour. */
function toneOf(node: TopologyNode): string {
  if (node.kind === "tool") return "#6f97a6";
  if (node.health === undefined) return "var(--ioc-kicker)";
  if (node.health < 0.4) return "#f05252";
  if (node.health < 0.7) return "#f6a356";
  return "var(--ioc-kicker)";
}

/**
 * Who is in the application and what passes between them: every agent and
 * tool on a ring, with an arrow for each way messages travel. Arrows to
 * tools are dashed, because a tool is reached for rather than spoken to.
 */
export function ConsoleTopology({
  nodes,
  edges,
  pick,
  onPick,
}: { nodes: TopologyNode[]; edges: TopologyEdge[] } & Pickable) {
  const placed = nodes.map((node, index) => {
    // Starting at the top and going round, so the moderator leads.
    const angle = (index / nodes.length) * Math.PI * 2 - Math.PI / 2;
    return {
      node,
      x: (CENTER + Math.cos(angle) * RADIUS) * 100,
      y: (CENTER + Math.sin(angle) * RADIUS) * 100,
    };
  });
  const seats = new Map(placed.map((seat) => [seat.node.id, seat]));
  const busiest = Math.max(...edges.map((edge) => edge.messages), 1);
  const held = (node: TopologyNode) =>
    isPicked(pick, node.kind === "tool" ? "tool" : "agent", node.label);
  const picking = Boolean(
    pick && (pick.kind === "agent" || pick.kind === "tool"),
  );

  return (
    <div>
      <div className="ioc-console-ring">
        <svg
          viewBox="0 0 100 100"
          className="ioc-console-ring-wires"
          aria-hidden
        >
          <defs>
            {[
              { id: "arrow-agent", fill: "var(--ioc-kicker)" },
              { id: "arrow-tool", fill: "#6f97a6" },
            ].map((head) => (
              <marker
                key={head.id}
                id={head.id}
                markerUnits="userSpaceOnUse"
                markerWidth="2.4"
                markerHeight="2.4"
                refX="2"
                refY="1.2"
                orient="auto"
              >
                <path d="M 0 0 L 2.4 1.2 L 0 2.4 z" fill={head.fill} />
              </marker>
            ))}
          </defs>

          {edges.map((edge) => {
            const from = seats.get(edge.from);
            const to = seats.get(edge.to);
            if (!from || !to) return null;
            const toTool = to.node.kind === "tool";
            // Each direction bows to its own side, so a call and its answer
            // are two arrows rather than one line drawn twice.
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const length = Math.hypot(dx, dy) || 1;
            const bow = length * 0.14;
            const cx = (from.x + to.x) / 2 + (dy / length) * bow;
            const cy = (from.y + to.y) / 2 - (dx / length) * bow;
            // Both ends are pulled back off the orbs they join.
            const outX = cx - from.x;
            const outY = cy - from.y;
            const outLength = Math.hypot(outX, outY) || 1;
            const startX = from.x + (outX / outLength) * CLEAR;
            const startY = from.y + (outY / outLength) * CLEAR;
            const inX = to.x - cx;
            const inY = to.y - cy;
            const inLength = Math.hypot(inX, inY) || 1;
            const endX = to.x - (inX / inLength) * CLEAR;
            const endY = to.y - (inY / inLength) * CLEAR;
            const lit = !picking || held(from.node) || held(to.node);
            return (
              <path
                key={`${edge.from}-${edge.to}`}
                d={`M ${startX} ${startY} Q ${cx} ${cy} ${endX} ${endY}`}
                className={`ioc-console-arrow${toTool ? " is-tool" : ""}${
                  lit ? "" : " is-far"
                }`}
                stroke={toTool ? "#6f97a6" : "var(--ioc-kicker)"}
                strokeWidth={0.16 + (edge.messages / busiest) * 0.44}
                markerEnd={`url(#${toTool ? "arrow-tool" : "arrow-agent"})`}
              />
            );
          })}
        </svg>

        {placed.map(({ node, x, y }) => (
          <button
            key={node.id}
            type="button"
            aria-pressed={held(node)}
            onClick={() =>
              onPick?.({
                kind: node.kind === "tool" ? "tool" : "agent",
                id: node.label,
                label: node.label,
              })
            }
            className={`ioc-console-orb${held(node) ? " is-picked" : ""}`}
            style={{
              left: `${x}%`,
              top: `${y}%`,
              // The tone drives the disc, its ring, and the glow around it.
              ["--orb-tone" as string]: toneOf(node),
            }}
            title={node.note ? `${node.label} · ${node.note}` : node.label}
          >
            <span className="ioc-console-orb-disc">
              <LuBot size={16} aria-hidden />
            </span>
            <span className="ioc-console-orb-name">{node.label}</span>
            {node.note ? (
              <span className="ioc-console-orb-note">{node.note}</span>
            ) : null}
          </button>
        ))}
      </div>

      <ul className="ioc-console-ring-key">
        <li>
          <span className="ioc-console-key-dot is-good" aria-hidden />
          Agent holding up
        </li>
        <li>
          <span className="ioc-console-key-dot is-watch" aria-hidden />
          Needs a look
        </li>
        <li>
          <span className="ioc-console-key-dot is-bad" aria-hidden />
          In trouble
        </li>
        <li>
          <span className="ioc-console-key-dot is-tool" aria-hidden />
          Tool
        </li>
        <li>
          <span className="ioc-console-key-line" aria-hidden />
          Arrow points the way messages go, heavier where more pass
        </li>
      </ul>
    </div>
  );
}
