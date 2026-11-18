import { useEffect, useMemo, useRef, useState } from "react";
import {
  LuChevronLeft,
  LuChevronRight,
  LuExternalLink,
  LuPause,
  LuPlay,
} from "react-icons/lu";
import type { PipelineEvidence } from "../utils/evidencePipeline";
import type { ModelReasoningSection } from "../utils/modelReasoning";
import { formatConfidencePercent } from "../utils/detectiveResult";
import { DebateDetectorGrid } from "./DebateDetectorGrid";
import {
  AgentMark,
  DebateReadingEvidence,
  type DossierPick,
} from "./DebateReadingEvidence";
import { DebateSplitDial } from "./DebateSplitDial";
import { DebateAnswersBlock, DetectorVerdict } from "./DebateExplanation";
import { DebateInfluenceGraph } from "./DebateInfluenceGraph";
import { DebateSeatTip } from "./DebateSeatTip";
import { DebateTraceRound } from "./DebateTraceRound";
import { DebateTurnList } from "./DebateTurnList";
import type { VotePick } from "./DebateVoteTimeline";
import { SegmentGauge, type WidgetTone } from "./StatWidget";
import { SentenceProse } from "./SentenceProse";
import { aggregateEdges, seatTone } from "../utils/madDebates";
import type {
  DebateRound,
  DebateScenario,
  DebateTask,
} from "../utils/madDebates";

type VerdictTone = "danger" | "success" | "warning";

interface InvestigationResultSlideshowProps {
  applicationName?: string;
  applicationHref?: string | null;
  traceName?: string;
  traceHref?: string | null;
  verdictLabel: string;
  verdictTone: VerdictTone;
  techniqueLabel: string;
  description: string;
  model?: string;
  durationSeconds?: number;
  confidence?: number | null;
  reasoningSections: ModelReasoningSection[] | null;
  evidence: PipelineEvidence[];
  appId?: string;
  /** The debate behind the run, where the report has one. */
  scenario?: DebateScenario | null;
  /** The call the debate was answering, for the agents' tooltips. */
  task?: DebateTask | null;
  /** The slide to open on, by label, with a nonce so the same slide can be
      asked for again. Without it the deck opens on the verdict. */
  startSlide?: { label: string; nonce: number } | null;
}

const TONE_TEXT: Record<VerdictTone, string> = {
  danger: "sev-danger-text",
  success: "sev-success-text",
  warning: "sev-warning-text",
};

function chartTone(tone: VerdictTone): WidgetTone {
  if (tone === "danger" || tone === "success") {
    return tone;
  }
  return "default";
}

function confidencePercent(value?: number | null): number | null {
  const label = formatConfidencePercent(value);
  if (!label) {
    return null;
  }
  return Number(label.replace("%", ""));
}

function averageEvidenceConfidence(
  evidence: PipelineEvidence[],
): number | null {
  const scores = evidence
    .map((item) => confidencePercent(item.confidence))
    .filter((value): value is number => value != null);
  if (scores.length === 0) {
    return null;
  }
  return Math.round(
    scores.reduce((sum, value) => sum + value, 0) / scores.length,
  );
}

function VerdictChart({
  tone,
  evidence,
  confidence,
}: {
  tone: VerdictTone;
  evidence: PipelineEvidence[];
  confidence?: number | null;
}) {
  const percent =
    confidencePercent(confidence) ?? averageEvidenceConfidence(evidence);

  const swatch =
    tone === "danger"
      ? "var(--sev-danger)"
      : tone === "success"
        ? "var(--sev-success)"
        : "var(--ioc-kicker)";

  return (
    <div className="flex w-full max-w-[260px] flex-col items-center">
      <SegmentGauge
        value={percent}
        tone={chartTone(tone)}
        size={248}
        caption="Confidence"
      />
      <p className="ioc-kicker mt-1 inline-flex items-center gap-2">
        <span
          aria-hidden="true"
          className="h-[3px] w-4 rounded-full"
          style={{
            background: swatch,
            boxShadow: `0 0 8px color-mix(in srgb, ${swatch} 70%, transparent)`,
          }}
        />
        Confidence
      </p>
    </div>
  );
}

/**
 * One dial per agent rather than one for the run: the three shares
 * Agent-ToM splits a point across — honest, infected, manipulator — each
 * glowing round an open ring, with the share that won the reading in the
 * middle of it.
 */
