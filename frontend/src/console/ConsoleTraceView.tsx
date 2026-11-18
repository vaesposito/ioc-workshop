import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  LuBan,
  LuBot,
  LuChevronDown,
  LuChevronRight,
  LuLock,
  LuScanSearch,
  LuSlidersHorizontal,
  LuUser,
  LuWrench,
} from "react-icons/lu";

import { DebateSection } from "../components/DebateSection";
import { ConsoleShell } from "./ConsoleShell";
import { ConsoleDrawer } from "./ConsoleDrawer";
import { ConsoleDial } from "./ConsoleDial";
import { ConsoleTopology } from "./ConsoleTopology";
import { ConsoleAlert, type Guidance } from "./ConsoleAlert";
import { ConsoleEnforcement, movesFor } from "./ConsoleEnforcement";
import {
  rememberLook,
  settleMove,
  standingOn,
  useConsoleStanding,
  type Standing,
} from "./consoleStanding";
import { ConsoleProbe, PROBE_BEAT, PROBE_STEPS } from "./ConsoleProbe";
import { findingsFor } from "./consoleReading";
import { traceOf, type TraceEntry } from "./consoleTrace";
import { ConsoleFindings } from "./ConsoleFindings";
import {
  CostSection,
  MetricsSection,
  ProtocolsSection,
  ReasoningSection,
} from "./AppSections";
import { detailFor } from "./appDetailData";
import type {
  AppDetail,
  ReasoningColumn,
  ReasoningLink,
  ReasoningNode,
  SessionRow,
} from "./appDetailData";
import { isPicked, type ConsolePick } from "./pick";

/** The readings of one run, each opened over the page. */
const VIEWS = [
  {
    id: "metrics",
    label: "Cognitive metrics",
    title: "Cognitive metrics",
    blurb:
      "How this session coordinated, handed work over, and stood behind its answer.",
  },
  {
    id: "reasoning",
    label: "Reasoning path",
    title: "Reasoning path",
    blurb: "How this session was put together, from the request to the check.",
  },
  {
    id: "protocols",
    label: "Cognition protocols",
    title: "Cognition protocols",
    blurb: "The protocols this session went through, and what they locked.",
  },
  {
    id: "cost",
    label: "Cost & quality",
    title: "Cost and quality",
    blurb: "What this session cost against what it returned.",
  },
] as const;

type ViewId = (typeof VIEWS)[number]["id"];

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function band(value: number): string {
  if (value < 0.4) return "#f05252";
  if (value < 0.7) return "#f6a356";
  return "#04a4ca";
}

/**
 * The run read in phases, the same five the reasoning path is drawn in:
 * what was asked, how it was split up, what was fetched, what was written,
 * and what was checked before it went out.
 */
const PHASES = [
  { id: "intake", label: "Intake", said: "What was asked for." },
  { id: "plan", label: "Plan", said: "How the work was split up." },
  { id: "retrieve", label: "Retrieve", said: "What was fetched to answer it." },
  { id: "draft", label: "Draft", said: "What was written from it." },
  { id: "verify", label: "Verify", said: "What was checked before it went." },
] as const;

type PhaseId = (typeof PHASES)[number]["id"];

/** Which phase an entry belongs to, by what it is and what it was called. */
function phaseOf(entry: TraceEntry): PhaseId {
  if (entry.kind === "turn") {
    if (entry.title === "asks") return "intake";
    if (entry.title === "hands out") return "plan";
    if (entry.title === "answers") return "draft";
    return "verify";
  }
  if (entry.kind === "tool") return "retrieve";
  if (entry.title.startsWith("Classify")) return "plan";
  if (entry.title.startsWith("Verify")) return "verify";
  return "draft";
}

interface TraceLeg {
  id: PhaseId;
  label: string;
  said: string;
  entries: TraceEntry[];
}

function legsOf(trace: TraceEntry[]): TraceLeg[] {
  return PHASES.map((phase) => ({
    id: phase.id,
    label: phase.label,
    said: phase.said,
    entries: trace.filter((entry) => phaseOf(entry) === phase.id),
  })).filter((leg) => leg.entries.length > 0);
}

