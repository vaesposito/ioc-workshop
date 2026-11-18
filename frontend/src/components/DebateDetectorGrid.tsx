import { Fragment, type CSSProperties } from "react";
import {
  manipulatorHue,
  manipulatorTint as tintOf,
  seatTone,
  type DebateScenario,
} from "../utils/madDebates";

/** The detector works in shares of one; the grid reads them as percentages. */
function percent(score: number): string {
  return `${Math.round(score * 100)}%`;
}

export function LegendKey({
  swatch,
  glyph,
  children,
  title,
}: {
  swatch: string;
  /** Drawn inside the swatch, where the mark being explained is a letter. */
  glyph?: string;
  children: string;
  title: string;
}) {
  return (
    <li title={title}>
      <span className={`ioc-tom-grid-key ${swatch}`} aria-hidden>
        {glyph}
      </span>
      {children}
    </li>
  );
}

/**
 * Every answer against the reading it earned. One row per agent, one column
 * per round: the letter is the answer recorded that round, the tint is how
 * far the detector had moved on that agent by then. The two together are the
 * debate's shape — the answers stop moving early while the colour keeps
 * deepening, which is the detector growing certain about turns that are no
 * longer changing anyone's mind.
 */
export function DebateDetectorGrid({
  scenario,
  picked = null,
  litRound = null,
  onSelectRound,
}: {
  scenario: DebateScenario;
  /** The cell the rest of the view is currently reading. */
  picked?: { seat: string; round: number } | null;
  /** The round the whole view is on, which brings its column forward. */
  litRound?: number | null;
  /** Opens a round, where the view this sits in has rounds to open. */
  onSelectRound?: (round: number, seat?: string) => void;
}) {
  const read = scenario.seats.some((seat) => seat.detector);
  if (!read) {
    return null;
  }

  return (
    <figure className="ioc-tom-grid-wrap">
      {/* The axes name the two directions; this names what fills them. */}
      <p className="ioc-kicker">
        Answers by agent &amp; round, with manipulator score shade
      </p>
      <div
        className={`ioc-tom-grid${litRound === null ? "" : " is-picking"}`}
        style={{ "--tom-rounds": scenario.rounds.length } as CSSProperties}
      >
        <span className="ioc-tom-grid-axis is-side">agents</span>
        <span
          className="ioc-tom-grid-axis"
          style={{ gridColumn: `span ${scenario.rounds.length}` }}
        >
          rounds
        </span>

        <span className="ioc-tom-grid-corner" />
        {scenario.rounds.map((round) =>
          onSelectRound ? (
            <button
              key={`head-${round.round}`}
              type="button"
              title={`Open round ${round.round}`}
              className={`ioc-tom-grid-head is-link${
                picked?.round === round.round || litRound === round.round
                  ? " is-active"
                  : ""
              }`}
              onClick={() => onSelectRound(round.round)}
            >
              {round.round}
            </button>
          ) : (
            <span
              key={`head-${round.round}`}
              title={`Round ${round.round}`}
              className="ioc-tom-grid-head"
            >
              {round.round}
            </span>
          ),
        )}

        {scenario.seats.map((seat) => {
          const keyRounds = seat.detector?.keyRounds ?? [];
          // The reading the agent finishes on, which used to have a column of
          // its own and now rides along in the name's tooltip.
          const end = scenario.rounds[scenario.rounds.length - 1]?.turns.find(
            (entry) => entry.seat === seat.id,
          )?.detector;
          return (
            <Fragment key={seat.id}>
              <span
                className={`ioc-tom-grid-name${seatTone(seat)}${
                  picked?.seat === seat.id ? " is-active" : ""
                }`}
                data-tip={
                  end
                    ? `${seat.name} · ${percent(end.scores.manipulator ?? 0)}`
                    : seat.name
                }
              >
                {seat.name}
              </span>
              {scenario.rounds.map((round) => {
                const turn = round.turns.find(
                  (entry) => entry.seat === seat.id,
                );
                const score = turn?.detector?.scores.manipulator ?? null;
                const key = keyRounds.includes(round.round);
                // The ring is easy to miss on a dark cell, so the tooltip
                // says what it means as well.
                const title = [
                  seat.name,
                  `round ${round.round}`,
                  score === null ? null : `${percent(score)} manipulator`,
                  key ? "clearest evidence" : null,
                ]
                  .filter(Boolean)
                  .join(" · ");
                const on =
                  picked?.seat === seat.id && picked?.round === round.round;
                const className = `ioc-tom-grid-cell${key ? " is-key" : ""}${
                  turn?.changed ? " is-changed" : ""
                }${score === null ? "" : " is-tinted"}${
                  on ? " is-selected" : ""
                }${litRound === round.round ? " is-round" : ""}${
                  onSelectRound ? " is-link" : ""
                }`;
                // A picked cell is ringed in its own shade rather than in
                // cyan: the colour is what the grid is read for.
                const background = {
                  ...(score === null ? null : { background: tintOf(score) }),
                  ...(score === null
                    ? null
                    : { "--cell-tone": manipulatorHue(score) }),
                } as CSSProperties;
                return onSelectRound ? (
                  <button
                    key={`${seat.id}-${round.round}`}
                    type="button"
                    data-tip={title}
                    className={className}
                    style={background}
                    onClick={() => onSelectRound(round.round, seat.id)}
                  >
                    {turn?.optionLetter ?? "·"}
                  </button>
                ) : (
                  <span
                    key={`${seat.id}-${round.round}`}
                    data-tip={title}
                    className={className}
                    style={background}
                  >
                    {turn?.optionLetter ?? "·"}
                  </span>
                );
              })}
            </Fragment>
          );
        })}
      </div>

      <ul className="ioc-tom-grid-legend">
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
          title="Each cell holds the letter of the answer that agent gave in that round, the same letters the answer list and the vote timeline use."
        >
          the answer given
        </LegendKey>
        <LegendKey
          swatch="is-letter is-changed"
          glyph="A"
          title="A brighter letter is an answer the agent changed to in that round."
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
    </figure>
  );
}
