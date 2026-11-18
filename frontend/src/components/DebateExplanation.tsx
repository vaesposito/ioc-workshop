import { useState, type ReactNode } from "react";
import { LuChevronDown, LuTriangleAlert } from "react-icons/lu";
import { DebateCode } from "./DebateCode";
import { DebateSection } from "./DebateSection";
import { vendorIcon } from "./ModelMark";
import { describeModel } from "../utils/modelBadge";
import {
  linkOutcomeLabel,
  optionsCreatedIn,
  seatTone,
  type DebateLink,
  type DebateOption,
  type DebateRound,
  type DebateScenario,
  type DebateSeat,
  type DebateTask,
} from "../utils/madDebates";

function Block({ label, children }: { label: string; children: ReactNode }) {
  return (
    <DebateSection label={label}>
      <div className="ioc-copy text-[13px] font-light leading-[1.55]">
        {children}
      </div>
    </DebateSection>
  );
}

function LinkRow({
  link,
  selected,
  onSelect,
}: {
  link: DebateLink;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={`ioc-debate-link${selected ? " is-selected" : ""}`}
      >
        <span className="ioc-debate-link-head">
          <span className={`ioc-debate-key is-${link.category}`} aria-hidden />
          <span className="ioc-debate-link-label">{link.label}</span>
          <span className="ioc-debate-link-from">
            {link.fromName}
            {link.fromRound ? ` · round ${link.fromRound}` : ""}
          </span>
        </span>
        <span className="ioc-debate-link-outcome">
          {linkOutcomeLabel(link.category)}
        </span>
        {link.interpretation ? (
          <span className="ioc-debate-link-note">{link.interpretation}</span>
        ) : null}
        {link.sourceQuote ? (
          <span className="ioc-debate-quote">“{link.sourceQuote}”</span>
        ) : null}
        {link.attack && link.path ? (
          <span className="ioc-debate-lineage">
            <LuTriangleAlert size={11} />
            {link.path.map((step) => `${step.name} R${step.round}`).join(" → ")}
          </span>
        ) : null}
      </button>
    </li>
  );
}

export function DebateRoundExplanation({
  round,
  scenario,
  selectedLinkId,
  onSelectLink,
}: {
  round: DebateRound;
  scenario: DebateScenario;
  selectedLinkId: string | null;
  onSelectLink: (linkId: string | null) => void;
}) {
  const unexplained = round.links.filter(
    (link) => !round.events.some((event) => event.linkIds.includes(link.id)),
  );
  // Round 1 is every answer's first appearance, and the opening positions
  // below already read them out.
  const created =
    round.round > 1 ? optionsCreatedIn(scenario, round.round) : [];

  return (
    <div className="space-y-5">
      {created.length > 0 ? (
        <Block label="New answers here">
          <p>
            {created.length === 1
              ? "One answer is submitted for the first time in this round, so its letter starts here."
              : `${created.length} answers are submitted for the first time in this round, so their letters start here.`}
          </p>
          <ul className="ioc-debate-stances">
            {created.map((option) => (
              <li key={option.id}>
                <span className="ioc-fg">{option.createdByName}</span>
                <span className="ioc-debate-pick">
                  <span className="ioc-debate-option-key">{option.letter}</span>
                  first submitted here
                </span>
              </li>
            ))}
          </ul>
        </Block>
      ) : null}

      {round.round > 1 && round.events.length === 0 ? (
        <Block label="What happened">
          <p>
            Nobody moved and nobody leaned on a peer's argument. The agents
            restated their positions{" "}
            {scenario.attack.present
              ? "with the attack still running."
              : "and the debate held steady."}
          </p>
        </Block>
      ) : null}

      {unexplained.length > 0 ? (
        <Block label="Other moves">
          <ul className="ioc-debate-links">
            {unexplained.map((link) => (
              <LinkRow
                key={link.id}
                link={link}
                selected={selectedLinkId === link.id}
                onSelect={() =>
                  onSelectLink(selectedLinkId === link.id ? null : link.id)
                }
              />
            ))}
          </ul>
        </Block>
      ) : null}
    </div>
  );
}

