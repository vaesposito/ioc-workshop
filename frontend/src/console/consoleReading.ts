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

  return { ...base, seats };
}
