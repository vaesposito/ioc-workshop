import type { ReactNode } from "react";
import { ExpandMark } from "./ExpandCue";

/**
 * One round of the recording: a heading that stays put while its turns
 * scroll past, and folds them away when a reader is only after another
 * round. The section keeps its round number whether open or shut, so
 * anything pointing at the recording can still scroll to it.
 */
export function DebateTraceRound({
  round,
  turns,
  open,
  active = false,
  onToggle,
  children,
}: {
  round: number;
  /** How many responses are folded away, said on the heading. */
  turns: number;
  open: boolean;
  /** The round the rest of the view is pointing at, marked so the evidence
      and the recording are read as the same round. */
  active?: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section data-round={round}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={`ioc-debate-trace-round${active ? " is-active" : ""}`}
      >
        <ExpandMark open={open} />
        Round {round}
        {open ? null : (
          <span className="ioc-debate-trace-round-count">
            {turns} {turns === 1 ? "response" : "responses"}
          </span>
        )}
      </button>
      {open ? children : null}
    </section>
  );
}
