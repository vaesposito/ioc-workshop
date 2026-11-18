import { LuX } from "react-icons/lu";
import { DebateCode } from "./DebateCode";
import { ModelMark } from "./ModelMark";
import { describeModel } from "../utils/modelBadge";
import { hasAnswerKey } from "../utils/madDebates";
import type {
  DebateRound,
  DebateScenario,
  DebateTask,
  DebateTurn,
} from "../utils/madDebates";

/** How far the detector's score for a round moved from the one before it. */
function scoreMove(reading: NonNullable<DebateTurn["detector"]>): string {
  const delta = reading.change?.[reading.label];
  if (typeof delta !== "number" || Math.abs(delta) < 0.005) {
    return "";
  }
  return ` ${delta > 0 ? "↑" : "↓"}${Math.round(Math.abs(delta) * 100)}`;
}

/** The detector's three readings, strongest first, as whole percentages. */
function split(scores: Record<string, number>): string {
  return Object.entries(scores)
    .sort((left, right) => right[1] - left[1])
    .map(([label, score]) => `${label} ${Math.round(score * 100)}%`)
    .join(" · ");
}

/**
 * One agent, read out as a tooltip hanging off its orb: who it is, and what it
 * answered in the round on screen. Both the graph and the vote timeline open
 * it, which is why the round is a parameter rather than the selected one.
 */
