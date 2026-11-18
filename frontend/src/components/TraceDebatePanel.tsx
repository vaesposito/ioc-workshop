import { useEffect, useMemo, useState } from "react";
import { LuArrowLeft, LuArrowRight, LuPause, LuPlay } from "react-icons/lu";
import { DebateDetectorGrid } from "./DebateDetectorGrid";
import {
  DebateAnswersBlock,
  DebateQuestionBlock,
  DebateRoundExplanation,
  DebateSummary,
  DetectorVerdict,
} from "./DebateExplanation";
import { DebateInfluenceGraph } from "./DebateInfluenceGraph";
import { DebateSeatTip } from "./DebateSeatTip";
import { AdversaryNote, DebateTurnList, DetectorNote } from "./DebateTurnList";
import {
  DebateRoundVotes,
  DebateVoteTimeline,
  type VotePick,
} from "./DebateVoteTimeline";
import { aggregateEdges, answerSpans } from "../utils/madDebates";
import type { DebateScenario, DebateTask } from "../utils/madDebates";

/**
 * The debate in three columns: the graph on the left, the round's responses
 * or the vote timeline in the middle, and the task and the round's reading on
 * the right. This is the arrangement the trace page carried before the report
 * took the debate over, kept as a second way of reading the same run.
 */
export function TraceDebatePanel({
  task,
  scenario,
}: {
  task: DebateTask;
  scenario: DebateScenario;
}) {
  const rounds = scenario.rounds;
  // null is the "All" selection. Rounds are 1-based.
  const [activeRound, setActiveRound] = useState<number | null>(null);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  // The response the column is pointed at, and the agent the tooltip reads
  // out. A tooltip carries the round it was opened from, which is the round
  // on screen for the graph and the picked column for the vote timeline.
  const [focusSeat, setFocusSeat] = useState<string | null>(null);
  const [tip, setTip] = useState<{ seat: string; round: number | null } | null>(
    null,
  );
  const [showLegend, setShowLegend] = useState(false);
  // An arrow picked in the graph reads out in a tooltip there; one picked from
  // the explanation beside it only highlights, since the reading is already on
  // screen next to the click.
  const [showLinkTip, setShowLinkTip] = useState(false);
  const selectedRound =
    activeRound === null
      ? null
      : (rounds.find((entry) => entry.round === activeRound) ?? null);

  // A different trace is a different debate, so the selection starts over.
  useEffect(() => {
    setActiveRound(null);
    setSelectedLinkId(null);
    setPlaying(false);
    setFocusSeat(null);
    setTip(null);
  }, [scenario.traceId]);

  const activeIndex =
    activeRound === null
      ? -1
      : rounds.findIndex((entry) => entry.round === activeRound);
  const previousRound = activeIndex > 0 ? rounds[activeIndex - 1].round : null;
  const nextRound =
    activeIndex + 1 < rounds.length ? rounds[activeIndex + 1].round : null;

  // The graph carries one tooltip at a time: the legend, an arrow or an agent.
  // Opening any of them puts the others away.
  function closeTips() {
    setShowLegend(false);
    setSelectedLinkId(null);
    setShowLinkTip(false);
    setTip(null);
  }

  function goToRound(round: number | null) {
    setActiveRound(round);
    setFocusSeat(null);
    setPlaying(false);
    closeTips();
  }

  // A cell in the grid is an agent in a round: it opens the round and points
  // the trace at that agent, the way clicking its answer in the timeline does.
  function openRound(round: number, seat?: string) {
    goToRound(round);
    if (seat) {
      setFocusSeat(seat);
    }
  }

  function openLink(linkId: string | null) {
    if (!linkId) {
      setSelectedLinkId(null);
      setShowLinkTip(false);
      return;
    }
    closeTips();
    setSelectedLinkId(linkId);
    setShowLinkTip(true);
  }

  function selectLink(linkId: string | null) {
    closeTips();
    setSelectedLinkId(linkId);
  }

  // The vote row in the explanation column points the trace at a response
  // without putting a card over the graph; the reading it would carry is
  // already open beside the click.
  function focusAnswer(round: number, seat: string) {
    const close = tip === null && focusSeat === seat;
    closeTips();
    setFocusSeat(close || activeRound !== round ? null : seat);
  }

  function toggleLegend() {
    const open = !showLegend;
    closeTips();
    setShowLegend(open);
  }

  // A vote reads out in a tooltip on its agent's orb. The timeline spans every
  // round, so picking a cell must not pull the rest of the page onto another
  // one; the trace follows along only when the round clicked is already open.
  function openAnswer(round: number, seat: string) {
    closeTips();
    setTip({ seat, round });
    if (activeRound === round) {
      setFocusSeat(seat);
    }
  }

  // An orb reads out what its agent answered in the round on screen, and
  // points the trace at the response behind it.
  function toggleAgent(seat: string) {
    const close = tip?.seat === seat;
    closeTips();
    setFocusSeat(null);
    if (close) {
      return;
    }
    setTip({ seat, round: activeRound });
    if (activeRound !== null) {
      setFocusSeat(seat);
    }
  }

  // Playback walks the rounds one timeout at a time rather than on an interval,
  // so changing round by hand during a run cannot leave two timers in flight.
  useEffect(() => {
    if (!playing) {
      return;
    }
    if (nextRound === null) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(
      () => {
        setActiveRound(nextRound);
        setSelectedLinkId(null);
      },
      activeRound === null ? 400 : 2200,
    );
    return () => window.clearTimeout(timer);
  }, [playing, activeRound, nextRound]);

  const graphEdges = useMemo(
    () => aggregateEdges(selectedRound?.links ?? []),
    [selectedRound],
  );
  const spans = useMemo(() => answerSpans(scenario), [scenario]);
  const tipRound =
    tip?.round == null
      ? null
      : (rounds.find((entry) => entry.round === tip.round) ?? null);
  // The agent the page is pointed at, whether that came from an orb or from a
  // cell in the vote timeline: the orb lights up and the matching answers take
  // a ring, so the two columns read as one selection.
  const picked: VotePick | null =
    tip ?? (focusSeat ? { seat: focusSeat, round: activeRound } : null);
  const seatTip = tip ? (
    <DebateSeatTip
      task={task}
      scenario={scenario}
      seatId={tip.seat}
      round={tipRound}
      onClose={() => {
        setTip(null);
        setFocusSeat(null);
      }}
    />
  ) : null;
  const adversaryNames = scenario.seats
    .filter((seat) => seat.adversary)
    .map((seat) => seat.name);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="ioc-hairline flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-3">
        <p className="ioc-kicker mr-1">{rounds.length} rounds</p>
        <button
          type="button"
          onClick={() => goToRound(null)}
          aria-pressed={activeRound === null}
          className={`ioc-round-chip${activeRound === null ? " is-active" : ""}`}
        >
          Overview
        </button>
        {rounds.map((round) => (
          <button
            key={round.round}
            type="button"
            onClick={() => goToRound(round.round)}
            aria-pressed={activeRound === round.round}
            className={`ioc-round-chip${
              activeRound === round.round ? " is-active" : ""
            }`}
          >
            {round.round}
          </button>
        ))}
        {activeRound === null ? (
          <p className="ioc-faint ml-1 hidden text-[12px] font-light xl:block">
            Pick a round to see which answers changed in it.
          </p>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => goToRound(previousRound)}
            disabled={previousRound === null}
            title="Previous round"
            aria-label="Previous round"
            className="ioc-round-chip is-step is-icon"
          >
            <LuArrowLeft size={13} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setPlaying((running) => !running)}
            aria-pressed={playing}
            className={`ioc-round-chip is-step${playing ? " is-active" : ""}`}
          >
            {playing ? (
              <LuPause size={13} aria-hidden="true" />
            ) : (
              <LuPlay size={13} aria-hidden="true" />
            )}
            {playing ? "Pause" : "Play"}
          </button>
          <button
            type="button"
            onClick={() => goToRound(nextRound)}
            disabled={nextRound === null}
            title="Next round"
            aria-label="Next round"
            className="ioc-round-chip is-step is-icon"
          >
            <LuArrowRight size={13} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-12 lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden">
        <section className="ioc-hairline ioc-scroll flex min-w-0 flex-col border-b p-4 lg:col-span-3 lg:min-h-0 lg:overflow-y-auto lg:overflow-x-hidden lg:border-b-0 lg:border-r">
          <div className="flex shrink-0 items-center justify-between gap-3">
            <p className="ioc-kicker">Graph</p>
            {graphEdges.length > 0 ? (
              <button
                type="button"
                onClick={toggleLegend}
                aria-expanded={showLegend}
                className="ioc-link text-[11px]"
              >
                Legend
              </button>
            ) : null}
          </div>
          <DebateInfluenceGraph
            seats={scenario.seats}
            turns={selectedRound?.turns ?? []}
            spans={selectedRound ? undefined : spans}
            edges={selectedRound ? graphEdges : []}
            selectedLinkId={selectedLinkId}
            linkTipOpen={showLinkTip}
            onSelectLink={openLink}
            activeSeat={picked?.seat ?? null}
            seatTip={seatTip}
            legendOpen={showLegend}
            onCloseLegend={() => setShowLegend(false)}
            onSelectSeat={toggleAgent}
          />
          {selectedRound ? (
            <p className="ioc-faint mt-3 text-[12px] font-light">
              {graphEdges.length > 0
                ? scenario.detector
                  ? "An arrow is a turn Agent-ToM read as having moved the agent it points to."
                  : "An arrow links an answer change to an observed turn that already carried that answer."
                : selectedRound.events.length > 0
                  ? "Answers changed in this round, but none changed to one an observed turn already carried."
                  : "No agent changed answer in this round."}
            </p>
          ) : null}
          <AdversaryNote names={adversaryNames} />
          <DetectorNote seats={scenario.seats} />
        </section>

        <section className="ioc-hairline ioc-scroll flex min-w-0 flex-col border-b p-4 lg:col-span-5 lg:min-h-0 lg:overflow-y-auto lg:overflow-x-hidden lg:border-b-0 lg:border-r">
          <div className="flex shrink-0 items-center justify-between gap-3">
            <p className="ioc-kicker">{selectedRound ? "Trace" : "Overview"}</p>
          </div>
          {selectedRound ? (
            <DebateTurnList
              round={selectedRound.round}
              turns={selectedRound.turns}
              seats={scenario.seats}
              selectedLinkId={selectedLinkId}
              focusSeat={focusSeat}
              onSelectLink={selectLink}
            />
          ) : (
            <div className="mt-3">
              <DebateVoteTimeline
                task={task}
                scenario={scenario}
                activeRound={activeRound}
                picked={picked}
                onSelectRound={goToRound}
                onSelectVote={openAnswer}
              />
              <div className="space-y-5">
                <DetectorVerdict scenario={scenario} />
                <DebateDetectorGrid
                  scenario={scenario}
                  onSelectRound={openRound}
                />
              </div>
              <DebateSummary scenario={scenario} />
            </div>
          )}
        </section>

        <section className="ioc-scroll flex min-w-0 flex-col p-4 lg:col-span-4 lg:min-h-0 lg:overflow-y-auto lg:overflow-x-hidden">
          {/* Remounted when a round opens or closes so the task folds itself
              away for a round and comes back for the overview, while still
              answering the toggle in between. */}
          <div className="ioc-debate-stack">
            <DebateQuestionBlock
              key={selectedRound ? "round-question" : "all-question"}
              task={task}
              scenario={scenario}
              defaultOpen={!selectedRound}
            />
            <DebateAnswersBlock
              key={selectedRound ? "round-answers" : "all-answers"}
              task={task}
              scenario={scenario}
              defaultOpen={!selectedRound}
            />
            {/* Round 1 is everyone's opening answer, which the trace already
                reads out; the row earns its place from round 2, where the
                votes start moving. */}
            {selectedRound && selectedRound.round > 1 ? (
              <DebateRoundVotes
                round={selectedRound}
                seats={scenario.seats}
                picked={picked}
                onSelectVote={focusAnswer}
              />
            ) : null}
            {selectedRound ? (
              <DebateRoundExplanation
                round={selectedRound}
                scenario={scenario}
                selectedLinkId={selectedLinkId}
                onSelectLink={selectLink}
              />
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
