import { ExpandMark } from "../components/ExpandCue";
import { AgentMark, SplitBar } from "../components/DebateReadingEvidence";
import { seatTone } from "../utils/madDebates";
import type { AgentFinding } from "./consoleReading";

/** The detector works in shares of one; the list reads them as percentages. */
function percent(score: number): string {
  return `${Math.round(score * 100)}%`;
}

/**
 * What the investigation found, agent by agent: how each one was read, and
 * the points of the session the reading rests on. Only the agents something
 * is held against are listed; the rest took their turn and nothing more.
 */
export function ConsoleFindings({
  findings,
  open,
  onToggle,
  onOpen,
}: {
  findings: AgentFinding[];
  /** Which agent is unfolded, held by the page. */
  open: string | null;
  onToggle: (id: string) => void;
  onOpen: (entryId: string) => void;
}) {
  const held = findings.filter(
    (finding) => finding.detector.label !== "honest",
  );

  if (held.length === 0) {
    return (
      <p className="ioc-copy text-[13px] font-light leading-[1.55]">
        Nobody was read as working against the rest.
      </p>
    );
  }

  return (
    <ul className="ioc-debate-agents">
      {held.map((finding) => {
        const read = finding.detector;
        const shown = open === finding.id;
        return (
          <li
            key={finding.id}
            className={`ioc-debate-agent${seatTone(finding)}${
              shown ? " is-open" : ""
            }`}
          >
            <button
              type="button"
              onClick={() => onToggle(finding.id)}
              aria-expanded={shown}
              className={`ioc-debate-agent-head${seatTone(finding)}`}
              title={`Agent-ToM reads ${finding.name} as ${read.label}`}
            >
              <ExpandMark open={shown} />
              <AgentMark seat={finding} />
              <span className="ioc-fg">{finding.name}</span>
              <span className="ioc-faint">{read.label}</span>
              <span className="ioc-confidence-tag ioc-debate-agent-score">
                {percent(read.score)}
              </span>
            </button>
            {shown ? (
              <div className="ioc-debate-agent-body">
                <SplitBar scores={read.scores} />
                <p className="ioc-copy mt-3 text-[12.5px] font-light leading-[1.55]">
                  {read.reading}
                </p>
                {finding.notes.length === 0 ? null : (
                  <ul className="mt-3 flex flex-col gap-1.5">
                    {finding.notes.map((note) => (
                      <li key={note.line}>
                        <button
                          type="button"
                          onClick={() => onOpen(note.at)}
                          className="ioc-console-wrote is-link"
                          title="Open where this was found in the trace"
                        >
                          {note.line}
                        </button>
                      </li>
                    ))}
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