export function DebateSeatTip({
  task,
  scenario,
  seatId,
  round,
  onClose,
}: {
  task: DebateTask;
  scenario: DebateScenario;
  seatId: string;
  /** The round to read out, or null on the overview where none is open. */
  round: DebateRound | null;
  onClose: () => void;
}) {
  const seat = scenario.seats.find((entry) => entry.id === seatId);
  if (!seat) {
    return null;
  }

  const badge = describeModel(seat.model);
  const scored = hasAnswerKey(scenario);
  const turns = scenario.rounds
    .map((entry) => entry.turns.find((turn) => turn.seat === seat.id))
    .filter((turn) => turn !== undefined);
  const correct = turns.filter((turn) => turn.correct).length;
  const changes = turns.filter((turn) => turn.changed).length;

  const turn = round?.turns.find((entry) => entry.seat === seat.id);
  const reading = round ? (turn?.detector ?? null) : (seat.detector ?? null);
  const picked = scenario.options?.find(
    (option) => option.id === turn?.optionId,
  );
  const answer = scenario.options?.find(
    (option) => option.id === scenario.correctOptionId,
  );
  // On the overview there is no round to read out, so the agent is read out
  // by where it ended up: the answer it was holding when the debate stopped.
  const last = turns[turns.length - 1];
  const first = turns[0];
  const ended = scenario.options?.find(
    (option) => option.id === last?.optionId,
  );

  return (
    <aside className="ioc-answer-panel">
      <div className="ioc-answer-panel-head">
        {seat.model ? <ModelMark model={seat.model} /> : null}
        <span className="ioc-agent-name">
          {seat.name}
          {/* Inside a round the chip says what the detector made of the
              agent by then; the verdict is only shown on the overview. */}
          {seat.adversary ? (
            <span className="ioc-debate-flag is-danger">attacker</span>
          ) : reading?.label === "manipulator" ||
            reading?.label === "infected" ? (
            <span
              className={`ioc-debate-flag ${
                reading.label === "manipulator" ? "is-danger" : "is-watch"
              }`}
            >
              {reading.label}
            </span>
          ) : null}
        </span>
        {round ? (
          <span className="ioc-faint text-[11px] font-light">
            Round {round.round}
          </span>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close agent"
          className="ioc-icon-btn"
        >
          <LuX size={14} />
        </button>
      </div>

      {/* Where the run finished for this agent, which is what the ring is
          showing when no round is open. */}
      {!round && last ? (
        <>
          <p
            className={`ioc-answer-panel-verdict${last.correct ? " is-correct" : ""}`}
          >
            <span className="ioc-answer-panel-answer">
              {task.taskType === "code"
                ? last.optionLabel
                : scored
                  ? `Ended on ${last.optionLetter} · ${last.correct ? "correct" : "wrong"}`
                  : `Ended on ${last.optionLetter}`}
            </span>
            {first && first.optionId !== last.optionId ? (
              <span className="ioc-debate-flag">
                opened on {first.optionLetter}
              </span>
            ) : (
              <span className="ioc-debate-flag">held throughout</span>
            )}
          </p>
          {ended && task.taskType === "code" ? (
            <DebateCode code={ended.text} name={`program-${ended.letter}`} />
          ) : ended ? (
            <p
              className={`ioc-answer-panel-text ioc-answer-panel-pick${
                last.correct ? " is-correct" : ""
              }`}
            >
              <span className="ioc-debate-option-key">{ended.letter}</span>
              {ended.text}
            </p>
          ) : null}
          {!last.correct && answer ? (
            <p className="ioc-answer-panel-correct">
              <span className="ioc-debate-option-key">{answer.letter}</span>
              {answer.text}
            </p>
          ) : null}
        </>
      ) : null}

      {round ? (
        turn ? (
          <>
            <p
              className={`ioc-answer-panel-verdict${turn.correct ? " is-correct" : ""}`}
            >
              <span className="ioc-answer-panel-answer">
                {task.taskType === "code"
                  ? turn.optionLabel
                  : scored
                    ? `Answered ${turn.optionLetter} · ${turn.correct ? "correct" : "wrong"}`
                    : `Answered ${turn.optionLetter}`}
              </span>
              {/* A first submission is a change as well, so the stronger of
                  the two is the one worth the room. */}
              {turn.optionNew ? (
                <span className="ioc-debate-flag">new</span>
              ) : turn.changed ? (
                <span className="ioc-debate-flag">changed</span>
              ) : null}
            </p>
            {picked && task.taskType === "code" ? (
              // The answer is a program, so it is read as code rather than
              // run on as a line of the panel's copy.
              <DebateCode
                code={picked.text}
                name={`program-${picked.letter}`}
              />
            ) : picked ? (
              <p
                className={`ioc-answer-panel-text ioc-answer-panel-pick${
                  turn.correct ? " is-correct" : ""
                }`}
              >
                <span className="ioc-debate-option-key">{picked.letter}</span>
                {picked.text}
              </p>
            ) : null}
            {!turn.correct && answer ? (
              <p className="ioc-answer-panel-correct">
                <span className="ioc-debate-option-key">{answer.letter}</span>
                {answer.text}
              </p>
            ) : null}
            {turn.detector ? (
              <p className="ioc-faint text-[11px] font-light">
                Agent-ToM: {turn.detector.label}
                {scoreMove(turn.detector)}
              </p>
            ) : null}
          </>
        ) : (
          <p className="ioc-answer-panel-text">
            No answer recorded this round.
          </p>
        )
      ) : null}

      {seat.model ? (
        <p className="ioc-answer-panel-model">
          {badge.name}
          <span className="ioc-agent-host">{badge.host}</span>
          {seat.role ? (
            <span className="ioc-agent-host">{seat.role}</span>
          ) : null}
        </p>
      ) : null}

      {/* The reading across the whole debate, as the three numbers and the
          rounds it rests them on. Only on the overview: in a round, where it
          ends up is not yet known. The sentence behind them is in the agent
          list, which has the room for it. */}
      {!round && seat.detector ? (
        <p className="ioc-faint text-[11px] font-light">
          {split(seat.detector.scores)}
          {seat.detector.keyRounds.length > 0
            ? ` · clearest at ${[...seat.detector.keyRounds].sort((left, right) => left - right).join(", ")}`
            : ""}
        </p>
      ) : null}

      <p className="ioc-faint text-[11px] font-light">
        {scored
          ? `Correct in ${correct} of ${turns.length}`
          : `Answered in ${turns.length} of ${scenario.rounds.length}`}
        {changes > 0 ? ` · changed ${changes}×` : " · never changed"}
      </p>
    </aside>
  );
}
