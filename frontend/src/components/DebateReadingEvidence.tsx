import { useEffect, useRef, useState, type CSSProperties } from "react";
import { LuArrowDown, LuArrowRight, LuArrowUp } from "react-icons/lu";
import { ExpandMark } from "./ExpandCue";
import { vendorIcon } from "./ModelMark";
import { manipulatorHue, manipulatorTint, seatTone } from "../utils/madDebates";
import { describeModel } from "../utils/modelBadge";
import type {
  DebateRound,
  DebateScenario,
  DebateSeat,
} from "../utils/madDebates";

/** The detector works in shares of one; the list reads them as percentages. */
function percent(score: number): string {
  return `${Math.round(score * 100)}%`;
}

/** Whether the detector drew anything into this round worth a section. */
export function hasRoundEvidence(round: DebateRound): boolean {
  return round.links.some(
    (link) => link.category === "tom" || link.category === "tom-suspect",
  );
}

/** Where an answer cell scrolls to, having picked the arrow into that agent. */
export function evidenceCardId(linkId: string): string {
  return `debate-evidence-${linkId}`;
}

/** A round picked somewhere else, for the dossier to unfold and scroll to.
    The nonce lets the same round be asked for twice. */
export interface DossierPick {
  seat: string;
  round: number;
  nonce: number;
}

/** Where the call strip's suspect pills scroll to. */
export function agentAnchorId(seatId: string): string {
  return `ioc-debate-agent-${seatId}`;
}

/** The glyph the trace gives this agent; the ring takes the row's tone. */
export function AgentMark({ seat }: { seat: DebateSeat }) {
  const Icon = vendorIcon(describeModel(seat.model).vendor);
  return (
    <span className="ioc-debate-agent-mark" aria-hidden>
      <Icon size={11} />
    </span>
  );
}