/** One submitted program, behind the letter and the round it came in on. */
function ProgramRow({ option }: { option: DebateOption }) {
  const [open, setOpen] = useState(false);

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((shown) => !shown)}
        aria-expanded={open}
        className="ioc-debate-program-head"
      >
        <span className="ioc-debate-option-key">{option.letter}</span>
        <span className="ioc-debate-program-from">
          {option.createdByName}
          {option.createdRound ? ` · round ${option.createdRound}` : ""}
        </span>
        <LuChevronDown
          size={14}
          className={`ioc-chat-chevron ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <DebateCode code={option.text} name={`program-${option.letter}`} />
      ) : null}
    </li>
  );
}

/**
 * The recorded prompt, as the agents received it. The briefings run long and
 * carry their own structure — a line ending in a colon heads the part that
 * follows, and dashed lines are a list — so they are laid out rather than run
 * as one paragraph.
 */
function QuestionBody({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];

  function flush() {
    if (bullets.length > 0) {
      blocks.push(
        <ul key={`list-${blocks.length}`} className="ioc-debate-brief-list">
          {bullets.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>,
      );
      bullets = [];
    }
  }

  for (const raw of text.trim().split(/\n+/)) {
    const line = raw.trim();
    if (!line) {
      continue;
    }
    if (line.startsWith("- ") || line.startsWith("• ")) {
      bullets.push(line.slice(2).trim());
      continue;
    }
    flush();
    if (line.endsWith(":") && line.length <= 60) {
      blocks.push(
        <p key={`head-${blocks.length}`} className="ioc-debate-brief-sub">
          {line.slice(0, -1)}
        </p>,
      );
      continue;
    }
    blocks.push(
      <p key={`copy-${blocks.length}`} className="ioc-debate-question">
        {line}
      </p>,
    );
  }
  flush();

  return <>{blocks}</>;
}

/**
 * The task the agents are debating, as they received it: the question in one
 * line and the recorded prompt behind it. The answers they could give are a
 * section of their own, so either can be folded away without the other.
 */
export function DebateQuestionBlock({
  task,
  scenario,
  defaultOpen = true,
}: {
  task: DebateTask;
  scenario: DebateScenario;
  defaultOpen?: boolean;
}) {
  const [showQuestion, setShowQuestion] = useState(true);

  return (
    <div className="ioc-debate-brief-block">
      <DebateSection
        label="Question"
        preview={task.questionSummary}
        defaultOpen={defaultOpen}
      >
        <div className="space-y-3">
          <div>
            <p className="ioc-fg text-[14px] font-light leading-snug tracking-tight">
              {task.questionSummary}
            </p>
            <p className="ioc-faint mt-1 text-[13px] font-light">
              {task.title} · {scenario.name}
            </p>
          </div>

          {/* The prompt comes before the options because that is the order
              the agents met them in. */}
          <div className="ioc-debate-brief">
            <button
              type="button"
              onClick={() => setShowQuestion((open) => !open)}
              aria-expanded={showQuestion}
              className="ioc-debate-brief-head"
            >
              Read the recorded prompt
              <LuChevronDown
                size={14}
                className={`ioc-chat-chevron ${showQuestion ? "rotate-180" : ""}`}
              />
            </button>
            {showQuestion ? (
              <>
                {/* The coding tasks state their problem with worked examples
                    and a function stub, which need the code treatment rather
                    than running as paragraphs in the body font. */}
                {task.taskType === "code" ? (
                  <pre className="ioc-debate-code is-prose">
                    {scenario.question.trim()}
                  </pre>
                ) : (
                  <QuestionBody text={scenario.question} />
                )}
                {task.reviewRule ? (
                  <p className="ioc-debate-rule">{task.reviewRule}</p>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      </DebateSection>
    </div>
  );
}

/**
 * The answers on the table. A choice task lists the options it was given; a
 * coding run has none and lists the programs the agents wrote instead, each
 * behind the round and the seat it first came from.
 */
export function DebateAnswersBlock({
  task,
  scenario,
  defaultOpen = false,
}: {
  task: DebateTask;
  scenario: DebateScenario;
  defaultOpen?: boolean;
}) {
  if (!scenario.options || scenario.options.length === 0) {
    return null;
  }

  return (
    <div className="ioc-debate-brief-block">
      <DebateSection
        label={
          task.taskType === "code" ? "Programs submitted" : "Answered options"
        }
        preview={`${scenario.options.length}`}
        defaultOpen={defaultOpen}
      >
        <div className="space-y-3">
          {task.taskType === "code" ? (
            <ul className="ioc-debate-programs">
              {scenario.options.map((option) => (
                <ProgramRow key={option.id} option={option} />
              ))}
            </ul>
          ) : (
            <div>
              <ul className="ioc-debate-options">
                {scenario.options.map((option) => {
                  const correct = option.id === scenario.correctOptionId;
                  return (
                    <li
                      key={option.id}
                      className={correct ? "is-correct" : undefined}
                    >
                      <span className="ioc-debate-option-key">
                        {option.letter}
                      </span>
                      <span className="ioc-debate-option-text">
                        {option.text}
                      </span>
                      {correct ? (
                        <span className="ioc-debate-option-tag">✓ correct</span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </DebateSection>
    </div>
  );
}

/** The whole point, spread across the three readings, strongest first. */
function readingSplit(scores: Record<string, number>): string {
  return Object.entries(scores)
    .sort((left, right) => right[1] - left[1])
    .map(([label, score]) => `${label} ${score.toFixed(2)}`)
    .join(" · ");
}

/**
 * What Agent-ToM made of the debate. The detector is a model reading the
 * responses after the run, so its verdict is reported as a reading and never
 * as something the recording states: the run names no attacker, and a
 * suspected agent here is suspected by the detector alone.
 */
/**
 * Lifts the agents named in an account out of the prose: the detector spends
 * a sentence on each, and the name is what a reader is scanning for. Catches
 * the lists it writes too ("Agents 4, 2, 6, and 1").
 */
function withAgentsNamed(line: string): ReactNode[] {
  const names = /\bAgents?\s+\d+(?:\s*,\s*\d+)*(?:,?\s+and\s+\d+)?/g;
  const out: ReactNode[] = [];
  let at = 0;
  for (const match of line.matchAll(names)) {
    const start = match.index ?? 0;
    if (start > at) out.push(line.slice(at, start));
    out.push(
      <span key={`${start}`} className="ioc-fg">
        {match[0]}
      </span>,
    );
    at = start + match[0].length;
  }
  if (at < line.length) out.push(line.slice(at));
  return out;
}

/** Breaks an account into its sentences, so each can stand on its own line. */
function sentences(text: string): string[] {
  return text
    .split(/(?<=\.)\s+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/** The same glyph the agent list and the trace give an agent. */
function SuspectIcon({ seat }: { seat: DebateSeat }) {
  const Icon = vendorIcon(describeModel(seat.model).vendor);
  return <Icon size={10} />;
}

export function DetectorVerdict({
  scenario,
  lead,
  label = "Reading",
  showDecision = true,
  allAgents = false,
  onSelectSuspect,
  onHoverSuspect,
}: {
  scenario: DebateScenario;
  /** What the report itself concluded, read out before the detector's own
      account of the debate, so the two sit in one section. */
  lead?: string;
  label?: string;
  /** Dropped where the page already states the classification above this. */
  showDecision?: boolean;
  /** Lists every agent the detector read rather than only the ones it
      accuses, where the call is read as a roster. */
  allAgents?: boolean;
  /** Where given, each suspect opens its entry in the agent list below. */
  onSelectSuspect?: (seatId: string) => void;
  /** Where given, pointing at an agent here lights it wherever else the
      page is showing it. */
  onHoverSuspect?: (seatId: string | null) => void;
}) {
  const detector = scenario.detector;
  if (!detector) {
    return lead ? (
      <Block label={label}>
        <p>{lead}</p>
      </Block>
    ) : null;
  }
  const byId = new Map(scenario.seats.map((seat) => [seat.id, seat]));
  const suspects = allAgents
    ? scenario.seats.filter((seat) => seat.detector)
    : detector.suspects
        .map((id) => byId.get(id))
        .filter((seat): seat is DebateSeat => Boolean(seat));
  // Only a run that names its attackers can say whether the reading was
  // right; most recordings do not, and then the call stands on its own.
  const roster = scenario.seats.filter((seat) => seat.adversary);
  const caught =
    roster.length > 0 &&
    roster.every((seat) => detector.suspects.includes(seat.id));

  return (
    <Block label={label}>
      {lead ? <p className="mb-3">{lead}</p> : null}
      {/* The call, in one line: what it decided, how far in, who it names
          and — where the recording names its attackers — whether it was
          right about them. */}
      <p className="ioc-debate-call">
        {showDecision ? (
          <>
            <span
              className={`ioc-debate-verdict${
                detector.decision === "malicious" ? " is-danger" : " is-clear"
              }`}
            >
              {detector.decision}
            </span>
            <span className="ioc-faint">
              decision after round{" "}
              {detector.roundsAnalyzed ?? scenario.rounds.length} of{" "}
              {scenario.rounds.length}
            </span>
          </>
        ) : null}
        {suspects.length > 0 ? (
          <span className="ioc-debate-call-suspects">
            {allAgents ? "Agents:" : "Suspects:"}
            {suspects.map((seat) => {
              const body = (
                <>
                  <span className="ioc-debate-call-dot" aria-hidden>
                    <SuspectIcon seat={seat} />
                  </span>
                  {seat.name}
                  <span className="ioc-debate-call-score">
                    {typeof seat.detector?.score === "number"
                      ? `${Math.round(seat.detector.score * 100)}%`
                      : seat.detector?.label}
                  </span>
                </>
              );
              const tip = seat.detector
                ? readingSplit(seat.detector.scores)
                : undefined;
              const point = onHoverSuspect
                ? {
                    onMouseEnter: () => onHoverSuspect(seat.id),
                    onMouseLeave: () => onHoverSuspect(null),
                    onFocus: () => onHoverSuspect(seat.id),
                    onBlur: () => onHoverSuspect(null),
                  }
                : {};
              return onSelectSuspect ? (
                <button
                  key={seat.id}
                  type="button"
                  onClick={() => onSelectSuspect(seat.id)}
                  title={tip}
                  className={`ioc-debate-call-suspect is-link${seatTone(seat)}`}
                  {...point}
                >
                  {body}
                </button>
              ) : (
                <span
                  key={seat.id}
                  className={`ioc-debate-call-suspect${seatTone(seat)}`}
                  title={tip}
                  {...point}
                >
                  {body}
                </span>
              );
            })}
          </span>
        ) : (
          <span className="ioc-faint">no agent suspected</span>
        )}
        {roster.length > 0 ? (
          <span
            className={`ioc-debate-call-check${caught ? " is-right" : " is-off"}`}
            title="The seats the recording assigns as attackers, against the ones the detector names."
          >
            {caught ? "✓ right" : "✗ off"} · real attackers:{" "}
            {roster.map((seat) => seat.name).join(", ")}
          </span>
        ) : null}
      </p>
      {/* One sentence a line: the account names an agent per sentence, and
          as a block they run together. */}
      <div className="ioc-debate-sentences mt-2">
        {sentences(detector.explanation).map((line) => (
          <p key={line}>{withAgentsNamed(line)}</p>
        ))}
      </div>
      <p className="ioc-faint mt-3 text-[11px] font-light">
        Read after the run by {describeModel(detector.model).name}
        {roster.length > 0 ? "" : ". The recording itself names no attacker"}.
      </p>
    </Block>
  );
}

/**
 * Where the attackers' case was taken up, round by round. The detector's own
 * reading is reported separately, so a run nobody read still has this.
 */
export function DebateSummary({ scenario }: { scenario: DebateScenario }) {
  if (scenario.uptake.length === 0) return null;

  return (
    <Block label="Attacker arguments adopted">
      <ul className="ioc-debate-stances">
        {scenario.uptake.map((event) => (
          <li key={`${event.seat}-${event.round}`}>
            <span className="ioc-fg">
              {event.name} · round {event.round}
            </span>
            <span className="ioc-debate-pick is-danger">
              {event.optionLabel}
            </span>
          </li>
        ))}
      </ul>
    </Block>
  );
}
