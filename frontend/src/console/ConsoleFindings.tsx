import { ExpandMark } from "../components/ExpandCue";
import { AgentMark, SplitBar } from "../components/DebateReadingEvidence";
import { seatTone, type DebateScenario } from "../utils/madDebates";

/** The detector works in shares of one; the list reads them as percentages. */
function percent(score: number): string {
  return `${Math.round(score * 100)}%`;
}

/**
 * What the investigation found, agent by agent. The reading behind it is
 * scored round by round, but a session is read in phases rather than rounds,
 * so what is shown here is the case itself: how the agent was read, and the
 * things the detector wrote down about it.
 */
export function ConsoleFindings({
  reading,
  open,
  onToggle,
  pointAt,
  onOpen,
}: {
  reading: DebateScenario;
  /** Which agent is unfolded, held by the page. */
  open: string | null;
  onToggle: (seatId: string) => void;
  /** Where in the trace a line about this agent was found, if anywhere. */
  pointAt: (agent: string, index: number) => string | null;
  onOpen: (entryId: string) => void;
}) {
  const suspects = reading.seats.filter(
    (seat) => seat.detector?.label === "manipulator",
  );

  if (suspects.length === 0) {
    return (
      <p className="ioc-copy text-[13px] font-light leading-[1.55]">
        Nobody was read as working against the rest.
      </p>
    );
  }

  return (
    <ul className="ioc-debate-agents">
      {suspects.map((seat) => {
        const read = seat.detector;
        if (!read) return null;
        const shown = open === seat.id;
        // Everything the detector wrote about this agent, without the round
        // it wrote it in and without saying the same thing twice.
        const wrote = [
          ...new Set(
            reading.rounds
              .filter((round) => read.keyRounds.includes(round.round))
              .map(
                (round) =>
                  round.turns.find((turn) => turn.seat === seat.id)?.detector
                    ?.summary,
              )
              .filter((line): line is string => Boolean(line)),
          ),
        ];
        return (
          <li
            key={seat.id}
            className={`ioc-debate-agent${seatTone(seat)}${
              shown ? " is-open" : ""
            }`}
          >
            <button
              type="button"
              onClick={() => onToggle(seat.id)}
              aria-expanded={shown}
              className={`ioc-debate-agent-head${seatTone(seat)}`}
              title={`Agent-ToM reads ${seat.name} as ${read.label}`}
            >
              <ExpandMark open={shown} />
              <AgentMark seat={seat} />
              <span className="ioc-fg">{seat.name}</span>
              <span className="ioc-faint">{read.label}</span>
              {read.score === null ? null : (
                <span className="ioc-confidence-tag ioc-debate-agent-score">
                  {percent(read.score)}
                </span>
              )}
            </button>
            {shown ? (
              <div className="px-3 pb-3">
                <SplitBar scores={read.scores} />
                <p className="ioc-copy mt-3 text-[12.5px] font-light leading-[1.55]">
                  {read.reading}
                </p>
                {wrote.length === 0 ? null : (
                  <ul className="mt-3 flex flex-col gap-1.5">
                    {wrote.map((line, index) => {
                      const point = pointAt(seat.name, index);
                      if (!point) {
                        return (
                          <li key={line} className="ioc-console-wrote">
                            {line}
                          </li>
                        );
                      }
                      return (
                        <li key={line}>
                          <button
                            type="button"
                            onClick={() => onOpen(point)}
                            className="ioc-console-wrote is-link"
                            title="Open where this was found in the trace"
                          >
                            {line}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
