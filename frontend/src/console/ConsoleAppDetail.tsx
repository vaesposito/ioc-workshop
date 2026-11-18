import { useEffect, useState } from "react";
import {
  LuCheck,
  LuChevronRight,
  LuColumns3,
  LuRoute,
  LuShieldBan,
  LuScanSearch,
  LuSlidersHorizontal,
} from "react-icons/lu";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { DebateSection } from "../components/DebateSection";
import {
  CostSection,
  FailuresSection,
  HealthSection,
  MetricsSection,
  ProtocolsSection,
  ReasoningSection,
  SecuritySection,
  TopicsSection,
} from "./AppSections";
import {
  COST_LOOSE,
  detailFor,
  risksFor,
  usualCost,
  type AppDetail,
  type SessionRow,
} from "./appDetailData";
import { ConsoleTopology } from "./ConsoleTopology";
import { ConsoleOverview } from "./ConsoleOverview";
import { isPicked, touches, type ConsolePick } from "./pick";
import { ConsoleShell } from "./ConsoleShell";
import { ConsoleDrawer } from "./ConsoleDrawer";
import { ConsoleAlert, type Guidance } from "./ConsoleAlert";
import { ConsoleTraceRow } from "./ConsoleTraceRow";
import { ConsoleJourney } from "./ConsoleJourney";
import { ConsoleProbe, PROBE_BEAT, PROBE_STEPS } from "./ConsoleProbe";
import {
  rememberLook,
  settleMove,
  useConsoleStanding,
} from "./consoleStanding";

/** The readings, each opened in the drawer from the middle column. */
const VIEWS = [
  {
    id: "topics",
    label: "Main topics",
    title: "Main topics",
    blurb:
      "What people actually ask this application, how often each thing comes up, and how often the answers held up.",
  },
  {
    id: "failures",
    label: "Cognitive failures",
    title: "Cognitive failures",
    blurb:
      "Where the reasoning broke down, gathered into clusters and written up session by session.",
  },
  {
    id: "security",
    label: "Security",
    title: "Security",
    blurb:
      "What these agents reached for outside what the application declares, where those calls fell, and which traces have been looked into.",
  },
  {
    id: "cost",
    label: "Cost & quality",
    title: "Cost and quality",
    blurb:
      "What the answers cost to produce, and where the spend sits against what came back.",
  },
  {
    id: "reasoning",
    label: "Reasoning path",
    title: "Reasoning path",
    blurb:
      "How a session is put together, from the request through to the check on the answer, with each step drawn heavier the more traces take it.",
  },
  {
    id: "metrics",
    label: "Cognitive metrics",
    title: "Cognitive metrics",
    blurb:
      "How well the agents coordinate, how cleanly they hand work over, and how far the answers can be stood behind.",
  },
  {
    id: "protocols",
    label: "Cognition protocols",
    title: "Cognition protocols",
    blurb:
      "How the agents share context, compare candidate answers, and divide the work across a session.",
  },
] as const;

type ViewId = (typeof VIEWS)[number]["id"];

/** A line of what is inside, said on the trigger before it is opened. */
function teaseOf(view: ViewId, detail: AppDetail): string {
  switch (view) {
    case "topics": {
      const busiest = detail.topics.reduce((top, topic) =>
        topic.sessions > top.sessions ? topic : top,
      );
      return `${detail.topics.length} topics · busiest ${busiest.label.toLowerCase()}`;
    }
    case "failures":
      return `${detail.failures.length} clusters · ${detail.insights.length} written up`;
    case "security":
      return `${detail.summary.deniedCalls} calls refused · ${detail.summary.maliciousTraces} traces malicious`;
    case "cost":
      return `${detail.cost.efficientSessions} efficient sessions · top cost ${detail.cost.topSession}`;
    case "reasoning":
      return `${detail.reasoning.columns.reduce(
        (count, column) => count + column.nodes.length,
        0,
      )} steps · outcome ${detail.reasoning.outcome.toLowerCase()}`;
    case "metrics":
      return `${detail.metrics.reduce(
        (count, group) => count + group.metrics.length,
        0,
      )} readings in ${detail.metrics.length} groups`;
    case "protocols":
      return `${detail.protocols.map((entry) => entry.code).join(" · ")}`;
    default:
      return "";
  }
}

