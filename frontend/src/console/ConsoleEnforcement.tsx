import type { AppDetail, SessionRow } from "./appDetailData";

export type Standing = "open" | "held" | "let";

interface Move {
  id: string;
  /** What was found, in the words the detectors used. */
  evidence: string;
  /** What is being proposed off the back of it. */
  said: string;
  /** The two ways it can go, and how each reads once taken. */
  hold: { label: string; taken: string };
  let: { label: string; taken: string };
}

/**
 * What an investigation leaves behind: what it found, and the two ways each
 * finding can be answered. Nothing is enforced from here in the demo, so a
 * decision is only remembered on the page.
 */
export function ConsoleEnforcement({
  detail,
  session,
  looked,
  suspects,
  taken,
  onSettle,
}: {
  detail: AppDetail;
  session: SessionRow;
  /** Whether an investigation has been through this session. */
  looked: boolean;
  /** Agents it read as driving the fault. */
  suspects: string[];
  /** Which way each recommendation has gone, so far. */
  taken: Record<string, Standing>;
  onSettle: (id: string, standing: Standing) => void;
}) {
  const settle = onSettle;

  // Nothing is proposed off the back of a run nobody has looked into yet.
  if (!looked) return null;

  const suspect = suspects[0] ?? session.agents[1] ?? "an agent";
  const tool = session.tools[0] ?? detail.tools[0] ?? "a tool";
  const events = detail.insights.filter(
    (insight) => insight.session === session.id,
  );
  if (events.length === 0) return null;

  const moves: Move[] = [
    {
      id: "block",
      evidence: `${suspect} was read as driving the fault, and the answer went out carrying it.`,
      said: `Block ${suspect} until the behaviour is accounted for.`,
      hold: { label: `Block ${suspect}`, taken: `${suspect} blocked` },
      let: { label: "Keep running", taken: "Kept running" },
    },
    {
      id: "auth",
      evidence: events[0].description,
      said: `Block ${suspect}'s calls to ${tool}, or hold them for approval.`,
      hold: {
        label: `Block calls to ${tool}`,
        taken: `Calls to ${tool} blocked`,
      },
      let: { label: "Hold for approval", taken: "Held for approval" },
    },
    {
      id: "deny",
      evidence: `${events[1]?.insight ?? events[0].insight} was raised on a call the policy does not cover.`,
      said: "Deny calls that fall outside the policy, rather than answering around them.",
      hold: { label: "Deny outside policy", taken: "Denied outside policy" },
      let: { label: "Allow as is", taken: "Allowed as is" },
    },
  ];

  return (
    <div>
      <p className="ioc-kicker">Recommendations</p>
      <p className="ioc-faint text-[11px] font-light">
        What the investigation of {session.id} leaves to decide. Whichever way
        each one goes is remembered on this page only.
      </p>
      <ul className="mt-2 flex flex-col gap-2">
        {moves.map((move) => {
          const standing = taken[move.id] ?? "open";
          return (
            <li key={move.id} className="ioc-console-move">
              <p className="ioc-faint text-[10.5px] leading-[1.45] font-light">
                {move.evidence}
              </p>
              <p className="ioc-copy mt-1 text-[12px] leading-[1.5] font-light">
                {move.said}
              </p>
              {standing === "open" ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => settle(move.id, "held")}
                    className="ioc-btn-primary"
                  >
                    {move.hold.label}
                  </button>
                  <button
                    type="button"
                    onClick={() => settle(move.id, "let")}
                    className="ioc-btn-ghost"
                  >
                    {move.let.label}
                  </button>
                </div>
              ) : (
                <p className="mt-2 flex items-center gap-2">
                  <span
                    className={`ioc-console-chip${standing === "held" ? " is-bad" : ""}`}
                  >
                    {standing === "held" ? move.hold.taken : move.let.taken}
                  </span>
                  <button
                    type="button"
                    onClick={() => settle(move.id, "open")}
                    className="ioc-link text-[11px]"
                  >
                    Undo
                  </button>
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
