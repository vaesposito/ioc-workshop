import { useEffect, useState } from "react";
import {
  LuChevronRight,
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
import { detailFor, type AppDetail } from "./appDetailData";
import { ConsoleTopology } from "./ConsoleTopology";
import { ConsoleOverview } from "./ConsoleOverview";
import { isPicked, touches, type ConsolePick } from "./pick";
import { ConsoleShell } from "./ConsoleShell";
import { ConsoleDrawer } from "./ConsoleDrawer";
import { ConsoleAlert, type Guidance } from "./ConsoleAlert";
import { ConsoleTraceRow } from "./ConsoleTraceRow";
import { ConsoleProbe, PROBE_BEAT, PROBE_STEPS } from "./ConsoleProbe";

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
}: {
  view: ViewId;
  detail: AppDetail;
  pick: ConsolePick | null;
  onPick: (pick: ConsolePick) => void;
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
      return <ProtocolsSection {...shared} />;
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
  // An investigation started from here runs against the worst session that
  // nobody has looked at, and hands the reader over to it once it is done.
  const target =
    [...(detail?.sessions ?? [])]
      .filter((run) => !run.investigated)
      .sort((left, right) => right.failures - left.failures)[0] ?? null;
  const [probe, setProbe] = useState<"none" | "running">("none");
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (probe !== "running" || !detail || !target) return;
    const timer = window.setInterval(() => {
      setStep((current) => {
        if (current < PROBE_STEPS.length - 1) return current + 1;
        window.clearInterval(timer);
        setProbe("none");
        navigate(
          `/console/apps/${detail.app.id}/traces/${target.id}?investigated=1`,
        );
        return current;
      });
    }, PROBE_BEAT);
    return () => window.clearInterval(timer);
  }, [probe, detail, target, navigate]);
  // Nothing is open until a reading is asked for, and then it comes over
  // the page rather than squeezing into the column.
  // A reading can be asked for in the address, which is how the tour opens
  // one before saying anything about it.
  const [params] = useSearchParams();
  const asked = params.get("view");
  const [view, setView] = useState<ViewId | null>(
    VIEWS.some((entry) => entry.id === asked) ? (asked as ViewId) : null,
  );
  const reading = VIEWS.find((entry) => entry.id === view) ?? null;
  // One thing at a time is held across the three columns: picking it again
  // lets it go.
  const [pick, setPick] = useState<ConsolePick | null>(null);
  const [l9, setL9] = useState(false);
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
  const looked = (detail?.sessions ?? []).filter(
    (run) => run.investigated,
  ).length;
  // Runs that ended badly without anybody looking into them: a reason to
  // look, counted beside the calls that were refused.
  const applied = detail?.app.applied;
  const held = applied ? applied.blockedAgents + applied.blockedCalls : 0;
  const issues = detail
    ? detail.summary.cognitiveFailures + detail.summary.fatalErrors
    : 0;
  const protocol = l9 || (detail?.app.applied.protocols ?? 0) > 0;
  const rough = (detail?.sessions ?? []).filter(
    (run) => run.status === "error" && !run.investigated,
  ).length;
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
          standing: protocol
            ? `L9 protocol configured, ${issues} still standing`
            : "No protocol configured",
          onOpen: () => setView("failures"),
          action: {
            label: protocol
              ? "Tighten the L9 protocol"
              : "Configure L9 protocol",
            icon: <LuSlidersHorizontal size={14} aria-hidden />,
            onAct: () => setL9(true),
          },
        },
        {
          id: "security",
          // Nothing is a security issue until an investigation says so. What
          // can be said beforehand is that something is worth a look.
          hint:
            detail.summary.maliciousTraces > 0
              ? "An investigation traced these sessions back to where they started; what it found can be enforced from the session's own page."
              : "Refused calls and sessions that ended badly are risks, not findings. An investigation is what turns one into the other.",
          label:
            detail.summary.maliciousTraces > 0
              ? "Security issues"
              : "Potential security risks",
          count:
            detail.summary.maliciousTraces > 0
              ? detail.summary.maliciousTraces
              : detail.summary.deniedCalls + rough,
          grave: detail.summary.maliciousTraces > 0,
          settled: false,
          standing:
            probe === "running"
              ? `Investigating ${target?.id ?? "the worst session"}`
              : detail.summary.maliciousTraces > 0
                ? held > 0
                  ? `${detail.summary.maliciousTraces} malicious, ${held} ${held === 1 ? "control" : "controls"} in place`
                  : `${detail.summary.maliciousTraces} of ${looked} investigated traces came back malicious`
                : looked > 0
                  ? `${looked} of ${detail.sessions.length} traces investigated, nothing malicious found`
                  : "Nothing investigated yet",
          onOpen: () => setView("security"),
          action: {
            label:
              probe === "running" ? "Investigating…" : "Start an investigation",
            icon: <LuScanSearch size={14} aria-hidden />,
            onAct: () => {
              if (probe === "running" || !target) return;
              setStep(0);
              setProbe("running");
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

      <h1 className="ioc-title mt-2 text-[26px] font-light">
        {detail.app.name}
      </h1>

      <ConsoleAlert items={alerts} />

      <DebateSection label="Scores" defaultOpen={false}>
        <ConsoleOverview
          detail={detail}
          onOpen={(next) => setView(next as ViewId)}
        />
      </DebateSection>

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
                  onClick={() => choose({ kind: "topic", id: tag, label: tag })}
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
                        isPicked(pick, "agent", agent.name) ? " is-picked" : ""
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
                        choose({ kind: "agent", id: llm.name, label: llm.name })
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
                  said={`Running against ${target.id}, the worst session nobody has looked at.`}
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

            <p className="ioc-kicker mt-7">Observability</p>
            <ul className="ioc-console-triggers" data-tour="app-observability">
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
          <ul className="mt-2 flex flex-col gap-1.5">
            {detail.sessions.map((entry) => (
              <li key={entry.id}>
                <ConsoleTraceRow
                  appId={detail.app.id}
                  session={entry}
                  lit={lit.has(entry.id)}
                  far={Boolean(pick) && !lit.has(entry.id)}
                />
              </li>
            ))}
          </ul>
        </aside>
      </div>

      {reading ? (
        <ConsoleDrawer
          title={reading.title}
          blurb={reading.blurb}
          tabs={VIEWS.map((entry) => ({ id: entry.id, label: entry.label }))}
          active={reading.id}
          onPick={(next) => setView(next as ViewId)}
          onClose={() => setView(null)}
        >
          <Body view={reading.id} detail={detail} pick={pick} onPick={choose} />
        </ConsoleDrawer>
      ) : null}
    </ConsoleShell>
  );
}
