import { useEffect, useMemo, useRef, useState } from "react";
import { LuArrowRight } from "react-icons/lu";
import { DebateSummary } from "./DebateExplanation";
import { DebateInfluenceGraph } from "./DebateInfluenceGraph";
import {
  DebateReadingEvidence,
  agentAnchorId,
  type DossierPick,
} from "./DebateReadingEvidence";
import { DebateScoreChart } from "./DebateScoreChart";
import { DebateSeatTip } from "./DebateSeatTip";
import { DebateSection } from "./DebateSection";
import { DebateTraceRound } from "./DebateTraceRound";
import { AdversaryNote, DebateTurnList } from "./DebateTurnList";
import { aggregateEdges, answerSpans } from "../utils/madDebates";
import type { DebateScenario, DebateTask } from "../utils/madDebates";

/**
 * The debate behind an investigation, as the report reads it: what the
 * detector concluded on the left, and the recording that led there on the
 * right. The left column is the call, the graph of who moved whom and the
 * case against each agent; the right one is every round end to end, each
 * under a heading that holds while its turns scroll past. Following a round
 * out of an agent's account moves the recording to it, so a claim and the
 * turn behind it are always in view together.
 */
export function InvestigationDebateView({
  task,
  scenario,
  citeTone = "danger",
  onExplain,
}: {
  task: DebateTask;
  scenario: DebateScenario;
  /** The verdict's colour, which the findings take their card from. */
  citeTone?: "danger" | "success" | "warning";
  /** Opens the explainer, which carries the rounds this column leaves out. */
  onExplain?: () => void;
}) {
  const rounds = scenario.rounds;
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [tip, setTip] = useState<{ seat: string; round: number | null } | null>(
    null,
  );
  const [showLegend, setShowLegend] = useState(false);
  const [showLinkTip, setShowLinkTip] = useState(false);
  // The agent list, and which of its entries is unfolded: the call strip
  // opens both when a suspect in it is picked.
  const [agentsOpen, setAgentsOpen] = useState(true);
  // The list opens on the agents it names rather than on one of their
  // dossiers: the reader picks whose case to read.
  const [openSeat, setOpenSeat] = useState<string | null>(null);
  // Where the recording was last pointed: the round to scroll to and the
  // agent in it to open, with a nonce so asking twice still moves it.
  const [focus, setFocus] = useState<{
    round: number | null;
    seat: string | null;
  }>({ round: null, seat: null });
  const [traceNonce, setTraceNonce] = useState(0);
  // The chart gives the recording its room back as soon as the reader is
  // following a particular round.
  const [chartOpen, setChartOpen] = useState(true);
  const [traceOpen, setTraceOpen] = useState(true);
  // The recording opens as a list of rounds, one unfolded at a time: the
  // round the evidence beside it is about.
  const [openRound, setOpenRound] = useState<number | null>(null);
  // The round the agent's own account should be opened on, where the pick
  // came from the chart rather than from the account itself.
  const [dossierPick, setDossierPick] = useState<DossierPick | null>(null);
  const readingColumn = useRef<HTMLDivElement | null>(null);
  const traceColumn = useRef<HTMLDivElement | null>(null);

  // A different report is a different debate, so the selection starts over.
  useEffect(() => {
    setSelectedLinkId(null);
    setTip(null);
    setAgentsOpen(true);
    setOpenSeat(null);
    setFocus({ round: null, seat: null });
  }, [scenario.traceId]);

  // The graph carries one tooltip at a time: the legend, an arrow or an agent.
  function closeTips() {
    setShowLegend(false);
    setSelectedLinkId(null);
    setShowLinkTip(false);
    setTip(null);
  }

  function scrollColumnUp() {
    readingColumn.current?.scrollTo({ top: 0, behavior: "smooth" });
  }

  // A round in an agent's account: bring that round of the recording up and
  // open the agent's response in it. The recording is scrolled by hand rather
  // than with scrollIntoView, so the round always lands at the top of its own
  // column and nothing else on the page moves.
  function focusRound(round: number, seatId?: string) {
    setFocus({ round, seat: seatId ?? null });
    setTraceNonce((count) => count + 1);
    setTraceOpen(true);
    setOpenRound(round);
    // With an agent to point at, the recording opens that response and
    // scrolls to it itself — the round's heading stays pinned above it —
    // so only a round picked on its own is scrolled to by hand here.
    if (seatId) {
      return;
    }
    window.setTimeout(() => {
      const column = traceColumn.current;
      const heading = column?.querySelector<HTMLElement>(
        `[data-round="${round}"]`,
      );
      if (!column || !heading) return;
      const top =
        column.scrollTop +
        heading.getBoundingClientRect().top -
        column.getBoundingClientRect().top;
      column.scrollTo({ top, behavior: "smooth" });
    }, 80);
  }

  // Picked from an agent's account, which is read in the other column: the
  // chart gives the recording its room back.
  function showRound(round: number, seatId?: string) {
    setChartOpen(false);
    focusRound(round, seatId);
  }

  // An agent picked in the chart's key: open its dossier in the reading
  // column, where the case against it is written out.
  function showSeat(seatId: string) {
    if (
      !scenario.seats.some(
        (seat) => seat.detector?.label === "manipulator" && seat.id === seatId,
      )
    ) {
      return;
    }
    setAgentsOpen(true);
    setOpenSeat(seatId);
    window.setTimeout(() => {
      readingColumn.current
        ?.querySelector(`#${CSS.escape(agentAnchorId(seatId))}`)
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 80);
  }

  // A point on the chart is an agent in a round: open its evidence in the
  // reading column and that round of the recording beside it. The chart
  // stays open — the pick was made on it, and the line it was made on is
  // part of reading the round.
  function showPoint(round: number, seatId: string) {
    showSeat(seatId);
    setDossierPick((current) => ({
      seat: seatId,
      round,
      nonce: (current?.nonce ?? 0) + 1,
    }));
    focusRound(round, seatId);
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

  function toggleAgent(seat: string) {
    const close = tip?.seat === seat;
    closeTips();
    if (close) {
      return;
    }
    setTip({ seat, round: null });
  }

  // Every arrow the detector drew, merged per pair, so the ring is the whole
  // run rather than an empty circle of agents.
  const graphEdges = useMemo(
    () => aggregateEdges(rounds.flatMap((round) => round.links)),
    [rounds],
  );
  const spans = useMemo(() => answerSpans(scenario), [scenario]);
  // What pointed the trace at a response, where an arrow did: red only for a
  // move the detector counts as part of the attack, plain for the rest.
  const focusedLink = selectedLinkId
    ? (rounds
        .flatMap((round) => round.links)
        .find((link) => link.id === selectedLinkId) ?? null)
    : null;
  const focusSuspect = Boolean(
    focusedLink &&
    (focusedLink.attack || focusedLink.category === "tom-suspect"),
  );
  // Only worth a section where somebody read the debate; without a reading
  // the column would carry a heading that opens on an apology.
  const hasReading =
    Boolean(scenario.detector) || scenario.seats.some((seat) => seat.detector);
  const adversaryNames = scenario.seats
    .filter((seat) => seat.adversary)
    .map((seat) => seat.name);

  const seatTip = tip ? (
    <DebateSeatTip
      task={task}
      scenario={scenario}
      seatId={tip.seat}
      round={null}
      onClose={() => setTip(null)}
    />
  ) : null;

  return (
    <section className="ioc-hairline flex min-w-0 flex-col border-b lg:col-span-9 lg:min-h-full lg:border-b-0">
      <div
        className="ioc-cite-panel grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-9 lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden"
        data-cite-tone={citeTone}
      >
        <div
          ref={readingColumn}
          className="ioc-hairline ioc-scroll ioc-debate-stack min-w-0 border-b p-4 lg:col-span-5 lg:min-h-0 lg:overflow-y-auto lg:overflow-x-hidden lg:border-b-0 lg:border-r"
        >
          <DebateSection
            label="Agent graph"
            preview={`${scenario.seats.length} agents`}
          >
            <DebateInfluenceGraph
              seats={scenario.seats}
              turns={[]}
              spans={spans}
              edges={graphEdges}
              plain
              selectedLinkId={selectedLinkId}
              linkTipOpen={showLinkTip}
              onSelectLink={openLink}
              activeSeat={tip?.seat ?? focus.seat ?? null}
              seatTip={seatTip}
              legendOpen={showLegend}
              onCloseLegend={() => setShowLegend(false)}
              onSelectSeat={toggleAgent}
            />
            <AdversaryNote names={adversaryNames} />
          </DebateSection>

          {/* Its own section already, and empty on a run where nothing was
              taken up. */}
          <DebateSummary scenario={scenario} />

          {/* How Agent-ToM read each one, opened on the agent a suspect pill
              in the call strip points at. */}
          {hasReading ? (
            <DebateSection
              label="Clearest evidences"
              open={agentsOpen}
              onOpenChange={setAgentsOpen}
              preview={`${
                scenario.seats.filter(
                  (seat) => seat.detector?.label === "manipulator",
                ).length
              } suspected`}
            >
              <DebateReadingEvidence
                scenario={scenario}
                round={null}
                clearestOnly
                suspectsOnly
                openSeatId={openSeat}
                pick={dossierPick}
                onToggleSeat={(id) =>
                  setOpenSeat((shown) => (shown === id ? null : id))
                }
                onSelectRound={showRound}
                onShowRound={showRound}
                onScrollUp={scrollColumnUp}
              />
              {/* Only the rounds the case rests on are here; the run round by
                  round is read in the explainer. */}
              {onExplain ? (
                <button
                  type="button"
                  onClick={onExplain}
                  className="ioc-link mt-3 inline-flex items-center gap-1.5 text-[12px]"
                >
                  See every round in Explain this to me
                  <LuArrowRight size={13} aria-hidden />
                </button>
              ) : null}
            </DebateSection>
          ) : null}
        </div>

        {/* The recording end to end rather than a round at a time, each round
            under a heading that stays put while its turns scroll past. */}
        <aside className="flex min-w-0 flex-col p-4 lg:col-span-4 lg:min-h-0 lg:overflow-hidden">
          {/* When the detector made up its mind about each agent, read before
              the turns it made it up on. */}
          <div className="ioc-hairline ioc-score-block shrink-0 border-b pb-4">
            <DebateSection
              label="Manipulator score after each round"
              preview={`${scenario.rounds.length} rounds`}
              open={chartOpen}
              onOpenChange={setChartOpen}
            >
              <DebateScoreChart
                scenario={scenario}
                onSelectSeat={showSeat}
                onSelectPoint={showPoint}
              />
            </DebateSection>
          </div>
          <div className="ioc-debate-trace-section flex min-h-0 flex-1 flex-col pt-4">
            <DebateSection
              label="Trace"
              preview={`${rounds.length} rounds`}
              open={traceOpen}
              onOpenChange={setTraceOpen}
            >
              <div
                ref={traceColumn}
                className="ioc-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
              >
                {rounds.map((round) => (
                  <DebateTraceRound
                    key={round.round}
                    round={round.round}
                    turns={round.turns.length}
                    open={openRound === round.round}
                    active={focus.round === round.round}
                    onToggle={() =>
                      setOpenRound((open) =>
                        open === round.round ? null : round.round,
                      )
                    }
                  >
                    <DebateTurnList
                      round={round.round}
                      turns={round.turns}
                      seats={scenario.seats}
                      selectedLinkId={selectedLinkId}
                      focusSeat={
                        focus.round === round.round ? focus.seat : null
                      }
                      focusSuspect={focusSuspect}
                      focusNonce={traceNonce}
                      onSelectLink={selectLink}
                    />
                  </DebateTraceRound>
                ))}
              </div>
            </DebateSection>
          </div>
        </aside>
      </div>
    </section>
  );
}