function Body({
  view,
  detail,
  pick,
  onPick,
  picking,
}: {
  view: ViewId;
  detail: AppDetail;
  pick: ConsolePick | null;
  onPick: (pick: ConsolePick) => void;
  /** Opens the protocols reading on the list to pick from. */
  picking: boolean;
}) {
  const shared = { detail, pick, onPick };
  switch (view) {
    case "topics":
      return <TopicsSection {...shared} />;
    case "failures":
      return <FailuresSection {...shared} />;
    case "security":
      return <SecuritySection {...shared} />;
    case "cost":
      return <CostSection {...shared} />;
    case "reasoning":
      return <ReasoningSection {...shared} />;
    case "metrics":
      return <MetricsSection {...shared} />;
    case "protocols":
      return <ProtocolsSection {...shared} picking={picking} />;
    default:
      return null;
  }
}

/**
 * One application, read across three columns: what it is made of on the
 * left, one reading at a time in the middle, and the sessions it has been
 * through on the right.
 */
export function ConsoleAppDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const detail = id ? detailFor(id) : null;
  // An investigation runs against whichever sessions are picked for it. The
  // ones that are off in some way are put forward, since they are the ones
  // worth the time, but the choice is the reader's.
  // What has been done from these pages since the demo was last reset:
  // the investigations run on this application, and the controls taken off
  // the back of them, both still in force on the way back here.
  const standing = useConsoleStanding();
  const mine = standing.looked.filter((entry) => entry.app === detail?.app.id);
  const forced = standing.taken.filter(
    (entry) => entry.app === detail?.app.id && entry.standing === "held",
  );
  const verdictOf = (run: SessionRow): SessionRow["verdict"] =>
    run.investigated
      ? run.verdict
      : mine.find((entry) => entry.session === run.id)?.verdict;

  const usual = usualCost(detail?.sessions ?? []);
  const open = (detail?.sessions ?? [])
    .filter((run) => !verdictOf(run))
    .map((run) => {
      const over = usual > 0 ? run.costScore / usual - 1 : 0;
      const why = [
        run.status === "error" ? "ended in error" : null,
        run.failures >= 2 ? `${run.failures} cognitive failures` : null,
        over >= COST_LOOSE - 1
          ? `cost ${Math.round(over * 100)}% over the usual`
          : null,
      ].filter((part): part is string => part !== null);
      return {
        run,
        why,
        weight:
          (run.status === "error" ? 3 : 0) +
          run.failures +
          Math.max(over, 0) * 5,
      };
    })
    .sort((left, right) => right.weight - left.weight);
  // What the console would pick: everything with something against it, and
  // failing that the worst of what is left.
  const urged = open.filter((entry) => entry.why.length > 0).slice(0, 3);
  const advised = (urged.length > 0 ? urged : open.slice(0, 1)).map(
    (entry) => entry.run.id,
  );

  // An application is read one of two ways: the three columns, or the work
  // in the order it happens.
  const [mode, setMode] = useState<"columns" | "journey">("columns");
  const [choosing, setChoosing] = useState(false);
  const [chosen, setChosen] = useState<string[]>([]);
  const [probe, setProbe] = useState<"none" | "running">("none");
  const [step, setStep] = useState(0);
  const target = chosen[0] ?? null;

  useEffect(() => {
    if (probe !== "running" || !detail || !target) return;
    const timer = window.setInterval(() => {
      setStep((current) => {
        if (current < PROBE_STEPS.length - 1) return current + 1;
        window.clearInterval(timer);
        setProbe("none");
        // Every session it was run against is investigated from here on,
        // not only the one the console opens next.
        for (const id of chosen) {
          const run = detail.sessions.find((entry) => entry.id === id);
          rememberLook({
            app: detail.app.id,
            session: id,
            verdict: (run?.failures ?? 0) >= 2 ? "malicious" : "clean",
          });
        }
        navigate(`/console/apps/${detail.app.id}/traces/${target}`);
        return current;
      });
    }, PROBE_BEAT);
    return () => window.clearInterval(timer);
  }, [probe, detail, target, chosen, navigate]);
  // Nothing is open until a reading is asked for, and then it comes over
  // the page rather than squeezing into the column.
  // A reading can be asked for in the address, which is how the tour opens
  // one before saying anything about it.
  const [params] = useSearchParams();
  const asked = params.get("view");
  // Coming from the banner, the protocols reading opens on the list to pick
  // from rather than on what is already running.
  const [picking, setPicking] = useState(params.get("picking") === "1");
  const [view, setView] = useState<ViewId | null>(
    VIEWS.some((entry) => entry.id === asked) ? (asked as ViewId) : null,
  );
  const reading = VIEWS.find((entry) => entry.id === view) ?? null;
  // One thing at a time is held across the three columns: picking it again
  // lets it go.
  const [pick, setPick] = useState<ConsolePick | null>(null);
  const choose = (next: ConsolePick) =>
    setPick((current) =>
      current && current.kind === next.kind && current.id === next.id
        ? null
        : next,
    );

  // Nothing is taken off the list: the runs that touched whatever is picked
  // are lit, and the rest step back.
  const lit = new Set(
    (detail?.sessions ?? [])
      .filter((entry) => touches(entry, pick, detail?.insights ?? []))
      .map((entry) => entry.id),
  );

  // What is past what should pass without a look, and the step that answers
  // it: a protocol to tighten where the answers are slipping, an
  // investigation where the application is being pushed at.
  const looked = (detail?.sessions ?? []).filter((run) =>
    Boolean(verdictOf(run)),
  ).length;
  // Runs that ended badly without anybody looking into them: a reason to
  // look, counted beside the calls that were refused.
  const applied = detail?.app.applied;
  const held =
    (applied ? applied.blockedAgents + applied.blockedCalls : 0) +
    forced.length;
  const issues = detail
    ? detail.summary.cognitiveFailures + detail.summary.fatalErrors
    : 0;
  // Which protocols are actually on, as the protocols reading has them:
  // what the application came with, less anything taken off here.
  const live =
    standing.protocols[detail?.app.id ?? ""] ??
    (detail?.protocols ?? []).map((entry) => entry.code);
  // What came back malicious: on record, and from the investigations run
  // here since.
  const bad =
    (detail?.summary.maliciousTraces ?? 0) +
    mine.filter((entry) => entry.verdict === "malicious").length;
  // What the observability scope has against the sessions nobody has
  // looked into yet: errors, cognitive failures, cost over the usual, and
  // weak readings. Risks, not findings.
  const risks = risksFor(detail?.sessions ?? [], (run) =>
    Boolean(verdictOf(run)),
  );
  const alerts: Guidance[] = !detail
    ? []
    : [
        {
          id: "quality",
          hint: "An L9 protocol tightens how the agents coordinate and check each other, which is what lifts performance.",
          label: "Performance issues",
          count: issues,
          grave: issues > 0,
          settled: issues === 0,
          standing:
            live.length > 0
              ? `${live.join(" · ")} configured, ${issues} still standing`
              : "No protocol configured",
          onOpen: () => setView("failures"),
          action: {
            label:
              live.length > 0
                ? "Tighten the L9 protocols"
                : "Configure an L9 protocol",
            icon: <LuSlidersHorizontal size={14} aria-hidden />,
            onAct: () => {
              setPicking(true);
              setView("protocols");
            },
          },
        },
        {
          id: "security",
          // Nothing is a security issue until an investigation says so. What
          // can be said beforehand is that something is worth a look.
          hint:
            bad > 0
              ? "An investigation traced these sessions back to where they started; what it found can be enforced from the session's own page."
              : "Error rates, cognitive failures, cost and quality readings all come from the observability scope. They are risks, not findings; an investigation is what turns one into the other.",
          label: bad > 0 ? "Security issues" : "Potential security risks",
          count: bad > 0 ? bad : risks.length,
          grave: bad > 0,
          settled: false,
          standing:
            probe === "running"
              ? `Investigating ${chosen.length} ${
                  chosen.length === 1 ? "session" : "sessions"
                }`
              : bad > 0
                ? held > 0
                  ? `${bad} malicious, ${held} ${held === 1 ? "control" : "controls"} in place`
                  : `${bad} of ${looked} investigated traces came back malicious`
                : looked > 0
                  ? `${looked} of ${detail.sessions.length} traces investigated, nothing malicious found`
                  : "Nothing investigated yet",
          onOpen: () => setView("security"),
          // A session is investigated once. With every one of them looked
          // into, what is left is to read what came back.
          action: {
            label:
              probe === "running"
                ? "Investigating…"
                : open.length === 0
                  ? "See what was found"
                  : "Start an investigation",
            icon: <LuScanSearch size={14} aria-hidden />,
            onAct: () => {
              if (probe === "running") return;
              if (open.length === 0) {
                setView("security");
                return;
              }
              setChosen(advised);
              setChoosing(true);
            },
          },
        },
      ];

  if (!detail) {
    return (
      <ConsoleShell>
        <p className="ioc-copy text-[13px] font-light">
          No such application.{" "}
          <Link to="/console" className="ioc-link">
            Back to the list
          </Link>
          .
        </p>
      </ConsoleShell>
    );
  }

  return (
    <ConsoleShell>
      <nav className="ioc-console-crumbs">
        <Link to="/console" className="ioc-link">
          Applications
        </Link>
        <LuChevronRight size={12} aria-hidden />
        <span className="ioc-fg">{detail.app.name}</span>
      </nav>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="ioc-title text-[26px] font-light">{detail.app.name}</h1>
        <div className="ioc-console-switch ml-auto" data-tour="app-modes">
          <button
            type="button"
            aria-pressed={mode === "columns"}
            onClick={() => setMode("columns")}
            className={`ioc-console-switch-opt${mode === "columns" ? " is-on" : ""}`}
          >
            <LuColumns3 size={13} aria-hidden />
            Readings
          </button>
          <button
            type="button"
            aria-pressed={mode === "journey"}
            onClick={() => setMode("journey")}
            className={`ioc-console-switch-opt${mode === "journey" ? " is-on" : ""}`}
          >
            <LuRoute size={13} aria-hidden />
            Journey
          </button>
        </div>
      </div>

      <ConsoleAlert items={alerts} />

      <DebateSection label="Scores" defaultOpen={false}>
        <ConsoleOverview
          detail={detail}
          onOpen={(next) => setView(next as ViewId)}
        />
      </DebateSection>

      {mode === "journey" ? (
        <div className="mt-5">
          {/* An investigation started from a step is watched here, since
              the column that usually carries it is not on the page. */}
          {probe === "running" && target ? (
            <div className="mb-5 max-w-[640px]">
              <p className="ioc-kicker">Investigation</p>
              <ConsoleProbe
                step={step}
                said={
                  chosen.length === 1
                    ? `Running against ${target}.`
                    : `Running against ${chosen.length} sessions, starting with ${target}.`
                }
              />
            </div>
          ) : null}
          <ConsoleJourney
            detail={detail}
            risks={risks}
            live={live}
            forced={forced}
            looked={looked}
            bad={bad}
            canInvestigate={open.length > 0 && probe !== "running"}
            onOverview={() => setMode("columns")}
            onView={(next) => setView(next as ViewId)}
            onProtocols={() => {
              setPicking(true);
              setView("protocols");
            }}
            onInvestigate={() => {
              if (probe === "running") return;
              if (open.length === 0) {
                setView("security");
                return;
              }
              setChosen(advised);
              setChoosing(true);
            }}
          />
        </div>
      ) : (
        <div className="ioc-console-detail">
          {/* ── What the application is made of ───────────────────────────── */}
          <aside className="ioc-console-col ioc-no-scrollbar">
            <p className="ioc-copy text-[12.5px] font-light leading-[1.55]">
              {detail.headline}
            </p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {detail.tags.map((tag) => (
                <li key={tag}>
                  <button
                    type="button"
                    aria-pressed={isPicked(pick, "topic", tag)}
                    onClick={() =>
                      choose({ kind: "topic", id: tag, label: tag })
                    }
                    className={`ioc-console-tag is-link${
                      isPicked(pick, "topic", tag) ? " is-picked" : ""
                    }`}
                  >
                    {tag}
                  </button>
                </li>
              ))}
            </ul>

            <div className="mt-4">
              <DebateSection label="MAS topology">
                <ConsoleTopology
                  nodes={detail.topology}
                  edges={detail.topologyEdges}
                  pick={pick}
                  onPick={choose}
                />
              </DebateSection>
              <DebateSection label="Agents" preview={`${detail.agents.length}`}>
                <ul className="flex flex-col gap-1.5">
                  {detail.agents.map((agent) => (
                    <li key={agent.name}>
                      <button
                        type="button"
                        aria-pressed={isPicked(pick, "agent", agent.name)}
                        onClick={() =>
                          choose({
                            kind: "agent",
                            id: agent.name,
                            label: agent.name,
                          })
                        }
                        className={`ioc-console-row is-link${
                          isPicked(pick, "agent", agent.name)
                            ? " is-picked"
                            : ""
                        }`}
                      >
                        <span className="ioc-fg">{agent.name}</span>
                        <span className="ioc-faint">{agent.role}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </DebateSection>
              <DebateSection
                label="Models"
                preview={`${detail.llms.length}`}
                defaultOpen={false}
              >
                <ul className="flex flex-col gap-1.5">
                  {detail.llms.map((llm) => (
                    <li key={llm.name}>
                      <button
                        type="button"
                        aria-pressed={isPicked(pick, "agent", llm.name)}
                        onClick={() =>
                          choose({
                            kind: "agent",
                            id: llm.name,
                            label: llm.name,
                          })
                        }
                        className={`ioc-console-row is-link${
                          isPicked(pick, "agent", llm.name) ? " is-picked" : ""
                        }`}
                      >
                        <span className="ioc-fg">{llm.name}</span>
                        <span className="ioc-faint">{llm.role}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </DebateSection>
              <DebateSection
                label="Tools"
                preview={`${detail.tools.length}`}
                defaultOpen={false}
              >
                <ul className="flex flex-wrap gap-1.5">
                  {detail.tools.map((tool) => (
                    <li key={tool}>
                      <button
                        type="button"
                        aria-pressed={isPicked(pick, "tool", tool)}
                        onClick={() =>
                          choose({ kind: "tool", id: tool, label: tool })
                        }
                        className={`ioc-console-tag is-link${
                          isPicked(pick, "tool", tool) ? " is-picked" : ""
                        }`}
                      >
                        {tool}
                      </button>
                    </li>
                  ))}
                </ul>
              </DebateSection>
            </div>
          </aside>

          {/* ── The health score, and a way into each other reading ──────── */}
          <section className="ioc-console-middle">
            <div className="ioc-console-col ioc-no-scrollbar flex-1">
              {probe === "running" && target ? (
                <div className="mb-6">
                  <p className="ioc-kicker">Investigation</p>
                  <ConsoleProbe
                    step={step}
                    said={
                      chosen.length === 1
                        ? `Running against ${target}.`
                        : `Running against ${chosen.length} sessions, starting with ${target}.`
                    }
                  />
                </div>
              ) : null}

              <h2 className="ioc-fg text-[15px] font-light">Health score</h2>
              <p className="ioc-console-note">
                How the application is holding up overall, and the counts the
                score is read against.
              </p>
              <div className="mt-4">
                <HealthSection detail={detail} pick={pick} onPick={choose} />
              </div>

              {/* What an investigation left behind, which outlives the page
                it was decided on. */}
              {forced.length > 0 ? (
                <div className="mt-7">
                  <p className="ioc-kicker">Enforcement in place</p>
                  <p className="ioc-faint text-[11px] font-light">
                    Taken off the back of an investigation, and in force until
                    the reset in the top bar drops them.
                  </p>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {forced.map((entry) => (
                      <li
                        key={`${entry.session}-${entry.move}`}
                        className="ioc-console-force"
                      >
                        <LuShieldBan
                          size={13}
                          aria-hidden
                          className="shrink-0 text-[#f05252]"
                        />
                        <span className="ioc-fg min-w-0 flex-1 text-[12px]">
                          {entry.label}
                        </span>
                        <Link
                          to={`/console/apps/${detail.app.id}/traces/${entry.session}`}
                          className="ioc-link shrink-0 text-[11px]"
                        >
                          {entry.session}
                        </Link>
                        <button
                          type="button"
                          onClick={() =>
                            settleMove({ ...entry, standing: "open" })
                          }
                          className="ioc-link shrink-0 text-[11px]"
                        >
                          Lift
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <p className="ioc-kicker mt-7">Observability</p>
              <ul
                className="ioc-console-triggers"
                data-tour="app-observability"
              >
                {VIEWS.map((entry) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() => setView(entry.id)}
                      className="ioc-console-trigger"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="ioc-fg block text-[12.5px]">
                          {entry.title}
                        </span>
                        <span className="ioc-faint mt-0.5 block text-[11px] leading-[1.45] font-light">
                          {teaseOf(entry.id, detail)}
                        </span>
                      </span>
                      {entry.id === "failures" &&
                      detail.summary.cognitiveFailures > 0 ? (
                        <span className="ioc-console-chip is-bad shrink-0">
                          {detail.summary.cognitiveFailures} found
                        </span>
                      ) : null}
                      <LuChevronRight size={14} aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* ── What has run through it ───────────────────────────────────── */}
          <aside className="ioc-console-col ioc-no-scrollbar">
            <p className="ioc-kicker">Traces list</p>
            {pick ? (
              <p className="ioc-console-filter">
                <span className="truncate">{pick.label}</span>
                <span className="ioc-faint shrink-0">
                  {lit.size} of {detail.sessions.length}
                </span>
                <button
                  type="button"
                  onClick={() => setPick(null)}
                  className="ioc-link shrink-0"
                >
                  Clear
                </button>
              </p>
            ) : null}
            <ul className="ioc-console-sessions mt-2 flex flex-col">
              {detail.sessions.map((entry) => (
                <li key={entry.id}>
                  <ConsoleTraceRow
                    usual={usualCost(detail.sessions)}
                    appId={detail.app.id}
                    session={entry}
                    verdict={verdictOf(entry)}
                    lit={lit.has(entry.id)}
                    far={Boolean(pick) && !lit.has(entry.id)}
                  />
                </li>
              ))}
            </ul>
          </aside>
        </div>
      )}

      {/* Which sessions to spend an investigation on, put forward but not
          decided: several can go at once. */}
      {choosing ? (
        <ConsoleDrawer
          title="Start an investigation"
          blurb="Pick the sessions to look into. The ones with something against them are already ticked."
          onClose={() => setChoosing(false)}
        >
          <ul className="ioc-console-picks">
            {open.map((entry) => {
              const lit = chosen.includes(entry.run.id);
              return (
                <li key={entry.run.id}>
                  <button
                    type="button"
                    aria-pressed={lit}
                    onClick={() =>
                      setChosen((current) =>
                        current.includes(entry.run.id)
                          ? current.filter((one) => one !== entry.run.id)
                          : [...current, entry.run.id],
                      )
                    }
                    className={`ioc-console-pick${lit ? " is-on" : ""}`}
                  >
                    <span className="ioc-console-pick-mark" aria-hidden>
                      {lit ? <LuCheck size={11} /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="ioc-fg text-[12.5px]">
                          {entry.run.id}
                        </span>
                        {advised.includes(entry.run.id) ? (
                          <span className="ioc-console-chip is-soft">
                            recommended
                          </span>
                        ) : null}
                        <span className="ioc-faint text-[11px] font-light">
                          {entry.run.topic}
                        </span>
                      </span>
                      <span className="ioc-faint mt-0.5 block text-left text-[11px] leading-[1.45] font-light">
                        {entry.why.length > 0
                          ? entry.why.join(" · ")
                          : "Nothing against it; investigate it to be sure."}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="ioc-hairline mt-4 flex items-center gap-2 border-t pt-4">
            <p className="ioc-faint text-[11px] font-light">
              {chosen.length} of {open.length} picked.
            </p>
            <button
              type="button"
              disabled={chosen.length === 0}
              onClick={() => {
                setChoosing(false);
                setStep(0);
                setProbe("running");
              }}
              className="ioc-console-act ml-auto"
            >
              <LuScanSearch size={13} aria-hidden />
              Investigate {chosen.length}{" "}
              {chosen.length === 1 ? "session" : "sessions"}
            </button>
          </div>
        </ConsoleDrawer>
      ) : null}

      {reading ? (
        <ConsoleDrawer
          title={reading.title}
          blurb={reading.blurb}
          tabs={VIEWS.map((entry) => ({ id: entry.id, label: entry.label }))}
          active={reading.id}
          onPick={(next) => setView(next as ViewId)}
          onClose={() => setView(null)}
        >
          <Body
            view={reading.id}
            detail={detail}
            pick={pick}
            onPick={choose}
            picking={picking}
          />
        </ConsoleDrawer>
      ) : null}
    </ConsoleShell>
  );
}
