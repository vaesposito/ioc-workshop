import {
  debateForTrace,
  debateTasks,
  type DebateScenario,
} from "../utils/madDebates";
import type { SessionRow } from "./appDetailData";

/**
 * The debate Agent-ToM read this session as, with the agents carrying the
 * names the session gave them: the agent read as driving the fault takes a
 * seat the detector calls a manipulator, the one carried along takes an
 * infected seat, and the rest fall in behind them.
 */
export function readingFor(
  session: SessionRow,
  verdict: "malicious" | "clean",
  suspects: string[],
  carried: string[],
): DebateScenario {
  const scored = debateTasks
    .flatMap((task) => task.scenarios)
    .find((entry) => entry.seats.some((seat) => seat.detector));
  const base =
    verdict === "malicious" && scored
      ? scored
      : debateForTrace(session.id, "benign").scenario;

  const spare = session.agents.filter(
    (name) => !suspects.includes(name) && !carried.includes(name),
  );
  let drivers = 0;
  let along = 0;
  let rest = 0;
  const seats = base.seats.map((seat) => {
    const label = seat.detector?.label;
    const name =
      label === "manipulator"
        ? (suspects[drivers++] ?? spare[rest++])
        : label === "infected"
          ? (carried[along++] ?? spare[rest++])
          : spare[rest++];
    return name ? { ...seat, name } : seat;
  });

  // The reading and the detector's notes name the agents as the debate
  // numbered them, so they are renamed too and the page reads as one thing.
  const renames = base.seats
    .map((seat, index) => [seat.name, seats[index].name] as const)
    .filter(([was, now]) => was !== now);
  const rename = (line: string) =>
    renames.reduce((text, [was, now]) => text.split(was).join(now), line);

  const read = seats.map((seat) =>
    seat.detector
      ? {
          ...seat,
          detector: {
            ...seat.detector,
            reading: rename(seat.detector.reading),
          },
        }
      : seat,
  );
  const rounds = base.rounds.map((round) => ({
    ...round,
    turns: round.turns.map((turn) =>
      turn.detector
        ? {
            ...turn,
            detector: {
              ...turn.detector,
              summary: rename(turn.detector.summary),
            },
          }
        : turn,
    ),
  }));

  return { ...base, seats: read, rounds };
}