const PREVIEW = 150;

function preview(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= PREVIEW ? flat : `${flat.slice(0, PREVIEW).trimEnd()}…`;
}

/** One entry of the run, written the way a debate turn is written. */
function Entry({
  entry,
  found,
  calm,
  struck,
  open,
  lit,
  far,
  onToggle,
  onPick,
}: {
  entry: TraceEntry;
  /** The cognitive failures the detectors put at this point of the run. */
  found: { code: string; label: string }[];
  /** An investigation came back clean, so nothing here is held against it. */
  calm: boolean;
  /** Opened from a security finding, so it is lit as one. */
  struck: boolean;
  open: boolean;
  lit: boolean;
  far: boolean;
  onToggle: () => void;
  onPick: () => void;
}) {
  const spoken = entry.kind === "turn";
  const Mark = spoken ? LuUser : entry.kind === "tool" ? LuWrench : LuBot;
  return (
    <li
      id={entry.id}
      className={`ioc-chat-row ioc-chat-row-agent ioc-console-entry${
        found.length > 0 ? " is-found" : ""
      }${calm ? " is-calm" : ""}${lit ? " is-lit" : ""}${
        struck ? " is-struck" : ""
      }${far ? " is-far" : ""}`}
    >
      <div className="ioc-chat-identity">
        <button
          type="button"
          onClick={onPick}
          className="ioc-console-entry-who"
          title={spoken ? undefined : `Show only ${entry.actor}`}
        >
          <span
            className={`ioc-chat-avatar ioc-chat-avatar-agent${
              entry.status === "error" ? " is-adversary" : ""
            }`}
            aria-hidden
          >
            <Mark size={13} />
          </span>
          <span className="ioc-chat-who">{entry.actor}</span>
        </button>
        {entry.duration ? (
          <span className="ioc-chat-model">{entry.duration} ms</span>
        ) : null}
        {entry.status !== "ok" ? (
          <span
            className={`ioc-debate-flag ${
              entry.status === "error" ? "is-danger" : "is-watch"
            }`}
          >
            {entry.status === "error" ? "error" : "slow"}
          </span>
        ) : null}
      </div>
      <div className="ioc-chat-stack">
        <div className="ioc-chat-bubble ioc-chat-bubble-agent">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            className="ioc-chat-toggle is-labeled"
          >
            <span className="ioc-chat-meta">
              <span className="ioc-chat-role">{entry.title}</span>
              {found.map((mark) => (
                <span
                  key={mark.code}
                  className={`ioc-debate-flag ${
                    calm ? "is-calm" : "is-danger"
                  }`}
                  title={mark.label}
                >
                  {mark.code}
                </span>
              ))}
            </span>
            <LuChevronDown
              size={14}
              className={`ioc-chat-chevron ${open ? "rotate-180" : ""}`}
            />
          </button>
          {open ? (
            <pre className="ioc-chat-body">{entry.body ?? entry.title}</pre>
          ) : (
            <p className="ioc-chat-preview">
              {preview(entry.body ?? entry.title)}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

/**
 * The path this one session took: the five phases in order, each carrying
 * what happened in it and whether it held. An application's reading shows
 * every path its sessions take at once; a session only ever took one.
 */
function pathOf(
  legs: TraceLeg[],
  session: SessionRow,
): { columns: ReasoningColumn[]; links: ReasoningLink[]; outcome: string } {
  const columns: ReasoningColumn[] = legs.map((leg, index) => {
    const broke = leg.entries.filter((entry) => entry.status === "error");
    const slow = leg.entries.filter((entry) => entry.status === "warn");
    const tone: ReasoningNode["tone"] =
      broke.length > 0 ? "bad" : slow.length > 0 ? "watch" : "ok";
    const spent = leg.entries.reduce(
      (sum, entry) => sum + (entry.duration ?? 0),
      0,
    );
    return {
      title: leg.label,
      nodes: [
        {
          title: leg.label,
          status:
            broke.length > 0
              ? `${broke.length} errored`
              : slow.length > 0
                ? `${slow.length} came back late`
                : "Held",
          tone,
          body: `${leg.said} ${leg.entries.length} entries${
            spent > 0 ? `, ${spent} ms` : ""
          }.`,
          step: `Phase ${index + 1} · ${leg.said.replace(/\.$/, "")}`,
        },
      ],
    };
  });
  const links: ReasoningLink[] = columns.slice(1).map((column, index) => ({
    from: columns[index].nodes[0].title,
    to: column.nodes[0].title,
    traces: 1,
    tone: column.nodes[0].tone === "bad" ? ("bad" as const) : undefined,
  }));
  const broke = columns.find((column) => column.nodes[0].tone === "bad");
  const watch = columns.find((column) => column.nodes[0].tone === "watch");
  return {
    columns,
    links,
    outcome: broke
      ? "Review needed"
      : watch || session.failures > 0
        ? "Worth a look"
        : "Answer stands",
  };
}

/** One run, with only what that run touched. */
export function ConsoleTraceView() {
  const { id, traceId } = useParams();
  const detail = id ? detailFor(id) : null;
  const session = detail?.sessions.find((entry) => entry.id === traceId);
  const [view, setView] = useState<ViewId | null>(null);
  const [pick, setPick] = useState<ConsolePick | null>(null);
  const [held, setHeld] = useState<string | null>(null);
  // Whether what sent the reader here was a security finding, which the
  // trace says in the colour it lights the entry with.
  const [struck, setStruck] = useState(false);
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const [seat, setSeat] = useState<string | null>(null);
  // What has been done about this session is held for the whole demo, not
  // for this page: a control taken here is still in force on the
  // application, and on this page when it is opened again.
  const standing = useConsoleStanding();
  // An investigation run from this page: it walks its steps, then the page
  // can say what it made of the session.
  const [probe, setProbe] = useState<"none" | "running" | "done">("none");
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (probe !== "running") return;
    const timer = window.setInterval(() => {
      setStep((current) => {
        if (current < PROBE_STEPS.length - 1) return current + 1;
        window.clearInterval(timer);
        setProbe("done");
        return current;
      });
    }, PROBE_BEAT);
    return () => window.clearInterval(timer);
  }, [probe]);

  // An investigation run from here is remembered for the demo, so the
  // session still reads as investigated once this page is left.
  useEffect(() => {
    if (probe !== "done" || !detail || !session) return;
    rememberLook({
      app: detail.app.id,
      session: session.id,
      verdict:
        session.verdict ?? (session.failures >= 2 ? "malicious" : "clean"),
    });
  }, [probe, detail, session]);

  const choose = (next: ConsolePick) =>
    setPick((current) =>
      current && current.kind === next.kind && current.id === next.id
        ? null
        : next,
    );

  /** Take the reader to the point in the trace something was found at. */
  const goTo = (entryId: string, tone?: "bad") => {
    setHeld(entryId);
    setStruck(tone === "bad");
    setOpened((current) => new Set(current).add(entryId));
    // The scroll waits a beat for the entry to have opened on the page.
    window.setTimeout(() => {
      document
        .getElementById(entryId)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
  };

  if (!detail || !session) {
    return (
      <ConsoleShell>
        <p className="ioc-copy text-[13px] font-light">
          No such trace.{" "}
          <Link to="/console" className="ioc-link">
            Back to the list
          </Link>
          .
        </p>
      </ConsoleShell>
    );
  }

  const trace = traceOf(session);
  const legs = legsOf(trace);
  const allOpen = trace.length > 0 && trace.every((e) => opened.has(e.id));
  const events = detail.insights.filter(
    (insight) => insight.session === session.id,
  );
  // Each thing found is pinned to a point in the run, so it can be read in
  // place rather than on its own.
  const pointAt = (key: string) => {
    let hash = 0;
    for (const letter of key) hash = (hash * 31 + letter.charCodeAt(0)) % 9973;
    return trace[hash % trace.length]?.id ?? trace[0]?.id ?? "";
  };

  const weak = new Set(session.weakMetrics);
  const path = pathOf(legs, session);
  const here: AppDetail = {
    ...detail,
    sessions: [session],
    topics: detail.topics.filter((topic) => topic.label === session.topic),
    agents: detail.agents.filter((agent) =>
      session.agents.includes(agent.name),
    ),
    llms: detail.llms.filter((llm) => session.models.includes(llm.name)),
    tools: detail.tools.filter((tool) => session.tools.includes(tool)),
    topology: detail.topology.filter(
      (node) =>
        session.agents.includes(node.label) ||
        session.tools.includes(node.label),
    ),
    failures: detail.failures.filter((failure) =>
      session.failureCodes.includes(failure.code),
    ),
    insights: events,
    protocols: detail.protocols.filter((protocol) =>
      session.protocols.includes(protocol.code),
    ),
    metrics: detail.metrics.map((group) => ({
      ...group,
      metrics: group.metrics.filter((metric) => weak.has(metric.label)),
    })),
    reasoning: { ...path, of: 1 },
    cost: {
      ...detail.cost,
      topSession: session.id,
      topTopic: session.topic,
      efficientSessions: session.failures === 0 ? 1 : 0,
      spread: detail.cost.spread.filter((row) => row.topic === session.topic),
      worst: detail.cost.worst.filter((run) => run.id === session.id),
    },
  };
  here.topologyEdges = detail.topologyEdges.filter((edge) =>
    [edge.from, edge.to].every((end) =>
      here.topology.some((node) => node.id === end),
    ),
  );

  const marks = new Map<string, { code: string; label: string }[]>();
  for (const event of events) {
    const at = pointAt(event.id);
    marks.set(at, [
      ...(marks.get(at) ?? []),
      { code: event.code, label: event.insight },
    ]);
  }
  for (const failure of here.failures) {
    const at = pointAt(
      events.find((event) => event.code === failure.code)?.id ?? failure.code,
    );
    const held = marks.get(at) ?? [];
    if (held.some((mark) => mark.code === failure.code)) continue;
    marks.set(at, [...held, { code: failure.code, label: failure.name }]);
  }

  // What is known about this session: what was on record, and anything the
  // investigation just run from this page turned up.
  const seen = standing.looked.find(
    (entry) => entry.app === detail.app.id && entry.session === session.id,
  );
  const looked = session.investigated || probe === "done" || Boolean(seen);
  const verdict = session.investigated
    ? session.verdict
    : seen
      ? seen.verdict
      : session.failures >= 2
        ? "malicious"
        : "clean";
  const suspects =
    session.suspects.length > 0
      ? session.suspects
      : looked && verdict === "malicious" && session.agents[1]
        ? [session.agents[1]]
        : [];
  const carried =
    session.carried.length > 0
      ? session.carried
      : looked && verdict === "malicious" && session.agents[2]
        ? [session.agents[2]]
        : [];

  // What the investigation made of the agents, read the way an investigation
  // reads it: the same debate, carrying this session's names.
  // The controls this investigation leaves to take, and which way each one
  // has already gone.
  const moves = movesFor({ detail, session, suspects });
  const taken = standingOn(standing.taken, detail.app.id, session.id);
  const enforced = Object.values(taken).filter(
    (entry) => entry === "held",
  ).length;
  const settle = (move: string, next: Standing) => {
    const offer = moves.find((entry) => entry.id === move);
    settleMove({
      app: detail.app.id,
      session: session.id,
      move,
      standing: next,
      label:
        next === "held"
          ? (offer?.hold.taken ?? move)
          : (offer?.let.taken ?? move),
    });
  };

  const found =
    looked && verdict
      ? findingsFor({ detail, session, trace, verdict, suspects, carried })
      : null;
  const suspected = found
    ? found.filter((entry) => entry.detector.label === "manipulator").length
    : 0;

  const flagged = session.timeline.filter(
    (span) => span.status !== "ok",
  ).length;
  const quality =
    session.readings.reduce((sum, reading) => sum + reading.value, 0) /
    Math.max(session.readings.length, 1);
  const widgets = [
    {
      id: "quality",
      label: "Quality",
      figure: percent(quality),
      value: quality,
      tone: band(quality),
      said: "Relevancy, groundedness, and use of what was retrieved.",
      opens: "metrics" as ViewId,
    },
    {
      id: "cost",
      label: "Cost score",
      figure: `${session.costScore}`,
      value: session.costScore / 10,
      tone: band(1 - session.costScore / 10),
      said: "What the session cost against what the answer was worth, out of ten.",
      opens: "cost" as ViewId,
    },
    {
      id: "failures",
      label: "Failures",
      figure: `${session.failures}`,
      value: flagged / Math.max(session.timeline.length, 1),
      tone:
        session.failures > 2
          ? "#f05252"
          : session.failures > 0
            ? "#f6a356"
            : "#04a4ca",
      said: `${flagged} of ${session.timeline.length} spans came back marked.`,
    },
    {
      id: "duration",
      label: "Duration",
      figure: session.duration,
      value: Math.min(parseFloat(session.duration) / 30, 1),
      tone: "var(--ioc-kicker)",
      said: `${session.timeline.length} spans, ${session.cost} spent.`,
    },
  ];

  const broke = session.timeline.filter(
    (span) => span.status === "error",
  ).length;
  const protocol = detail.app.applied.protocols > 0;
  const alerts: Guidance[] = [
    {
      id: "quality",
      hint: "An L9 protocol tightens how the agents coordinate and check each other, which is what lifts performance.",
      label: "Performance issues",
      count: session.failures,
      grave: session.failures > 0,
      settled: session.failures === 0,
      standing: protocol
        ? `L9 protocol configured, ${session.failures} still standing`
        : "No protocol configured",
      onOpen: () =>
        document
          .getElementById("trace-failures")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      action: {
        label: protocol ? "Tighten the L9 protocol" : "Configure L9 protocol",
        icon: <LuSlidersHorizontal size={14} aria-hidden />,
        to: `/console/apps/${detail.app.id}?view=protocols&picking=1`,
      },
    },
    // Nothing is a security issue until an investigation says so. What can be
    // said beforehand is that this run gave reasons to look.
    looked
      ? {
          id: "security",
          hint: "An investigation went through this session and said what it found; what it leaves to decide is further down the page.",
          label: "Security issues",
          count: verdict === "malicious" ? 1 + suspects.length : 0,
          grave: verdict === "malicious",
          settled: verdict !== "malicious" || enforced > 0,
          standing:
            verdict === "malicious"
              ? enforced > 0
                ? `${enforced} ${enforced === 1 ? "control" : "controls"} enforced`
                : "Came back malicious, nothing enforced yet"
              : "Investigated, came back clean",
          onOpen: () => {
            const first = trace.find((entry) => entry.status === "error");
            if (first) goTo(first.id);
          },
          action: {
            label: "Start an investigation",
            icon: <LuScanSearch size={14} aria-hidden />,
            onAct: () => {
              setStep(0);
              setProbe("running");
            },
          },
        }
      : {
          id: "security",
          hint: "A step that errored and a fault carried into the answer are risks, not findings. An investigation is what turns one into the other.",
          label: "Potential security risks",
          count: broke + (session.failures > 0 ? 1 : 0),
          settled: false,
          standing:
            probe === "running"
              ? "Investigation running"
              : "Not investigated yet",
          onOpen: () => {
            const first = trace.find((entry) => entry.status === "error");
            if (first) goTo(first.id);
          },
          action: {
            label:
              probe === "running" ? "Investigating…" : "Start an investigation",
            icon: <LuScanSearch size={14} aria-hidden />,
            onAct: () => {
              if (probe === "running") return;
              setStep(0);
              setProbe("running");
            },
          },
        },
  ];

  // What the investigation recommends, each with the control that answers it.
  if (looked && verdict === "malicious") {
    const tool = session.tools[0] ?? "the tools it reached for";
    const denied = taken.auth === "held";
    alerts.push({
      id: "deny",
      hint: "The investigation read these calls as the way the fault got in. Denying authorization stops them at the policy rather than in the answer.",
      label: `Recommended: deny authorization to ${tool}`,
      count: session.tools.length,
      grave: !denied,
      settled: denied,
      standing: denied ? "Authorization denied" : "Still authorized",
      action: {
        label: "Deny authorization",
        icon: <LuLock size={14} aria-hidden />,
        onAct: () => settle("auth", "held"),
      },
    });

    const flagged = [...suspects, ...carried];
    if (flagged.length > 0) {
      const blocked = taken.block === "held";
      alerts.push({
        id: "block",
        hint: "Agent-ToM read one agent as driving the fault and the other as carried along by it.",
        label:
          suspects.length > 0
            ? `${suspects.join(" and ")} read as manipulator${
                carried.length > 0 ? `, ${carried.join(" and ")} infected` : ""
              }`
            : `${carried.join(" and ")} read as infected`,
        count: flagged.length,
        grave: !blocked,
        settled: blocked,
        standing: blocked ? "Blocked" : "Still running",
        action: {
          label: "Block agents",
          icon: <LuBan size={14} aria-hidden />,
          onAct: () => settle("block", "held"),
        },
      });
    }
  }

  const reading = VIEWS.find((entry) => entry.id === view) ?? null;
  const body = (() => {
    switch (reading?.id) {
      case "metrics":
        return <MetricsSection detail={here} pick={pick} onPick={choose} />;
      case "reasoning":
        return <ReasoningSection detail={here} pick={pick} onPick={choose} />;
      case "protocols":
        return <ProtocolsSection detail={here} pick={pick} onPick={choose} />;
      case "cost":
        return <CostSection detail={here} pick={pick} onPick={choose} />;
      default:
        return null;
    }
  })();

  const tease: Record<ViewId, string> = {
    metrics: `${session.weakMetrics.length} readings came back weak`,
    reasoning: `outcome ${detail.reasoning.outcome.toLowerCase()}`,
    protocols: session.protocols.join(" · "),
    cost: `${session.cost} · score ${session.costScore}`,
  };

  return (
    <ConsoleShell>
      <nav className="ioc-console-crumbs">
        <Link to="/console" className="ioc-link">
          Applications
        </Link>
        <LuChevronRight size={12} aria-hidden />
        <Link to={`/console/apps/${detail.app.id}`} className="ioc-link">
          {detail.app.name}
        </Link>
        <LuChevronRight size={12} aria-hidden />
        <span className="ioc-fg">{session.id}</span>
      </nav>

      <h1 className="ioc-title mt-2 text-[26px] font-light">{session.id}</h1>

      <ConsoleAlert items={alerts} />

      <DebateSection label="Scores" defaultOpen={false}>
        <ul className="ioc-console-overview">
          {widgets.map((widget) => {
            const inside = (
              <>
                <span className="min-w-0 flex-1">
                  <span className="ioc-console-stat-label">{widget.label}</span>
                  <span className="ioc-fg mt-1 block text-[24px] leading-none font-light">
                    {widget.figure}
                  </span>
                </span>
                <ConsoleDial
                  value={widget.value}
                  from={widget.tone}
                  to={widget.tone}
                  size={46}
                  bare
                  label={widget.said}
                />
              </>
            );
            return (
              <li key={widget.id}>
                {widget.opens ? (
                  <button
                    type="button"
                    onClick={() => setView(widget.opens)}
                    className="ioc-console-widget is-link"
                  >
                    {inside}
                  </button>
                ) : (
                  <div className="ioc-console-widget">{inside}</div>
                )}
              </li>
            );
          })}
        </ul>
      </DebateSection>

      <div className="ioc-console-detail">
        {/* ── What this run was ─────────────────────────────────────────── */}
        <aside className="ioc-console-col ioc-no-scrollbar">
          <p className="ioc-copy text-[12.5px] leading-[1.55] font-light">
            {session.topic}
          </p>
          <p className="ioc-faint mt-1 flex items-center gap-2 text-[11px] font-light">
            <span className={`ioc-console-dot is-${session.status}`} />
            {session.when} · {session.spans} spans · {session.cost}
          </p>

          {probe === "running" || looked ? (
            <div
              className={`mt-4 px-3.5 py-3.5 ${
                probe === "running"
                  ? "ioc-glass rounded-lg"
                  : verdict === "malicious"
                    ? "ioc-glass ioc-class-panel is-danger rounded-lg"
                    : "ioc-glass ioc-class-panel is-success rounded-lg"
              }`}
            >
              <p className="ioc-kicker">Classification</p>
              <p
                className={`mt-2 text-[30px] leading-[0.95] font-light ${
                  probe === "running"
                    ? "ioc-fg"
                    : verdict === "malicious"
                      ? "sev-danger-text"
                      : "sev-success-text"
                }`}
              >
                {probe === "running"
                  ? "Investigating"
                  : verdict === "malicious"
                    ? "Malicious"
                    : "Benign"}
              </p>
              <p className="ioc-kicker mt-3">Method</p>
              <p className="ioc-copy mt-1 text-[12px] font-light">Agent-ToM</p>
            </div>
          ) : null}

          <div className="mt-4 flex flex-col gap-4">
            <DebateSection label="Topology" preview="Who took part">
              <ConsoleTopology
                nodes={here.topology}
                edges={here.topologyEdges}
                pick={pick}
                onPick={choose}
              />
            </DebateSection>
            <DebateSection
              label="Agents"
              preview={`${here.agents.length}`}
              defaultOpen={false}
            >
              <ul className="flex flex-col gap-1.5">
                {here.agents.map((agent) => (
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
                      {suspects.includes(agent.name) ? (
                        <span className="ioc-debate-flag is-danger">
                          malicious
                        </span>
                      ) : carried.includes(agent.name) ? (
                        <span className="ioc-debate-flag is-watch">
                          infected
                        </span>
                      ) : looked ? (
                        <span className="ioc-debate-flag">clean</span>
                      ) : (
                        <span className="ioc-faint text-[10.5px]">
                          unclassified
                        </span>
                      )}
                      <span className="ioc-faint ml-auto">{agent.role}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </DebateSection>
            <DebateSection
              label="Models"
              preview={`${here.llms.length}`}
              defaultOpen={false}
            >
              <ul className="flex flex-col gap-1.5">
                {here.llms.map((llm) => (
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
              preview={`${here.tools.length}`}
              defaultOpen={false}
            >
              <ul className="flex flex-wrap gap-1.5">
                {here.tools.map((tool) => (
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
            <DebateSection
              label="Protocols"
              preview={`${session.protocols.length}`}
              defaultOpen={false}
            >
              <ul className="flex flex-wrap gap-1.5">
                {session.protocols.map((code) => (
                  <li key={code}>
                    <button
                      type="button"
                      aria-pressed={isPicked(pick, "protocol", code)}
                      onClick={() =>
                        choose({ kind: "protocol", id: code, label: code })
                      }
                      className={`ioc-console-tag is-link${
                        isPicked(pick, "protocol", code) ? " is-picked" : ""
                      }`}
                    >
                      {code}
                    </button>
                  </li>
                ))}
              </ul>
            </DebateSection>
          </div>
        </aside>

        {/* ── What was found, and a way into each reading ───────────────── */}
        <section className="ioc-console-middle" data-tour="trace-middle">
          <div className="ioc-console-col ioc-no-scrollbar flex-1">
            <h2 className="ioc-fg text-[15px] font-light">Session quality</h2>
            <p className="ioc-console-note">
              How far this session's answer can be stood behind, graded as it
              closed.
            </p>

            {probe === "running" ? (
              <div className="mt-4">
                <ConsoleProbe step={step} />
              </div>
            ) : null}

            <ul className="mt-4 flex flex-wrap items-start justify-around gap-4">
              {session.readings.map((entry) => (
                <li
                  key={entry.label}
                  className="flex min-w-[7rem] flex-col items-center"
                >
                  <ConsoleDial
                    value={entry.value}
                    from={band(entry.value)}
                    to={band(entry.value)}
                    size={96}
                    label={`${entry.label} ${percent(entry.value)}`}
                  />
                  <p className="ioc-console-dial-label text-center">
                    {entry.label}
                  </p>
                </li>
              ))}
            </ul>

            <p id="trace-failures" className="ioc-kicker mt-7">
              Cognitive failures
            </p>
            <p className="ioc-faint text-[11px] font-light">
              Pick one to go to where it was found.
            </p>
            {here.failures.length === 0 ? (
              <p className="ioc-faint mt-2 text-[11.5px] font-light">
                Nothing was found in this session.
              </p>
            ) : (
              <ul className="mt-2 flex flex-col gap-1.5">
                {here.failures.map((failure) => {
                  const spot =
                    events.find((event) => event.code === failure.code)?.id ??
                    failure.code;
                  return (
                    <li key={failure.code}>
                      <button
                        type="button"
                        aria-pressed={isPicked(pick, "failure", failure.code)}
                        onClick={() => {
                          choose({
                            kind: "failure",
                            id: failure.code,
                            label: failure.name,
                          });
                          goTo(pointAt(spot));
                        }}
                        className={`ioc-console-found${
                          isPicked(pick, "failure", failure.code)
                            ? " is-picked"
                            : ""
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className="ioc-console-chip is-bad">
                            {failure.code}
                          </span>
                          <span className="ioc-fg text-[11.5px]">
                            {failure.name}
                          </span>
                        </span>
                        <span className="ioc-copy mt-1 block text-left text-[11.5px] leading-[1.45] font-light">
                          {failure.what}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* The investigation's own account of each agent it suspects,
                under this page's name for it. */}
            {found ? (
              <div className="mt-7" data-tour="trace-findings">
                <DebateSection
                  label="Security findings"
                  preview={`${suspected} suspected`}
                  defaultOpen
                >
                  <ConsoleFindings
                    findings={found}
                    open={seat}
                    onToggle={(id) =>
                      setSeat((shown) => (shown === id ? null : id))
                    }
                    onOpen={(entryId) =>
                      goTo(entryId, verdict === "malicious" ? "bad" : undefined)
                    }
                  />
                </DebateSection>
              </div>
            ) : null}

            <div className="mt-7">
              {/* There is nothing to enforce against a session that came
                  back clean. */}
              <ConsoleEnforcement
                detail={here}
                session={session}
                looked={looked && verdict === "malicious"}
                suspects={suspects}
                taken={taken}
                onSettle={settle}
              />
            </div>

            <p className="ioc-kicker mt-7">Observability</p>
            <ul className="ioc-console-triggers">
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
                        {tease[entry.id]}
                      </span>
                    </span>
                    <LuChevronRight size={14} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── The run itself ────────────────────────────────────────────── */}
        <aside className="ioc-console-col ioc-no-scrollbar">
          <div className="flex items-baseline justify-between gap-2">
            <p className="ioc-kicker">Session trace</p>
            <button
              type="button"
              onClick={() => {
                setOpened(
                  allOpen ? new Set() : new Set(trace.map((entry) => entry.id)),
                );
              }}
              className="ioc-link text-[11px]"
            >
              {allOpen ? "Collapse all" : "Expand all"}
            </button>
          </div>
          <p className="ioc-faint text-[11px] font-light">
            {trace.length} entries, in the order they happened.
          </p>

          <ol className="ioc-chat mt-3">
            {trace.map((entry) => {
              const kind = entry.kind === "tool" ? "tool" : "agent";
              const on =
                entry.kind !== "turn" && isPicked(pick, kind, entry.actor);
              return (
                <Entry
                  key={entry.id}
                  entry={entry}
                  found={marks.get(entry.id) ?? []}
                  calm={looked && verdict !== "malicious"}
                  struck={struck && held === entry.id}
                  open={opened.has(entry.id)}
                  lit={on || held === entry.id}
                  far={Boolean(
                    pick &&
                    (pick.kind === "agent" || pick.kind === "tool") &&
                    !on,
                  )}
                  onToggle={() =>
                    setOpened((current) => {
                      const next = new Set(current);
                      if (next.has(entry.id)) next.delete(entry.id);
                      else next.add(entry.id);
                      return next;
                    })
                  }
                  onPick={() => {
                    setHeld(entry.id);
                    if (entry.kind !== "turn") {
                      choose({
                        kind,
                        id: entry.actor,
                        label: entry.actor,
                      });
                    }
                  }}
                />
              );
            })}
          </ol>
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
          {body}
        </ConsoleDrawer>
      ) : null}
    </ConsoleShell>
  );
}