/** The three shares the detector splits one point across, as a bar. */
export function SplitBar({
  scores,
  compact = false,
}: {
  scores: { honest?: number; infected?: number; manipulator?: number };
  /** Drops the three figures under the bar, for a column of several bars
      that share one key. */
  compact?: boolean;
}) {
  const parts = [
    { key: "honest", tone: "is-honest", value: scores.honest ?? 0 },
    { key: "infected", tone: "is-infected", value: scores.infected ?? 0 },
    {
      key: "manipulator",
      tone: "is-manipulator",
      value: scores.manipulator ?? 0,
    },
  ];
  return (
    <div className="ioc-debate-split">
      <div className="ioc-debate-split-bar">
        {parts.map((part) => (
          <span
            key={part.key}
            className={`ioc-debate-split-part ${part.tone}`}
            style={{ flexGrow: Math.max(part.value, 0.001) }}
          />
        ))}
      </div>
      {compact ? null : (
        <ul className="ioc-debate-split-keys">
          {parts.map((part) => (
            <li key={part.key}>
              <span
                className={`ioc-debate-split-dot ${part.tone}`}
                aria-hidden
              />
              {part.key}
              <span className="ioc-debate-split-value">
                {percent(part.value)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Everything the detector has on one agent: the split it ends on, its account
 * of the whole run, the rounds it says were clearest, and then the run itself
 * round by round — the answer given, the manipulator score and which way it
 * moved, what it made of the turn, and the arrows it drew into or out of it.
 */
function AgentDossier({
  seat,
  scenario,
  clearestOnly = false,
  onlyRound = null,
  pick = null,
  onSelectRound,
  onShowRound,
  onScrollUp,
}: {
  seat: DebateSeat;
  scenario: DebateScenario;
  /** Only the rounds the detector rests its reading on, for a column that
      has room for the case but not for the whole run. */
  clearestOnly?: boolean;
  /** Keeps the account to the one round the page is on. */
  onlyRound?: number | null;
  pick?: DossierPick | null;
  onSelectRound?: (round: number, seatId?: string) => void;
  onShowRound?: (round: number, seatId?: string) => void;
  onScrollUp?: () => void;
}) {
  // One round at a time: the account of a round is long enough that two of
  // them open at once is a wall rather than a comparison.
  // Folded to begin with, including where the page is held to one round:
  // the account of a round is something the reader asks for.
  const [openRound, setOpenRound] = useState<number | null>(null);
  const body = useRef<HTMLDivElement | null>(null);
  const reading = seat.detector;

  // A cell picked in the grid is this agent in that round: unfold the round
  // here and bring it into view, so the evidence lands beside the recording
  // the same pick scrolled.
  const picked = pick && pick.seat === seat.id ? pick.round : null;
  useEffect(() => {
    if (picked === null) {
      return;
    }
    setOpenRound(picked);
    const timer = window.setTimeout(() => {
      body.current
        ?.querySelector(`[data-dossier-round="${picked}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [picked, pick?.nonce]);

  // Moving the page to another round leaves nothing open behind it. The
  // round it mounts on is left alone, so a dossier opened by a pick keeps
  // the round that pick asked for.
  const mountedOn = useRef(onlyRound);
  useEffect(() => {
    if (mountedOn.current === onlyRound) {
      return;
    }
    mountedOn.current = onlyRound;
    setOpenRound(null);
  }, [onlyRound]);

  function toggleRound(round: number) {
    const opening = openRound !== round;
    setOpenRound(opening ? round : null);
    // Reading what the detector made of a round goes better with the turn it
    // was made of, so opening one points the trace at it.
    if (opening) {
      onShowRound?.(round, seat.id);
    }
  }

  if (!reading) return null;

  const shown =
    onlyRound !== null
      ? scenario.rounds.filter((round) => round.round === onlyRound)
      : clearestOnly
        ? scenario.rounds.filter((round) =>
            reading.keyRounds.includes(round.round),
          )
        : scenario.rounds;
  const rounds = shown.map((round) => {
    const turn = round.turns.find((entry) => entry.seat === seat.id) ?? null;
    const arrows = round.links.filter(
      (link) =>
        (link.category === "tom" || link.category === "tom-suspect") &&
        (link.to === seat.id || link.from === seat.id),
    );
    return { round: round.round, turn, arrows };
  });

  return (
    <div className="ioc-debate-agent-body" ref={body}>
      <SplitBar scores={reading.scores} />

      <p className="ioc-copy mt-3 text-[13px] font-light leading-[1.55]">
        {reading.reading}
      </p>

      {reading.keyRounds.length > 0 ? (
        <p className="ioc-faint mt-2 text-[12px] font-light">
          Clearest at{" "}
          {reading.keyRounds.map((round, index) => (
            <span key={round}>
              {index > 0 ? ", " : ""}
              <button
                type="button"
                onClick={() => onSelectRound?.(round, seat.id)}
                className="ioc-debate-agent-round-link"
              >
                round {round}
              </button>
            </span>
          ))}
          .
        </p>
      ) : null}

      <div className="ioc-debate-agent-evidence">
        {/* Where the page is held to one round, the rail above already
            says which, so the list goes without a heading. */}
        {onlyRound === null ? (
          <p className="ioc-kicker">
            {clearestOnly ? "Clearest rounds" : "Evidence by round"}
          </p>
        ) : null}
        <ul className="ioc-debate-agent-rounds">
          {rounds.map((entry) => {
            const detector = entry.turn?.detector;
            const score = detector?.scores.manipulator ?? null;
            const move = detector?.change?.manipulator ?? null;
            const open = openRound === entry.round;
            const clearest = reading.keyRounds.includes(entry.round);
            const tellable =
              Boolean(detector?.summary) || entry.arrows.length > 0;
            return (
              <li
                key={entry.round}
                data-dossier-round={entry.round}
                className={`ioc-debate-agent-round${open ? " is-open" : ""}`}
                // Opened, the card is edged in the score the detector gave
                // this round, the same colour the turn takes in the trace.
                style={
                  score === null
                    ? undefined
                    : ({
                        "--round-tone": manipulatorHue(score),
                      } as CSSProperties)
                }
              >
                <button
                  type="button"
                  onClick={() => toggleRound(entry.round)}
                  aria-expanded={open}
                  disabled={!tellable}
                  className={`ioc-debate-agent-round-head${clearest ? " is-key" : ""}`}
                >
                  {/* A round with nothing said about it keeps the indent, so
                    the numbers under it still line up. */}
                  {tellable ? (
                    <ExpandMark open={open} />
                  ) : (
                    <span className="ioc-debate-agent-round-gap" aria-hidden />
                  )}
                  <span className="ioc-fg">Round {entry.round}</span>
                  {clearest ? (
                    <span
                      className="ioc-debate-agent-clearest"
                      title="A round the detector rests its reading of this agent on."
                    >
                      clearest
                    </span>
                  ) : null}
                  {entry.turn?.optionLetter ? (
                    <span className="ioc-debate-agent-answer">
                      {entry.turn.optionLetter}
                    </span>
                  ) : null}
                  {score === null ? null : (
                    <span
                      className="ioc-debate-agent-round-score"
                      style={{ background: manipulatorTint(score) }}
                    >
                      {percent(score)}
                    </span>
                  )}
                  {move !== null && Math.abs(move) >= 0.01 ? (
                    <span
                      className={`ioc-debate-agent-move${move > 0 ? " is-up" : " is-down"}`}
                    >
                      {move > 0 ? (
                        <LuArrowUp size={11} aria-hidden />
                      ) : (
                        <LuArrowDown size={11} aria-hidden />
                      )}
                      {percent(Math.abs(move))}
                    </span>
                  ) : null}
                </button>
                {open ? (
                  <div className="ioc-debate-agent-round-body">
                    {detector?.summary ? (
                      <p className="ioc-copy text-[12.5px] font-light leading-[1.5]">
                        {detector.summary}
                      </p>
                    ) : null}
                    {entry.arrows.map((link) => (
                      <p key={link.id} className="ioc-debate-agent-arrow">
                        {link.to === seat.id
                          ? `moved by ${link.fromName}`
                          : `moved ${link.toName}`}
                        {link.fromRound !== null &&
                        link.fromRound !== entry.round
                          ? ` · from round ${link.fromRound}`
                          : ""}
                      </p>
                    ))}
                    {onSelectRound ? (
                      <button
                        type="button"
                        onClick={() => onSelectRound(entry.round, seat.id)}
                        className="ioc-debate-agent-round-link"
                      >
                        Open round {entry.round}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>

      {onScrollUp ? (
        <button
          type="button"
          onClick={onScrollUp}
          className="ioc-debate-agent-up"
        >
          <LuArrowUp size={12} aria-hidden />
          Back to the explanation
        </button>
      ) : null}
    </div>
  );
}

/**
 * What Agent-ToM itself found, either across the whole debate or inside one
 * round: how it read each agent, and the turns it says moved them. Where
 * nobody read the run, the arrows the view drew from the answers stand in.
 */
export function DebateReadingEvidence({
  scenario,
  round,
  clearestOnly = false,
  onlyRound = null,
  suspectsOnly = false,
  openSeatId = null,
  pick = null,
  onToggleSeat,
  onSelectRound,
  onShowRound,
  onScrollUp,
  selectedLinkId = null,
  onSelectLink,
}: {
  scenario: DebateScenario;
  round: DebateRound | null;
  /** Keeps each agent's account to the rounds it rests on. */
  clearestOnly?: boolean;
  /** Keeps each agent's account to the one round the page is on. */
  onlyRound?: number | null;
  /** Lists only the agents the detector ends up calling manipulators. */
  suspectsOnly?: boolean;
  /** Which agent is unfolded, held by the view so the call strip can open one. */
  openSeatId?: string | null;
  /** A round picked elsewhere, to unfold in the agent it belongs to. */
  pick?: DossierPick | null;
  onToggleSeat?: (seatId: string) => void;
  /** Opens a round from the agent's own account of it. */
  onSelectRound?: (round: number, seatId?: string) => void;
  /** Points a trace shown beside this list at a round, without leaving the
      list: unfolding a round in an agent's account calls it. */
  onShowRound?: (round: number, seatId?: string) => void;
  /** Back to the call the list is answering, for a reader sent down here. */
  onScrollUp?: () => void;
  /** The arrow lit in the graph, so picking one here lights it there. The
      seat is the agent the arrow points at, for the trace to scroll to. */
  selectedLinkId?: string | null;
  onSelectLink?: (linkId: string | null, seat?: string) => void;
}) {
  const read = scenario.seats.filter(
    (seat) =>
      seat.detector && (!suspectsOnly || seat.detector.label === "manipulator"),
  );

  if (round === null) {
    if (read.length === 0) {
      return (
        <p className="ioc-copy text-[13px] font-light leading-[1.55]">
          Nobody read this debate agent by agent. The evidence is the recording
          itself: the answers each round and the arrows between them.
        </p>
      );
    }
    return (
      <ul className="ioc-debate-agents">
        {read.map((seat) => {
          const reading = seat.detector;
          if (!reading) {
            return null;
          }
          const open = openSeatId === seat.id;
          return (
            <li
              key={seat.id}
              id={agentAnchorId(seat.id)}
              className={`ioc-debate-agent${seatTone(seat)}${
                open ? " is-open" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => onToggleSeat?.(seat.id)}
                aria-expanded={open}
                className={`ioc-debate-agent-head${seatTone(seat)}`}
                title={`Agent-ToM reads ${seat.name} as ${reading.label}`}
              >
                <ExpandMark open={open} />
                <AgentMark seat={seat} />
                <span className="ioc-fg">{seat.name}</span>
                <span className="ioc-faint">{reading.label}</span>
                {reading.score === null ? null : (
                  <span className="ioc-confidence-tag ioc-debate-agent-score">
                    {percent(reading.score)}
                  </span>
                )}
              </button>
              {open ? (
                <AgentDossier
                  seat={seat}
                  scenario={scenario}
                  clearestOnly={clearestOnly}
                  onlyRound={onlyRound}
                  pick={pick}
                  onSelectRound={onSelectRound}
                  onShowRound={onShowRound}
                  onScrollUp={onScrollUp}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    );
  }

  const arrows = round.links.filter(
    (link) => link.category === "tom" || link.category === "tom-suspect",
  );

  if (arrows.length === 0) {
    return (
      <p className="ioc-copy text-[13px] font-light leading-[1.55]">
        The detector drew no arrow into this round. What the round holds is the
        answers themselves, above this.
      </p>
    );
  }

  // One agent moving another is a finding about the round, so it is carded
  // and lit like one, and picking it lights its arrow.
  return (
    <ul className="ioc-debate-evidence">
      {arrows.map((link) => {
        const active = selectedLinkId === link.id;
        const suspect = link.attack || link.category === "tom-suspect";
        return (
          <li key={link.id} id={evidenceCardId(link.id)}>
            <button
              type="button"
              onClick={() => onSelectLink?.(active ? null : link.id, link.to)}
              aria-expanded={active}
              className={`ioc-debate-evidence-card${suspect ? " is-danger" : ""}${active ? " is-active" : ""}`}
            >
              <span className="ioc-debate-evidence-head">
                <ExpandMark open={active} />
                <span className="ioc-fg">{link.fromName}</span>
                <LuArrowRight size={11} aria-hidden />
                <span className="ioc-fg">{link.toName}</span>
                {link.fromRound !== null && link.fromRound !== round.round ? (
                  <span className="ioc-faint">from round {link.fromRound}</span>
                ) : null}
              </span>
              {/* The detector writes one sentence per turn and hangs it on
                  every arrow into that turn, so it waits to be asked for. */}
              {active && link.interpretation ? (
                <span className="ioc-copy text-[12.5px] font-light leading-[1.5]">
                  {link.interpretation}
                </span>
              ) : null}
              {/* Why the card is the colour it is, said where it is being
                    read rather than in a key underneath the list. */}
              {active ? (
                <span className="ioc-faint text-[11px] font-light">
                  {suspect
                    ? `Marked in red because the detector reads ${link.fromName} as working against the group, so it counts this as part of the attack.`
                    : `Left plain because the detector ties nothing in ${link.fromName}'s turn to the attack: it reads this as one agent taking up another's argument.`}
                </span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
