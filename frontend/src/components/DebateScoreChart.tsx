import { useMemo, useState } from "react";
import {
  MANIPULATOR_FLAG,
  manipulatorHue,
  type DebateScenario,
} from "../utils/madDebates";

// The drawing is the plot and nothing else: no padding inside it, so the
// lines, the points laid over it in HTML and the round numbers under it all
// sit on the same grid however wide the column gets.
const W = 360;
const H = 144;

/** Where a round sits across the plot, as a fraction of its width. */
function across(index: number, count: number): number {
  return count < 2 ? 0.5 : index / (count - 1);
}

/** Where a score sits down the plot, as a fraction of its height. */
function down(score: number): number {
  return 1 - Math.min(1, Math.max(0, score));
}

function percent(score: number): string {
  return `${Math.round(score * 100)}%`;
}

/** One gradient per line, named so two charts on a page cannot collide. */
function gradientId(traceId: string, seatId: string): string {
  return `ioc-score-${traceId}-${seatId}`.replace(/[^\w-]/g, "");
}

/**
 * How the detector's mind changed, round by round: one line per agent
 * carrying the manipulator score it held after each round, against the flag
 * it has to cross to be called one. The grid says where each agent ended;
 * this says when it got there, and which rounds moved it.
 */
export function DebateScoreChart({
  scenario,
  onSelectSeat,
  onSelectPoint,
}: {
  scenario: DebateScenario;
  /** Asked for the agent whose line was picked in the key. */
  onSelectSeat?: (seatId: string) => void;
  /** Asked for an agent in a round, where a point was picked. */
  onSelectPoint?: (round: number, seatId: string) => void;
}) {
  const rounds = scenario.rounds;
  // One line at a time, where the six of them cross too often to follow.
  const [lit, setLit] = useState<string | null>(null);
  const series = useMemo(
    () =>
      scenario.seats
        .map((seat) => {
          const points = rounds.map((round) => {
            const turn = round.turns.find((entry) => entry.seat === seat.id);
            return turn?.detector?.scores.manipulator ?? null;
          });
          const last = [...points].reverse().find((value) => value !== null);
          return { seat, points, last: last ?? null };
        })
        .filter((entry) => entry.last !== null),
    [scenario.seats, rounds],
  );

  if (series.length === 0) {
    return null;
  }

  const flagY = down(MANIPULATOR_FLAG) * H;

  return (
    <figure className="ioc-score-chart">
      {/* What the height means, said above the scale it belongs to rather
          than turned on its side. */}
      <p className="ioc-score-axis-y">manipulator score</p>
      <div className="ioc-score-chart-plot">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="ioc-score-chart-svg"
          preserveAspectRatio="none"
          role="img"
          aria-label="Manipulator score for each agent after each round"
        >
          {/* The two sides of the flag, so a line's height is read as a
              verdict rather than as a number. */}
          <rect
            x={0}
            y={0}
            width={W}
            height={flagY}
            className="ioc-score-band is-flagged"
          />
          <rect
            x={0}
            y={flagY}
            width={W}
            height={H - flagY}
            className="ioc-score-band is-clear"
          />
          <line
            x1={0}
            x2={W}
            y1={flagY}
            y2={flagY}
            className="ioc-score-flag"
            vectorEffect="non-scaling-stroke"
          />

          {/* Each line is painted in its own scores: a stop wherever it
              passes a round, in the colour that round earned, so a line
              turning red is read before any number is. */}
          <defs>
            {series.map(({ seat, points }) => (
              <linearGradient
                key={`grad-${seat.id}`}
                id={gradientId(scenario.traceId, seat.id)}
                gradientUnits="userSpaceOnUse"
                x1={0}
                x2={W}
                y1={0}
                y2={0}
              >
                {points.map((score, index) =>
                  score === null ? null : (
                    <stop
                      key={index}
                      offset={`${across(index, points.length) * 100}%`}
                      stopColor={manipulatorHue(score)}
                    />
                  ),
                )}
              </linearGradient>
            ))}
          </defs>

          {series.map(({ seat, points }) => {
            const drawn = points
              .map((score, index) =>
                score === null
                  ? null
                  : `${(across(index, points.length) * W).toFixed(1)},${(
                      down(score) * H
                    ).toFixed(1)}`,
              )
              .filter((point): point is string => point !== null);
            if (drawn.length === 0) {
              return null;
            }
            return (
              <polyline
                key={seat.id}
                points={drawn.join(" ")}
                fill="none"
                stroke={`url(#${gradientId(scenario.traceId, seat.id)})`}
                vectorEffect="non-scaling-stroke"
                className={`ioc-score-line${
                  lit === null ? "" : lit === seat.id ? " is-lit" : " is-dim"
                }`}
              />
            );
          })}
        </svg>

        {/* The scales and every point live outside the drawing, as text that
            is laid out rather than stretched with it, and as targets that
            carry the same instant tooltip the grid uses. */}
        <span className="ioc-score-axis is-top">100%</span>
        <span className="ioc-score-axis is-flag">
          {percent(MANIPULATOR_FLAG)}
        </span>
        <span className="ioc-score-axis is-bottom">0%</span>

        {series.map(({ seat, points }) =>
          points.map((score, index) => {
            if (score === null) {
              return null;
            }
            // A round the detector rests its reading on, ringed the way it is
            // in the grid — but only for the agents it ends up accusing, so
            // the rings are the case rather than decoration.
            const key =
              seat.detector?.label === "manipulator" &&
              (seat.detector?.keyRounds ?? []).includes(rounds[index].round);
            // The tooltip is drawn in a column that clips: a point near an
            // edge hangs its tooltip inwards instead of centring it.
            const at = across(index, points.length);
            const edge = at < 0.3 ? " is-start" : at > 0.7 ? " is-end" : "";
            const side = down(score) < 0.4 ? " is-below" : "";
            const Point = onSelectPoint ? "button" : "span";
            return (
              <Point
                key={`${seat.id}-${index}`}
                type={onSelectPoint ? "button" : undefined}
                onClick={
                  onSelectPoint
                    ? () => onSelectPoint(rounds[index].round, seat.id)
                    : undefined
                }
                className={`ioc-score-dot${key ? " is-key" : ""}${edge}${side}${
                  lit === null || lit === seat.id ? "" : " is-dim"
                }`}
                data-tip={[
                  seat.name,
                  `round ${rounds[index].round}`,
                  `${percent(score)} manipulator`,
                  key ? "clearest evidence" : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                style={{
                  left: `${across(index, points.length) * 100}%`,
                  top: `${down(score) * 100}%`,
                  background: manipulatorHue(score),
                }}
              />
            );
          }),
        )}
      </div>

      <div className="ioc-score-x">
        <ul className="ioc-score-rounds" aria-hidden>
          {rounds.map((round) => (
            <li key={round.round}>{round.round}</li>
          ))}
        </ul>
        <p className="ioc-score-axis-x">rounds</p>
      </div>

      {/* Which line is which, said once under the chart rather than crowded
          against the ends of the lines. */}
      <ul className="ioc-score-key">
        {series.map(({ seat, last }) => (
          <li key={seat.id}>
            <button
              type="button"
              aria-pressed={lit === seat.id}
              data-tip={`${seat.name} · ended at ${percent(last ?? 0)} manipulator`}
              onClick={() => {
                setLit((current) => (current === seat.id ? null : seat.id));
                onSelectSeat?.(seat.id);
              }}
            >
              <span
                className="ioc-score-key-mark"
                style={{ background: manipulatorHue(last ?? 0) }}
                aria-hidden
              />
              {seat.name}
              <span className="ioc-score-key-value">{percent(last ?? 0)}</span>
            </button>
          </li>
        ))}
      </ul>
    </figure>
  );
}
