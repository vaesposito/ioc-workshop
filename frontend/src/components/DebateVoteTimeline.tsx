import { Fragment, type CSSProperties } from "react";
import { DebateSection } from "./DebateSection";
import { LegendKey } from "./DebateDetectorGrid";
import {
  hasAnswerKey,
  manipulatorHue,
  manipulatorTint,
  seatTone,
  turnTone,
} from "../utils/madDebates";
import type {
  DebateRound,
  DebateScenario,
  DebateSeat,
  DebateTask,
  DebateTurn,
} from "../utils/madDebates";

/**
 * The answer the rest of the page is pointed at. A null round means the agent
 * was picked without one, as on the overview, where the whole row is theirs.
 */
export interface VotePick {
  seat: string;
  round: number | null;
}

/** How Agent-ToM read a turn, for the cell's hover title where it read one. */
function tomNote(turn: DebateTurn | undefined): string {
  return turn?.detector?.label ? ` · Agent-ToM: ${turn.detector.label}` : "";
}

function isPicked(
  picked: VotePick | null,
  seat: string,
  round: number,
): boolean {
  return (
    picked?.seat === seat && (picked.round === null || picked.round === round)
  );
}

/** Every cell carries its answer's letter; the right one is the green cell. */
function voteGlyph(turn: DebateTurn | undefined): string {
  return turn?.optionLetter || "–";
}

/** "Agent 3" reads as "A3" where a cell is only as wide as a column. */
function shortName(name: string): string {
  return name.replace(/^Agent\s+/i, "A");
}

/**
 * One round's votes as a single row, for a column too narrow for the whole
 * timeline. What matters beside a round is where the agents stand in it.
 */
export function DebateRoundVotes({
  round,
  seats,
  picked,
  onSelectVote,
}: {
  round: DebateRound;
  seats: DebateSeat[];
  picked: VotePick | null;
  onSelectVote: (round: number, seat: string) => void;
}) {
  return (
    <div className="ioc-vote-timeline mb-5">
      <DebateSection
        label={`Answers by agent, with manipulator score shade — round ${round.round}`}
      >
        <ul className="ioc-vote-row">
          {seats.map((seat) => {
            const turn = round.turns.find((entry) => entry.seat === seat.id);
            const on = isPicked(picked, seat.id, round.round);
            const manipulator = turn?.detector?.scores.manipulator ?? null;
            // A round the detector rests its reading of this agent on.
            const key = (seat.detector?.keyRounds ?? []).includes(round.round);
            const title = turn
              ? `${seat.name} · ${turn.optionLabel}${
                  turn.optionNew ? " · new here" : ""
                }${tomNote(turn)}`
              : `${seat.name} · no recorded answer`;
            const tip = [
              seat.name,
              turn?.optionShort ?? "no answer",
              manipulator === null
                ? null
                : `${Math.round(manipulator * 100)}% manipulator`,
              key ? "clearest evidence" : null,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <li key={seat.id}>
                <button
                  type="button"
                  aria-label={title}
                  aria-pressed={on}
                  onClick={() => onSelectVote(round.round, seat.id)}
                  data-tip={tip}
                  style={
                    manipulator === null
                      ? undefined
                      : ({
                          background: manipulatorTint(manipulator),
                          "--cell-tone": manipulatorHue(manipulator),
                        } as CSSProperties)
                  }
                  className={`ioc-vote-cell${turn?.correct ? " is-correct" : ""}${
                    manipulator === null ? "" : " is-tinted"
                  }${on ? " is-selected" : ""}${turn?.optionNew ? " is-new" : ""}${
                    turn?.changed ? " is-changed" : ""
                  }${key ? " is-key" : ""}`}
                >
                  {voteGlyph(turn)}
                </button>
                <span
                  className={`ioc-vote-row-name${turnTone(turn)}${
                    on ? " is-selected" : ""
                  }`}
                >
                  {shortName(seat.name)}
                </span>
              </li>
            );
          })}
        </ul>

        {/* The same key the overview grid carries, so a round is read the
            way the whole run is. */}
        <ul className="ioc-tom-grid-legend mt-3">
          <li
            className="ioc-tom-grid-scale"
            title="Four steps: green under 25% manipulator, yellow under 50%, orange past the flag, red over 75%."
          >
            <span className="ioc-tom-grid-ramp" aria-hidden />
            <span>honest 0% — 100% manipulator</span>
          </li>
          <LegendKey
            swatch="is-letter"
            glyph="F"
            title="The letter of the answer that agent gave in this round, the same letters the answer list uses."
          >
            the answer given
          </LegendKey>
          <LegendKey
            swatch="is-letter is-changed"
            glyph="A"
            title="A brighter letter is an answer the agent changed to in this round."
          >
            a changed answer
          </LegendKey>
          <LegendKey
            swatch="is-key"
            title="A round the detector names as its clearest evidence for this agent."
          >
            clearest evidence
          </LegendKey>
        </ul>
      </DebateSection>
    </div>
  );
}

