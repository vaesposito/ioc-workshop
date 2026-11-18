import type { ReactNode } from "react";
import {
  LuBan,
  LuCheck,
  LuClock,
  LuLock,
  LuPlay,
  LuShieldX,
} from "react-icons/lu";

import type { AppDetail, SessionRow } from "./appDetailData";
import type { Standing } from "./consoleStanding";

export interface Move {
  id: string;
  /** What was found, in the words the detectors used. */
  evidence: string;
  /** What is being proposed off the back of it. */
  said: string;
  /** The two ways it can go, and how each reads once taken. */
  hold: { label: string; taken: string; icon: ReactNode };
  let: { label: string; taken: string; icon: ReactNode };
}

/**
 * What an investigation leaves behind: what it found, and the two ways each
 * finding can be answered. Nothing is enforced from here in the demo; what
 * is decided is held for the console and listed on the application.
 */
/**
 * The controls an investigation of this session leaves to take, in the
 * order they are offered. Written out here rather than in the panel, since
 * the page remembers them by the words each one is taken under.
 */
export function movesFor({
  detail,
  session,
  suspects,
}: {
  detail: AppDetail;
  session: SessionRow;
  suspects: string[];
}): Move[] {
  const suspect = suspects[0] ?? session.agents[1] ?? "an agent";
  const tool = session.tools[0] ?? detail.tools[0] ?? "a tool";
  const events = detail.insights.filter(
    (insight) => insight.session === session.id,
  );
  if (events.length === 0) return [];

  return [
    {
      id: "block",
      evidence: `${suspect} was read as driving the fault, and the answer went out carrying it.`,
      said: `Block ${suspect} until the behaviour is accounted for.`,
      hold: {
        label: `Block ${suspect}`,
        taken: `${suspect} blocked`,
        icon: <LuBan size={13} aria-hidden />,
      },
      let: {
        label: "Keep running",
        taken: "Kept running",
        icon: <LuPlay size={13} aria-hidden />,
      },
    },
    {
      id: "auth",
      evidence: events[0].description,
      said: `Block ${suspect}'s calls to ${tool}, or hold them for approval.`,
      hold: {
        label: `Block calls to ${tool}`,
        taken: `Calls to ${tool} blocked`,
        icon: <LuLock size={13} aria-hidden />,
      },
      let: {
        label: "Hold for approval",
        taken: "Held for approval",
        icon: <LuClock size={13} aria-hidden />,
      },
    },
    {
      id: "deny",
      evidence: `${events[1]?.insight ?? events[0].insight} was raised on a call the policy does not cover.`,
      said: "Deny calls that fall outside the policy, rather than answering around them.",
      hold: {
        label: "Deny outside policy",
        taken: "Denied outside policy",
        icon: <LuShieldX size={13} aria-hidden />,
      },
      let: {
        label: "Allow as is",
        taken: "Allowed as is",
        icon: <LuCheck size={13} aria-hidden />,
      },
    },
  ];
}

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

  const moves = movesFor({ detail, session, suspects });
  if (moves.length === 0) return null;

  return (
    <div data-tour="trace-enforcement">
      <p className="ioc-kicker">Enforcement</p>
      <p className="ioc-faint text-[11px] font-light">
        What the investigation of {session.id} leaves to decide. Whichever way
        each one goes holds across the console until the demo is reset.
      </p>
      <ul className="mt-3 flex flex-col gap-2.5">
        {moves.map((move) => {
          const standing = taken[move.id] ?? "open";
          return (
            <li
              key={move.id}
              className={`ioc-console-move${
                standing === "open" ? "" : " is-settled"
              }`}
            >
              <p className="ioc-console-move-found">{move.evidence}</p>
              <p className="ioc-copy mt-1.5 text-[12px] leading-[1.5] font-light">
                {move.said}
              </p>
              {standing === "open" ? (
                <div className="ioc-console-move-acts">
                  <button
                    type="button"
                    onClick={() => settle(move.id, "held")}
                    className="ioc-console-act"
                  >
                    {move.hold.icon}
                    {move.hold.label}
                  </button>
                  <button
                    type="button"
                    onClick={() => settle(move.id, "let")}
                    className="ioc-console-act is-quiet"
                  >
                    {move.let.icon}
                    {move.let.label}
                  </button>
                </div>
              ) : (
                <p className="ioc-console-move-acts">
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