/** A share of one as a percentage, for the dials' tooltips. */
function share(value?: number): string {
  return `${Math.round((value ?? 0) * 100)}%`;
}

function AgentSplits({
  scenario,
  lit = null,
}: {
  scenario: DebateScenario;
  /** The agent being pointed at elsewhere on the slide, brought forward
      here while the others stand back. */
  lit?: string | null;
}) {
  const read = scenario.seats.filter((seat) => seat.detector);
  if (read.length === 0) {
    return null;
  }
  // Three to a row, which a debate of six fills twice over; one or two
  // agents keep a row to themselves at a size the ring can carry.
  const perRow = Math.min(read.length, 3);
  const columns =
    perRow === 1 ? "grid-cols-1" : perRow === 2 ? "grid-cols-2" : "grid-cols-3";
  const size = perRow === 1 ? 240 : perRow === 2 ? 190 : 146;
  return (
    <div className="ioc-no-scrollbar flex max-h-full w-full max-w-[460px] flex-col overflow-y-auto">
      <ul
        // The rows carry a name and a label under each ring, so the gap is
        // set here rather than left to a utility: it has to read as space
        // between two rows, not as a caption drifting from its dial.
        style={{ rowGap: "2.5rem" }}
        className={`ioc-debate-dials grid ${columns} gap-x-3${
          lit ? " is-picking" : ""
        }`}
      >
        {read.map((seat, index) => {
          const reading = seat.detector;
          if (!reading) {
            return null;
          }
          return (
            <li
              key={seat.id}
              className={`flex flex-col items-center${
                lit === seat.id ? " is-lit" : ""
              }`}
            >
              <DebateSplitDial
                size={size}
                edge={
                  perRow === 1
                    ? undefined
                    : index % perRow === 0
                      ? "start"
                      : index % perRow === perRow - 1
                        ? "end"
                        : undefined
                }
                tipBelow={index < perRow}
                scores={reading.scores}
                label={reading.label}
                value={reading.score}
                caption={`${seat.name} · ${reading.label} ${Math.round(
                  (reading.score ?? 0) * 100,
                )}%`}
                tip={`${seat.name} · honest ${share(
                  reading.scores.honest,
                )} · infected ${share(
                  reading.scores.infected,
                )} · manipulator ${share(reading.scores.manipulator)}`}
              />
              {/* The ring stops short of closing, so the name is pulled up
                  into the gap it leaves, behind the mark of the model that
                  answered. */}
              <p
                className={`-mt-[18%] flex items-center gap-1.5 text-[12px] font-light ioc-fg${seatTone(seat)}`}
              >
                <AgentMark seat={seat} />
                {seat.name}
              </p>
              <p className="ioc-faint text-[10px] font-light uppercase leading-tight tracking-[0.06em]">
                {reading.label}
              </p>
            </li>
          );
        })}
      </ul>
      <p className="ioc-faint mt-2 text-center text-[11px] font-light leading-[1.5]">
        One point split three ways per agent. The figure in the ring is the
        reading it settled on; hover a ring for all three.
      </p>
    </div>
  );
}

