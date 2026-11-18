import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { LuChevronDown, LuTriangleAlert } from "react-icons/lu";
import { DebateCode } from "./DebateCode";
import { vendorIcon } from "./ModelMark";
import {
  manipulatorHue,
  type DebateSeat,
  type DebateTurn,
} from "../utils/madDebates";
import { describeModel } from "../utils/modelBadge";

const PREVIEW = 220;

function markElementId(linkId: string): string {
  return `debate-mark-${linkId}`;
}

function turnElementId(seat: string): string {
  return `debate-turn-${seat}`;
}

function preview(text: string): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed.length <= PREVIEW
    ? collapsed
    : `${collapsed.slice(0, PREVIEW).trimEnd()}…`;
}

function Body({
  turn,
  selectedLinkId,
  onSelectLink,
}: {
  turn: DebateTurn;
  selectedLinkId: string | null;
  onSelectLink: (linkId: string | null) => void;
}) {
  if (turn.marks.length === 0) {
    return <pre className="ioc-chat-body">{turn.text}</pre>;
  }
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const mark of turn.marks) {
    if (mark.start > cursor) {
      parts.push(turn.text.slice(cursor, mark.start));
    }
    const active = selectedLinkId === mark.linkId;
    parts.push(
      <mark
        key={mark.linkId}
        id={markElementId(mark.linkId)}
        role="button"
        tabIndex={0}
        className={`ioc-chat-mark ioc-debate-mark is-${mark.category}${
          active ? " ioc-chat-mark-focus" : ""
        }`}
        onClick={() => onSelectLink(active ? null : mark.linkId)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelectLink(active ? null : mark.linkId);
          }
        }}
      >
        {turn.text.slice(mark.start, mark.end)}
      </mark>,
    );
    cursor = mark.end;
  }
  if (cursor < turn.text.length) {
    parts.push(turn.text.slice(cursor));
  }
  return <pre className="ioc-chat-body">{parts}</pre>;
}

function Turn({
  turn,
  model,
  role,
  adversary,
  reading,
  expanded,
  focused,
  focusSuspect,
  selectedLinkId,
  onToggle,
  onSelectLink,
}: {
  turn: DebateTurn;
  model: string;
  role: string;
  adversary: boolean;
  /** What the detector calls this agent, where it read the debate. */
  reading: { label: string; suspect: boolean } | null;
  expanded: boolean;
  focused: boolean;
  /** Red where what pointed here is a move the detector reads as the attack. */
  focusSuspect: boolean;
  selectedLinkId: string | null;
  onToggle: () => void;
  onSelectLink: (linkId: string | null) => void;
}) {
  const badge = describeModel(model);
  const Logo = vendorIcon(badge.vendor);
  // A pointed-at response is lit in the score the detector gave this agent
  // here, so a turn in the recording is the colour of its cell in the grid.
  // Only a round the detector said nothing about falls back to the reading
  // of the agent as a whole.
  const score = turn.detector?.scores.manipulator ?? null;
  const tone =
    score !== null
      ? ""
      : focusSuspect || reading?.suspect
        ? " is-danger"
        : reading?.label === "infected"
          ? " is-watch"
          : "";
  return (
    <li
      id={turnElementId(turn.seat)}
      className={`ioc-chat-row ioc-chat-row-agent${
        reading?.suspect ? " is-suspect" : ""
      }${focused ? ` is-focused${tone}` : ""}`}
      style={
        score === null
          ? undefined
          : ({ "--turn-tone": manipulatorHue(score) } as CSSProperties)
      }
    >
      <div className="ioc-chat-identity">
        <span
          className={`ioc-chat-avatar ioc-chat-avatar-agent${
            adversary || reading?.suspect
              ? " is-adversary"
              : reading?.label === "infected"
                ? " is-watch"
                : ""
          }`}
          aria-hidden="true"
        >
          {/* The avatar stays the model's mark whatever the detector made of
              the agent; only its ring takes the reading's tone. */}
          {adversary ? <LuTriangleAlert size={14} /> : <Logo size={13} />}
        </span>
        <span className="ioc-chat-who">{turn.name}</span>
        {model ? <span className="ioc-chat-model">{badge.name}</span> : null}
        {role ? <span className="ioc-chat-model">{role}</span> : null}
        {adversary ? (
          <span className="ioc-debate-flag is-danger">attacker</span>
        ) : reading?.suspect || reading?.label === "infected" ? (
          // The two readings worth saying out loud: the agent it accuses, and
          // the one it reads as carried along by the accused.
          <span
            className={`ioc-debate-flag ${
              reading.suspect ? "is-danger" : "is-watch"
            }`}
            title={`Agent-ToM reads this agent as ${reading.label}`}
          >
            {reading.label}
          </span>
        ) : null}
      </div>
      <div className="ioc-chat-stack">
        <div className="ioc-chat-bubble ioc-chat-bubble-agent">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className="ioc-chat-toggle is-labeled"
          >
            <span className="ioc-chat-meta">
              <span
                className={`ioc-chat-role${turn.correct ? " is-correct" : ""}`}
              >
                {turn.optionShort}
              </span>
              {turn.changed ? (
                <span className="ioc-debate-flag">changed answer</span>
              ) : null}
            </span>
            <LuChevronDown
              size={14}
              className={`ioc-chat-chevron ${expanded ? "rotate-180" : ""}`}
            />
          </button>
          {expanded ? (
            <>
              <Body
                turn={turn}
                selectedLinkId={selectedLinkId}
                onSelectLink={onSelectLink}
              />
              {turn.answer ? (
                <DebateCode
                  code={turn.answer}
                  name={`program-${turn.optionLetter}`}
                />
              ) : null}
            </>
          ) : (
            <p className="ioc-chat-preview">{preview(turn.text)}</p>
          )}
        </div>
      </div>
    </li>
  );
}