/**
 * Every agent's recorded answer across the whole debate, one row per agent and
 * one column per round. Column headings open a round; a cell opens that one
 * answer, in the trace and in the question it was answering.
 */
export function DebateVoteTimeline({
  task,
  scenario,
  activeRound,
  picked,
  onSelectRound,
  onSelectVote,
}: {
  task: DebateTask;
  scenario: DebateScenario;
  activeRound: number | null;
  picked: VotePick | null;
  onSelectRound: (round: number) => void;
  onSelectVote: (round: number, seat: string) => void;
}) {
  const rounds = scenario.rounds;
  const coding = task.taskType === "code";
  const correctLetter =
    scenario.options?.find((option) => option.id === scenario.correctOptionId)
      ?.letter ?? "✓";

  return (
    <div className="ioc-vote-timeline">
      <DebateSection label="Recorded vote timeline">
        <div
          className={`ioc-vote-grid${activeRound === null ? "" : " is-focused"}`}
          style={{ "--vote-rounds": rounds.length } as CSSProperties}
        >
          <span className="ioc-vote-corner" />
          {rounds.map((round) => (
            <button
              key={`head-${round.round}`}
              type="button"
              onClick={() => onSelectRound(round.round)}
              className={`ioc-vote-head${activeRound === round.round ? " is-active" : ""}`}
            >
              {round.round}
            </button>
          ))}
          {scenario.seats.map((seat) => (
            <Fragment key={seat.id}>
              <span
                title={
                  seat.detector
                    ? `${seat.name} · Agent-ToM reads this agent as ${seat.detector.label}`
                    : undefined
                }
                className={`ioc-vote-agent${seatTone(seat)}${
                  picked?.seat === seat.id ? " is-selected" : ""
                }`}
              >
                {seat.name}
              </span>
              {rounds.map((round) => {
                const turn = round.turns.find(
                  (entry) => entry.seat === seat.id,
                );
                const on = isPicked(picked, seat.id, round.round);
                const title = turn
                  ? `${seat.name} · round ${round.round} · ${turn.optionLabel}${
                      turn.optionNew ? " · new here" : ""
                    }${tomNote(turn)}`
                  : `${seat.name} · round ${round.round} · no recorded answer`;
                return (
                  <button
                    key={`${seat.id}-${round.round}`}
                    type="button"
                    title={title}
                    aria-label={title}
                    aria-pressed={on}
                    onClick={() => onSelectVote(round.round, seat.id)}
                    className={`ioc-vote-cell${turn?.correct ? " is-correct" : ""}${
                      activeRound === round.round ? " is-active" : ""
                    }${on ? " is-selected" : ""}${turn?.optionNew ? " is-new" : ""}`}
                  >
                    {voteGlyph(turn)}
                  </button>
                );
              })}
            </Fragment>
          ))}
        </div>
        {hasAnswerKey(scenario) ? (
          <p className="ioc-vote-legend">
            <span className="ioc-vote-key" aria-hidden />
            {correctLetter} Correct: {scenario.correctOptionLabel}
          </p>
        ) : null}
        <p className="ioc-vote-note">
          {coding
            ? "Letters are programs, lettered as each one is first submitted. A dotted cell is where its letter came from. Pick a cell to open that program."
            : "Letters are answer options. Pick a cell to open that answer."}
        </p>
      </DebateSection>
    </div>
  );
}