function SlideFrame({
  art,
  children,
}: {
  art: React.ReactNode;
  children: React.ReactNode;
}) {
  // Two equal halves on a wide screen. The slide itself is what scrolls — the
  // words simply run as long as they need to — and the art sticks to the top
  // of that scroll, held a screen tall so it reads as centred on the page.
  return (
    <div className="flex flex-col lg:grid lg:grid-cols-2 lg:items-start lg:gap-12">
      <div className="flex flex-col lg:mx-auto lg:min-h-[calc(100dvh-16rem)] lg:w-full lg:max-w-xl lg:justify-center">
        {children}
      </div>
      <div className="hidden items-center justify-center lg:sticky lg:top-0 lg:flex lg:h-[calc(100dvh-16rem)]">
        {art}
      </div>
    </div>
  );
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function formatDuration(seconds?: number): string | null {
  if (seconds === undefined || seconds === null || Number.isNaN(seconds)) {
    return null;
  }
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const rem = Math.round(seconds % 60);
  return rem ? `${mins}m ${rem}s` : `${mins}m`;
}

function ContextLink({
  label,
  href,
}: {
  label?: string;
  href?: string | null;
}) {
  if (!label) {
    return null;
  }
  if (!href) {
    return <span className="ioc-faint">{label}</span>;
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={`Open ${label} in a new tab`}
      className="ioc-link inline-flex items-center gap-1.5"
    >
      {label}
      <LuExternalLink size={12} />
    </a>
  );
}

function VerdictSlide({
  applicationName,
  applicationHref,
  traceName,
  traceHref,
  verdictLabel,
  verdictTone,
  techniqueLabel,
  description,
  model,
  durationSeconds,
  evidence,
  confidence,
  scenario,
}: Pick<
  InvestigationResultSlideshowProps,
  | "applicationName"
  | "applicationHref"
  | "traceName"
  | "traceHref"
  | "verdictLabel"
  | "verdictTone"
  | "techniqueLabel"
  | "description"
  | "model"
  | "durationSeconds"
  | "evidence"
  | "confidence"
  | "scenario"
>) {
  // Pointing at an agent in the call brings its dial forward on the right.
  const [litSeat, setLitSeat] = useState<string | null>(null);
  const duration = formatDuration(durationSeconds);
  return (
    <SlideFrame
      art={
        // Where the run is a debate, what the detector made of each agent
        // says more than one confidence dial for the whole report.
        scenario?.detector ? (
          <AgentSplits scenario={scenario} lit={litSeat} />
        ) : (
          <VerdictChart
            tone={verdictTone}
            evidence={evidence}
            confidence={confidence}
          />
        )
      }
    >
      <div className="flex flex-col">
        {applicationName || traceName ? (
          <p className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
            <ContextLink label={applicationName} href={applicationHref} />
            {applicationName && traceName ? (
              <span className="ioc-faint" aria-hidden="true">
                ·
              </span>
            ) : null}
            <ContextLink label={traceName} href={traceHref} />
          </p>
        ) : null}
        <div
          className={`ioc-glass ioc-class-panel is-${verdictTone} w-full max-w-2xl rounded-lg px-5 py-4`}
        >
          <p className="ioc-kicker">Classification</p>
          <h2
            className={`mt-2 text-4xl font-light leading-[0.95] tracking-tight md:text-5xl ${TONE_TEXT[verdictTone]}`}
          >
            {verdictLabel}
          </h2>
        </div>
        <div className="mt-5">
          <p className="ioc-kicker">Detector</p>
          <p className="ioc-fg mt-1 text-[15px] font-light">{techniqueLabel}</p>
        </div>
        {/* Where the run is a debate, the verdict is explained by the
            detector that read it rather than by the report's own summary. */}
        <div className="mt-4 max-w-2xl">
          {scenario?.detector ? (
            <DetectorVerdict
              scenario={scenario}
              onHoverSuspect={setLitSeat}
              label="Why this verdict"
              showDecision={false}
              allAgents
            />
          ) : (
            <>
              <p className="ioc-kicker">Why this verdict</p>
              <SentenceProse
                text={description}
                className="ioc-copy mt-1 text-[13px] leading-[1.5]"
              />
            </>
          )}
        </div>
        {model || duration ? (
          <div className="ioc-copy mt-6 flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px]">
            {model ? <span>Model · {model}</span> : null}
            {duration ? <span>Duration · {duration}</span> : null}
          </div>
        ) : null}
      </div>
    </SlideFrame>
  );
}

/**
 * The debate itself: the run as a grid and the detector's case against each
 * agent on one side, the recording on the other. Picking a cell in the grid,
 * or a round in an agent's account, scrolls the recording to that round and
 * lights the turn, so the reading and the turn it was made of stay together.
 */
/**
 * The round the slide is on, with the whole run to pick from and a walk
 * through it. It runs across the slide rather than down one column, because
 * everything under it — the graph, the grid, the recording — is about the
 * round it is on.
 */
function RoundRail({
  rounds,
  active,
  previous,
  next,
  playing,
  onGo,
  onTogglePlay,
}: {
  rounds: DebateRound[];
  /** Null is the whole run at once, which the rail opens on. */
  active: number | null;
  previous: number | null;
  next: number | null;
  playing: boolean;
  onGo: (round: number | null) => void;
  onTogglePlay: () => void;
}) {
  return (
    <div className="ioc-hairline mb-4 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b pb-3">
      <p className="ioc-kicker">Round</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {/* The run before any one round of it, for a reader who has not
            picked a round yet. */}
        <button
          type="button"
          onClick={() => onGo(null)}
          aria-pressed={active === null}
          className={`ioc-round-chip is-wide${
            active === null ? " is-active" : ""
          }`}
        >
          Overview
        </button>
        {rounds.map((entry) => (
          <button
            key={entry.round}
            type="button"
            onClick={() => onGo(entry.round)}
            aria-pressed={entry.round === active}
            className={`ioc-round-chip${
              entry.round === active ? " is-active" : ""
            }`}
          >
            {entry.round}
          </button>
        ))}
      </div>
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={() => previous !== null && onGo(previous)}
          disabled={previous === null}
          title="Previous round"
          aria-label="Previous round"
          className="ioc-round-chip is-step is-icon"
        >
          <LuChevronLeft size={13} aria-hidden />
        </button>
        <button
          type="button"
          onClick={onTogglePlay}
          aria-pressed={playing}
          className={`ioc-round-chip is-step${playing ? " is-active" : ""}`}
        >
          {playing ? (
            <LuPause size={13} aria-hidden />
          ) : (
            <LuPlay size={13} aria-hidden />
          )}
          {playing ? "Pause" : "Play"}
        </button>
        <button
          type="button"
          onClick={() => next !== null && onGo(next)}
          disabled={next === null}
          title="Next round"
          aria-label="Next round"
          className="ioc-round-chip is-step is-icon"
        >
          <LuChevronRight size={13} aria-hidden />
        </button>
      </div>
    </div>
  );
}

function DebateSlide({
  scenario,
  task,
}: {
  scenario: DebateScenario;
  task?: DebateTask | null;
}) {
  const [picked, setPicked] = useState<VotePick | null>(null);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  // Bumped on every pick, so asking for the same response twice still brings
  // it back into view.
  const [focusNonce, setFocusNonce] = useState(0);
  const traceRef = useRef<HTMLDivElement | null>(null);
  // One round of the recording is unfolded at a time: the one the rail
  // above is on, or whichever round was asked for from the grid.
  const [shownRound, setShownRound] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const at = scenario.rounds.findIndex((entry) => entry.round === shownRound);
  const previous =
    shownRound === null ? null : at > 0 ? scenario.rounds[at - 1].round : null;
  const next =
    shownRound === null
      ? (scenario.rounds[0]?.round ?? null)
      : at >= 0 && at + 1 < scenario.rounds.length
        ? scenario.rounds[at + 1].round
        : null;
  function scrollTrace(round: number) {
    requestAnimationFrame(() => {
      traceRef.current
        ?.querySelector(`[data-round="${round}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function openRound(round: number, seat?: string) {
    // A cell is an agent in a round, so it opens everything about that
    // agent there: that round of its evidence below the grid, the arrow the
    // detector drew into its turn, and the turn itself on the recording.
    const entry = scenario.rounds.find((item) => item.round === round) ?? null;
    const arrow = seat
      ? (entry?.links.find(
          (link) =>
            link.to === seat &&
            (link.category === "tom" || link.category === "tom-suspect"),
        ) ?? null)
      : null;
    setSelectedLinkId(arrow?.id ?? null);
    setPicked({ seat: seat ?? "", round });
    setFocusNonce((count) => count + 1);
    setShownRound(round);
    scrollTrace(round);
  }

  // Playing walks the rounds a timeout at a time, so picking a round by
  // hand mid-walk cannot leave two timers running.
  useEffect(() => {
    if (!playing) {
      return;
    }
    if (next === null) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => openRound(next), 2600);
    return () => window.clearTimeout(timer);
  }, [playing, next]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <RoundRail
        rounds={scenario.rounds}
        active={shownRound}
        previous={previous}
        next={next}
        playing={playing}
        onGo={(round) => {
          if (round === null) {
            setShownRound(null);
            setPicked(null);
            setSelectedLinkId(null);
            return;
          }
          openRound(round);
        }}
        onTogglePlay={() => setPlaying((running) => !running)}
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
        <div className="ioc-no-scrollbar ioc-debate-stack min-h-0 min-w-0 overflow-y-auto lg:pr-2">
          <DebateDetectorGrid
            scenario={scenario}
            litRound={shownRound}
            picked={
              picked?.seat && picked.round != null
                ? { seat: picked.seat, round: picked.round }
                : null
            }
            onSelectRound={openRound}
          />
          {/* The letters in the grid stand for whole answers, which are
              easy to lose track of ten rounds in: here they are in full. */}
          {task ? (
            <DebateAnswersBlock task={task} scenario={scenario} defaultOpen />
          ) : null}
        </div>
        {/* The recording end to end, each round under a heading that stays
            put while its turns scroll past. */}
        <aside className="ioc-debate-trace flex min-h-[22rem] min-w-0 flex-col">
          <div className="ioc-no-scrollbar min-h-0 flex-1 overflow-y-auto">
            <div ref={traceRef}>
              <p className="ioc-kicker pb-2">Trace</p>
              {scenario.rounds.map((entry) => (
                <DebateTraceRound
                  key={entry.round}
                  round={entry.round}
                  turns={entry.turns.length}
                  open={shownRound === entry.round}
                  active={picked?.round === entry.round}
                  onToggle={() =>
                    setShownRound((open) =>
                      open === entry.round ? null : entry.round,
                    )
                  }
                >
                  <DebateTurnList
                    round={entry.round}
                    turns={entry.turns}
                    seats={scenario.seats}
                    selectedLinkId={selectedLinkId}
                    focusSeat={
                      picked?.round === entry.round
                        ? (picked.seat ?? null)
                        : null
                    }
                    focusNonce={focusNonce}
                    onSelectLink={setSelectedLinkId}
                  />
                </DebateTraceRound>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

/**
 * The run a round at a time: pick a round, and the graph draws the turns
 * Agent-ToM read as having moved somebody in it, with the recording of that
 * round open beside it. Picking an arrow lights the response it points at.
 */
function RoundsSlide({
  scenario,
  task,
}: {
  scenario: DebateScenario;
  task?: DebateTask | null;
}) {
  const rounds = scenario.rounds;
  // Null is the whole run: the arrows of every round at once, with every
  // agent's evidence beside them.
  const [active, setActive] = useState<number | null>(null);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [showLinkTip, setShowLinkTip] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [tipSeat, setTipSeat] = useState<string | null>(null);
  const [focusSeat, setFocusSeat] = useState<string | null>(null);
  const [focusNonce, setFocusNonce] = useState(0);
  const [playing, setPlaying] = useState(false);
  // Which round of the recording is unfolded: the one the selector is on to
  // begin with, and whatever is opened by hand after that.
  const [openTrace, setOpenTrace] = useState<number | null>(null);
  // The agents' evidence below the graph: folded to begin with, and opened
  // on whichever round was asked for from the grid or the graph.
  const [openSeat, setOpenSeat] = useState<string | null>(null);
  const [dossierPick, setDossierPick] = useState<DossierPick | null>(null);
  const traceRef = useRef<HTMLDivElement | null>(null);
  const round = rounds.find((entry) => entry.round === active) ?? null;
  // On the overview the arrows of the whole run are drawn at once, which
  // aggregateEdges folds back into one arrow per pair.
  const edges = useMemo(
    () =>
      aggregateEdges(
        active === null
          ? rounds.flatMap((entry) => entry.links)
          : (round?.links ?? []),
      ),
    [active, round, rounds],
  );
  const at = rounds.findIndex((entry) => entry.round === active);
  const previous =
    active === null ? null : at > 0 ? rounds[at - 1].round : null;
  const next =
    active === null
      ? (rounds[0]?.round ?? null)
      : at >= 0 && at + 1 < rounds.length
        ? rounds[at + 1].round
        : null;

  function closeTips() {
    setShowLegend(false);
    setSelectedLinkId(null);
    setShowLinkTip(false);
    setTipSeat(null);
  }

  // The recording follows the selector: the round on screen is the round the
  // graph is drawn from.
  function goTo(round: number | null) {
    setActive(round);
    setFocusSeat(null);
    setOpenTrace(round);
    closeTips();
    if (round === null) {
      return;
    }
    window.setTimeout(() => {
      traceRef.current
        ?.querySelector(`[data-round="${round}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  }

  // Playback walks the rounds one timeout at a time rather than on an
  // interval, so changing round by hand mid-run cannot leave two timers in
  // flight. It stops itself on the last round.
  useEffect(() => {
    if (!playing) {
      return;
    }
    if (next === null) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => goTo(next), 2600);
    return () => window.clearTimeout(timer);
  }, [playing, next]);

  // An arrow is a turn that moved somebody: light it here and point the
  // recording at the response it moved.
  function openLink(linkId: string | null) {
    if (!linkId) {
      closeTips();
      return;
    }
    const link = round?.links.find((entry) => entry.id === linkId) ?? null;
    closeTips();
    setSelectedLinkId(linkId);
    setShowLinkTip(true);
    if (link) {
      setFocusSeat(link.to);
      setFocusNonce((count) => count + 1);
      setOpenTrace(active);
    }
  }

  // A round named in an agent's evidence: move the slide onto that round
  // and point the recording at that agent's response in it.
  function openEvidenceRound(round: number, seat?: string) {
    closeTips();
    setActive(round);
    setOpenTrace(round);
    setFocusSeat(seat ?? null);
    setFocusNonce((count) => count + 1);
    if (seat) {
      setOpenSeat(seat);
      setDossierPick((current) => ({
        seat,
        round,
        nonce: (current?.nonce ?? 0) + 1,
      }));
    }
    window.setTimeout(() => {
      traceRef.current
        ?.querySelector(`[data-round="${round}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  }

  function toggleAgent(seat: string) {
    const close = tipSeat === seat;
    closeTips();
    if (close) {
      return;
    }
    setTipSeat(seat);
    setFocusSeat(seat);
    setFocusNonce((count) => count + 1);
    setOpenTrace(active);
  }

  const seatTip =
    tipSeat && task ? (
      <DebateSeatTip
        task={task}
        scenario={scenario}
        seatId={tipSeat}
        round={round}
        onClose={() => setTipSeat(null)}
      />
    ) : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <RoundRail
        rounds={rounds}
        active={active}
        previous={previous}
        next={next}
        playing={playing}
        onGo={goTo}
        onTogglePlay={() => setPlaying((running) => !running)}
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
        <div className="ioc-no-scrollbar ioc-debate-stack min-h-0 min-w-0 overflow-y-auto lg:pr-2">
          <div>
            <div className="flex items-center justify-between gap-3">
              <p className="ioc-kicker">Agent graph</p>
              {edges.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    const open = !showLegend;
                    closeTips();
                    setShowLegend(open);
                  }}
                  aria-expanded={showLegend}
                  className="ioc-link text-[11px]"
                >
                  Legend
                </button>
              ) : null}
            </div>
            {/* The ring is laid out from the width it is given, so it is
                held to a square rather than stretched across the column. */}
            <div className="mx-auto w-full max-w-[21rem]">
              <DebateInfluenceGraph
                seats={scenario.seats}
                turns={round?.turns ?? []}
                edges={edges}
                selectedLinkId={selectedLinkId}
                linkTipOpen={showLinkTip}
                onSelectLink={openLink}
                activeSeat={tipSeat}
                seatTip={seatTip}
                legendOpen={showLegend}
                onCloseLegend={() => setShowLegend(false)}
                onSelectSeat={toggleAgent}
              />
            </div>
            <p className="ioc-faint mt-3 text-[12px] font-light leading-[1.5]">
              {edges.length === 0
                ? "Agent-ToM drew no arrow into this round."
                : active === null
                  ? "Every arrow Agent-ToM drew across the run, with each agent's first and last answer on its orb. Pick a round above to take it one round at a time."
                  : "An arrow is a turn Agent-ToM read as having moved the agent it points to. Pick one to read it out and hear it on the recording."}
            </p>
          </div>

          {/* What the detector has on each agent, round by round, read
              beside the arrows those rounds are drawn from. */}
          <div>
            <p className="ioc-kicker">All agents evidence</p>
            <div className="mt-2">
              <DebateReadingEvidence
                scenario={scenario}
                round={null}
                onlyRound={active}
                openSeatId={openSeat}
                pick={dossierPick}
                onToggleSeat={(seatId) =>
                  setOpenSeat((current) => (current === seatId ? null : seatId))
                }
                onSelectRound={openEvidenceRound}
                onShowRound={openEvidenceRound}
              />
            </div>
          </div>
        </div>

        {/* The same recording as the debate slide, opened on the round the
            selector is on. */}
        <aside className="ioc-debate-trace flex min-h-[22rem] min-w-0 flex-col">
          <div className="ioc-no-scrollbar min-h-0 flex-1 overflow-y-auto">
            <div ref={traceRef}>
              <p className="ioc-kicker pb-2">Trace</p>
              {rounds.map((entry) => (
                <DebateTraceRound
                  key={entry.round}
                  round={entry.round}
                  turns={entry.turns.length}
                  open={openTrace === entry.round}
                  active={entry.round === active}
                  onToggle={() =>
                    setOpenTrace((open) =>
                      open === entry.round ? null : entry.round,
                    )
                  }
                >
                  <DebateTurnList
                    round={entry.round}
                    turns={entry.turns}
                    seats={scenario.seats}
                    selectedLinkId={selectedLinkId}
                    focusSeat={entry.round === active ? focusSeat : null}
                    focusNonce={focusNonce}
                    onSelectLink={setSelectedLinkId}
                  />
                </DebateTraceRound>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export function InvestigationResultSlideshow(
  props: InvestigationResultSlideshowProps,
) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);
  const slides: { label: string; body: React.ReactNode }[] = [
    { label: "Verdict", body: <VerdictSlide {...props} /> },
    ...(props.scenario
      ? [
          {
            label: "Rounds",
            body: <RoundsSlide scenario={props.scenario} task={props.task} />,
          },
          {
            label: "Debate",
            body: <DebateSlide scenario={props.scenario} task={props.task} />,
          },
        ]
      : []),
  ];

  // Opened from somewhere that already knows what the reader came for, the
  // deck starts on that slide rather than on the verdict.
  const startLabel = props.startSlide?.label ?? null;
  const startNonce = props.startSlide?.nonce ?? 0;
  useEffect(() => {
    const track = trackRef.current;
    if (!track || !startLabel) return;
    const index = slides.findIndex((slide) => slide.label === startLabel);
    if (index < 0) return;
    // A frame for the modal to be laid out, so the track has a width to
    // scroll by.
    const timer = window.setTimeout(() => {
      track.scrollTo({ left: index * track.clientWidth, behavior: "auto" });
      setActive(index);
    }, 40);
    return () => window.clearTimeout(timer);
  }, [startLabel, startNonce]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const width = track.clientWidth || 1;
        setActive(Math.round(track.scrollLeft / width));
      });
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      track.removeEventListener("scroll", onScroll);
    };
  }, []);

  function goTo(index: number) {
    const track = trackRef.current;
    if (!track) return;
    const next = Math.max(0, Math.min(slides.length - 1, index));
    track.scrollTo({
      left: next * track.clientWidth,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      goTo(active + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      goTo(active - 1);
    }
  }

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Investigation result"
      className="ioc-explainer-deck flex h-full min-h-0 flex-col overflow-hidden"
    >
      <div className="relative flex min-h-0 flex-1 px-12 md:px-14">
        <button
          type="button"
          onClick={() => goTo(active - 1)}
          disabled={active === 0}
          aria-label="Previous slide"
          className="ioc-explainer-nav absolute left-3 top-1/2 z-10 -translate-y-1/2 md:left-4"
        >
          <LuChevronLeft size={22} />
        </button>
        <button
          type="button"
          onClick={() => goTo(active + 1)}
          disabled={active === slides.length - 1}
          aria-label="Next slide"
          className="ioc-explainer-nav absolute right-3 top-1/2 z-10 -translate-y-1/2 md:right-4"
        >
          <LuChevronRight size={22} />
        </button>

        <div
          ref={trackRef}
          tabIndex={0}
          onKeyDown={onKeyDown}
          className="ioc-no-scrollbar flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto outline-none"
        >
          {slides.map((slide, index) => (
            <div
              key={slide.label}
              className={`ioc-no-scrollbar ioc-explainer-slide flex h-full min-h-0 w-full shrink-0 snap-center flex-col overflow-y-auto py-8 md:py-10 ${active === index ? "is-active" : ""}`}
            >
              {slide.body}
            </div>
          ))}
        </div>
      </div>

      <div className="ioc-hairline flex shrink-0 items-center justify-center border-t px-4 py-3">
        <div className="flex items-center gap-2" role="tablist">
          {slides.map((slide, index) => {
            const current = index === active;
            return (
              <button
                key={slide.label}
                type="button"
                role="tab"
                aria-selected={current}
                aria-current={current ? "true" : undefined}
                aria-label={slide.label}
                onClick={() => goTo(index)}
                className={`h-2 rounded-full transition-all ${
                  current
                    ? "w-6 bg-[color:var(--ioc-kicker)]"
                    : "w-2 bg-[color:var(--ioc-glass-border)] hover:bg-[color:var(--ioc-muted)]"
                }`}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}