export function DebateTurnList({
  round,
  turns,
  seats,
  selectedLinkId,
  focusSeat,
  focusSuspect = false,
  focusNonce = 0,
  focusScroll = true,
  onSelectLink,
}: {
  round: number;
  turns: DebateTurn[];
  seats: DebateSeat[];
  selectedLinkId: string | null;
  /** Seat whose answer was opened from the vote timeline. */
  focusSeat: string | null;
  /** Whether the thing pointing at that response is suspect evidence. */
  focusSuspect?: boolean;
  /** Bumped on every pick, so asking for the same response again still
      brings it back into view. */
  focusNonce?: number;
  /** Off where the caller scrolls the recording itself, to the round. */
  focusScroll?: boolean;
  onSelectLink: (linkId: string | null) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const listRef = useRef<HTMLOListElement | null>(null);

  // A new round starts collapsed, so the column opens on an overview of who
  // said what rather than five full responses.
  useEffect(() => {
    setExpanded(new Set());
  }, [round]);

  // Selecting a link anywhere on the page opens the response it quoted and
  // brings the highlighted sentence into view.
  useEffect(() => {
    if (!selectedLinkId) {
      return;
    }
    const owner = turns.find((turn) =>
      turn.marks.some((mark) => mark.linkId === selectedLinkId),
    );
    if (!owner) {
      return;
    }
    setExpanded((current) =>
      current.has(owner.seat) ? current : new Set(current).add(owner.seat),
    );
    const timer = window.setTimeout(() => {
      const node = listRef.current?.querySelector(
        `#${CSS.escape(markElementId(selectedLinkId))}`,
      );
      node?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 60);
    return () => window.clearTimeout(timer);
  }, [selectedLinkId, turns]);

  // Picking a vote in the timeline points at one response: open it and bring
  // it into view, the same way a quoted sentence does.
  useEffect(() => {
    if (!focusSeat || !turns.some((turn) => turn.seat === focusSeat)) {
      return;
    }
    setExpanded((current) =>
      current.has(focusSeat) ? current : new Set(current).add(focusSeat),
    );
    if (!focusScroll) {
      return;
    }
    const timer = window.setTimeout(() => {
      const node = listRef.current?.querySelector(
        `#${CSS.escape(turnElementId(focusSeat))}`,
      );
      node?.scrollIntoView({ block: "start", behavior: "smooth" });
    }, 60);
    return () => window.clearTimeout(timer);
  }, [focusSeat, focusNonce, focusScroll, round, turns]);

  const allOpen =
    turns.length > 0 && turns.every((turn) => expanded.has(turn.seat));
  const byId = new Map(seats.map((seat) => [seat.id, seat]));

  return (
    <div
      className="ioc-chat-panel ioc-cite-panel mt-3 flex min-h-0 flex-col gap-3"
      data-cite-tone="danger"
    >
      <button
        type="button"
        onClick={() =>
          setExpanded(allOpen ? new Set() : new Set(turns.map((t) => t.seat)))
        }
        className="ioc-link self-end pr-1.5 text-[11px]"
      >
        {allOpen ? "Collapse all" : "Expand all"}
      </button>
      <ol ref={listRef} className="ioc-chat">
        {turns.map((turn) => (
          <Turn
            key={turn.seat}
            turn={turn}
            model={byId.get(turn.seat)?.model ?? ""}
            role={byId.get(turn.seat)?.role ?? ""}
            adversary={Boolean(byId.get(turn.seat)?.adversary)}
            reading={
              // What the detector made of this turn, not of the whole run:
              // inside a round the verdict has not been reached yet.
              turn.detector
                ? {
                    label: turn.detector.label,
                    suspect: turn.detector.label === "manipulator",
                  }
                : null
            }
            expanded={expanded.has(turn.seat)}
            focused={focusSeat === turn.seat}
            focusSuspect={focusSuspect}
            selectedLinkId={selectedLinkId}
            onSelectLink={onSelectLink}
            onToggle={() =>
              setExpanded((current) => {
                const next = new Set(current);
                if (next.has(turn.seat)) {
                  next.delete(turn.seat);
                } else {
                  next.add(turn.seat);
                }
                return next;
              })
            }
          />
        ))}
      </ol>
    </div>
  );
}

/**
 * Who the detector suspects, under the influence graph. The graph colours
 * those agents, and this says what the colour means without a click.
 */
export function DetectorNote({ seats }: { seats: DebateSeat[] }) {
  const read = seats.filter((seat) => seat.detector);
  if (read.length === 0) {
    return null;
  }
  const suspects = read.filter((seat) => seat.detector?.suspect);
  const carried = read.filter(
    (seat) => !seat.detector?.suspect && seat.detector?.label === "infected",
  );

  return (
    <>
      {suspects.length > 0 ? (
        <p className="ioc-debate-adversary">
          <LuTriangleAlert size={12} />
          Agent-ToM reads {listNames(suspects)} as{" "}
          {suspects.length === 1 ? "a manipulator" : "manipulators"}.
        </p>
      ) : null}
      {carried.length > 0 ? (
        <p className="ioc-debate-watch">
          {listNames(carried)} {carried.length === 1 ? "is" : "are"} read as
          infected: carried along by the argument rather than making it.
        </p>
      ) : null}
    </>
  );
}

function listNames(seats: DebateSeat[]): string {
  const all = seats.map((seat) => seat.name);
  return all.length <= 1
    ? (all[0] ?? "")
    : `${all.slice(0, -1).join(", ")} and ${all[all.length - 1]}`;
}

/** Marks the adversary seats under the influence graph. */
export function AdversaryNote({ names }: { names: string[] }) {
  if (names.length === 0) {
    return null;
  }
  return (
    <p className="ioc-debate-adversary">
      <LuTriangleAlert size={12} />
      {names.join(" and ")} {names.length === 1 ? "is" : "are"} the assigned
      attacker{names.length === 1 ? "" : "s"}.
    </p>
  );
}
