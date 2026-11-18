import {
  CONSOLE_APPS,
  healthOf,
  performanceOf,
  securityOf,
  type ConsoleApp,
} from "./consoleData";

/**
 * What the console knows about one application once it is opened. Invented
 * content in the spirit of the design: fixed, so a card and the page behind
 * it always agree and a review can point at a number twice.
 */

export interface NamedRole {
  name: string;
  role: string;
}

/** One agent or tool on the ring the application is drawn as. */
export interface TopologyNode {
  id: string;
  label: string;
  kind: "moderator" | "agent" | "tool";
  /** How well this one is doing, as a share of one, which tones its orb. */
  health?: number;
  /** A line under the name: the role it plays, or what it is reached for. */
  note?: string;
}

/** One agent calling another, or reaching for a tool. */
export interface TopologyEdge {
  from: string;
  to: string;
  /** Messages that passed this way over the period, which sets the weight. */
  messages: number;
}

export interface TopicBubble {
  label: string;
  sessions: number;
  /** How often the answers on this topic held up, as a share of one. */
  accuracy: number;
}

export interface CognitiveFailure {
  code: string;
  name: string;
  what: string;
  sessions: number;
  of: number;
}

/** One failure a detector wrote up, as it is listed under the clusters. */
export interface FailureInsight {
  id: string;
  /** The trace it was found in, short form, as the reviewers quote it. */
  ref: string;
  insight: string;
  description: string;
  tags: string[];
  spans: number;
  /** Hours since, which is what the "when" column is sorted on. */
  hours: number;
  /** The cognitive failure cluster this one belongs to. */
  code: string;
  /** The run it was found in. */
  session: string;
}

export interface ReasoningNode {
  title: string;
  status: string;
  tone: "ok" | "watch" | "bad" | "info";
  body: string;
  step: string;
}

/** One step following another, and how often that happens across traces. */
export interface ReasoningLink {
  from: string;
  to: string;
  traces: number;
  /** Set where this is the step the trouble travels along. */
  tone?: "bad";
}

export interface ReasoningColumn {
  title: string;
  nodes: ReasoningNode[];
}

export interface MetricGroup {
  title: string;
  metrics: { label: string; value: number }[];
}

/** One term the agents locked, or one candidate they scored. */
export interface ProtocolTerm {
  name: string;
  status: string;
  tone: "ok" | "watch";
  figures: { label: string; value: string }[];
}

/** A block inside an opened protocol: who took part, what was locked, or
    where the tokens went. */
export interface ProtocolBlock {
  title: string;
  note?: string;
  chips?: { label: string; names: string[] }[];
  terms?: ProtocolTerm[];
  bars?: { label: string; value: number }[];
}

export interface Protocol {
  code: string;
  name: string;
  what: string;
  share: number;
  /** Where it stands on this application, said as the console says it. */
  state: string;
  figures: { label: string; value: string }[];
  tiles: { label: string; value: string; note: string }[];
  blocks: ProtocolBlock[];
}

/** One step of a run, as it is drawn on the waterfall. */
export interface TraceSpan {
  name: string;
  actor: string;
  kind: "agent" | "tool" | "llm";
  /** Milliseconds from the start of the run. */
  start: number;
  duration: number;
  status: "error" | "warn" | "ok";
}

export interface TraceTurn {
  actor: string;
  role: string;
  text: string;
}

export interface SessionRow {
  id: string;
  topic: string;
  /** Cognitive failures the detectors found in this session. */
  failures: number;
  /** Cost against what the answer was worth, out of ten. */
  costScore: number;
  spans: number;
  when: string;
  status: "error" | "warn" | "ok";
  /** What this run touched, which is what lights it when something on the
      page is picked. */
  agents: string[];
  models: string[];
  tools: string[];
  failureCodes: string[];
  steps: string[];
  protocols: string[];
  weakMetrics: string[];
  /** What the run itself looked like, for the trace view. */
  duration: string;
  cost: string;
  readings: { label: string; value: number }[];
  timeline: TraceSpan[];
  turns: TraceTurn[];
  /** Whether this run has been through an investigation already. */
  investigated: boolean;
  /** What that investigation came back with, where it has run. */
  verdict?: "malicious" | "clean";
  /** Agents the investigation read as driving the fault. */
  suspects: string[];
  /** Agents it read as carried along by them rather than making it. */
  carried: string[];
}

/** The four readings the application is summed up by, over the period. */
export interface AppSummary {
  /** Performance and security, read as one figure. */
  health: number;
  /** How well the runs answered, from the readings they were graded at. */
  quality: number;
  /** How well the application ran, from the errors against how much it ran. */
  performance: number;
  security: number;
  cognitiveFailures: number;
  fatalErrors: number;
  minorErrors: number;
  authorizedCalls: number;
  deniedCalls: number;
  maliciousTraces: number;
}

export interface AppDetail {
  app: ConsoleApp;
  tags: string[];
  headline: string;
  healthScore: number;
  summary: AppSummary;
  agents: NamedRole[];
  llms: NamedRole[];
  tools: string[];
  topology: TopologyNode[];
  topologyEdges: TopologyEdge[];
  topics: TopicBubble[];
  failures: CognitiveFailure[];
  insights: FailureInsight[];
  cost: {
    note: string;
    topSession: string;
    topTopic: string;
    efficientSessions: number;
    waste: number;
    protocols: {
      code: string;
      tokens: number;
      /** Dollars a session, and milliseconds a session. */
      cost: number;
      duration: number;
    }[];
    /** How efficiency is spread across the runs on each topic. */
    spread: {
      topic: string;
      low: number;
      q1: number;
      median: number;
      q3: number;
      high: number;
      points: number[];
    }[];
    /** The runs that cost the most against what they returned. */
    worst: {
      id: string;
      topic: string;
      score: number;
      features: { label: string; weight: number }[];
    }[];
  };
  reasoning: {
    outcome: string;
    columns: ReasoningColumn[];
    links: ReasoningLink[];
    of: number;
  };
  metrics: MetricGroup[];
  protocols: Protocol[];
  sessions: SessionRow[];
}

const AGENTS: Record<string, NamedRole[]> = {
  "trip-planner": [
    { name: "Moderator", role: "Classification" },
    { name: "Schedule Assistant", role: "Planning" },
    { name: "Concierge Assistant", role: "Quality control" },
    { name: "Itinerary Assistant", role: "Coordination" },
  ],
  aether: [
    { name: "Moderator", role: "Classification" },
    { name: "Mailbox Reader", role: "Retrieval" },
    { name: "Reply Drafter", role: "Composition" },
  ],
  "marketing-assistant": [
    { name: "Moderator", role: "Classification" },
    { name: "Campaign Writer", role: "Composition" },
    { name: "Audience Picker", role: "Targeting" },
    { name: "Report Builder", role: "Reporting" },
  ],
  "e-commerce-app": [
    { name: "Moderator", role: "Classification" },
    { name: "Order Agent", role: "Fulfilment" },
    { name: "Refund Agent", role: "Payments" },
    { name: "Buyer Support", role: "Quality control" },
  ],
};

const TOOLS: Record<string, string[]> = {
  "trip-planner": ["Knowledge Base Search", "Ticket Management"],
  aether: ["Mail Search", "File Store"],
  "marketing-assistant": ["Campaign API", "Audience Store"],
  "e-commerce-app": ["Order Book", "Payments", "Catalogue"],
};

const TOPICS: Record<string, TopicBubble[]> = {
  "trip-planner": [
    {
      label: "Travel between Celestia, Verdantia, Luminos",
      sessions: 130,
      accuracy: 0.72,
    },
    {
      label: "Fastest route Luminos to Verdantia",
      sessions: 64,
      accuracy: 0.31,
    },
    { label: "Airplane schedule queries", sessions: 52, accuracy: 0.68 },
    {
      label: "Travel between Luminos and Celestia",
      sessions: 38,
      accuracy: 0.74,
    },
    { label: "Discount on round-trips", sessions: 24, accuracy: 0.44 },
    { label: "Tourist attractions in Celestia", sessions: 18, accuracy: 0.52 },
  ],
  aether: [
    { label: "Summarise a shared mailbox", sessions: 96, accuracy: 0.88 },
    { label: "Answer on behalf of the team", sessions: 54, accuracy: 0.81 },
    { label: "Find a file somebody mentioned", sessions: 31, accuracy: 0.76 },
    { label: "Catch up a thread", sessions: 22, accuracy: 0.84 },
  ],
  "marketing-assistant": [
    { label: "Draft a campaign", sessions: 88, accuracy: 0.7 },
    { label: "Pick an audience", sessions: 46, accuracy: 0.58 },
    { label: "Report on what returned", sessions: 35, accuracy: 0.74 },
    { label: "Reschedule a send", sessions: 17, accuracy: 0.63 },
  ],
  "e-commerce-app": [
    { label: "Where is my order", sessions: 142, accuracy: 0.79 },
    { label: "Refund a purchase", sessions: 77, accuracy: 0.54 },
    { label: "Change a delivery address", sessions: 44, accuracy: 0.66 },
    { label: "Is this in stock", sessions: 29, accuracy: 0.82 },
  ],
};

const FAILURES: CognitiveFailure[] = [
  {
    code: "IE-1",
    name: "Individual Metacognitive Blindness",
    what: "An agent carried on without noticing it had lost the thread.",
    sessions: 4,
    of: 100,
  },
  {
    code: "CE-1",
    name: "Verification and Epistemic Control Failure",
    what: "An answer went out without the check that was meant to hold it up.",
    sessions: 3,
    of: 100,
  },
  {
    code: "CC-3",
    name: "Incomplete Synthesis",
    what: "The parts were gathered, the answer only used some of them.",
    sessions: 2,
    of: 100,
  },
];

const INSIGHTS: Record<string, FailureInsight[]> = {
  "trip-planner": [
    {
      id: "Failure_22",
      ref: "#fra521",
      insight: "Cancellation eligibility verified",
      description: "Policies were excluding on section 2.3b.",
      tags: ["search-rules"],
      spans: 14,
      hours: 7,
      code: "CE-1",
      session: "Session-3091",
    },
    {
      id: "Failure_25",
      ref: "#9b3c21",
      insight: "No fabrication policy rules",
      description: "Status showing as void on the billing portal.",
      tags: ["entity-rules", "prefers-rule"],
      spans: 51,
      hours: 7,
      code: "IE-1",
      session: "Session-3054",
    },
    {
      id: "Failure_21",
      ref: "#8af821",
      insight: "Payment method matches confirmation",
      description: "Confirmed $3,311, charged $1,200 on the cabin.",
      tags: ["payment", "suggests"],
      spans: 17,
      hours: 6,
      code: "CC-3",
      session: "Session-3017",
    },
    {
      id: "Failure_23",
      ref: "#22da21",
      insight: "Destination origin not preserved",
      description:
        "Changed destination for the plan, a likely mistake in the destination zone.",
      tags: ["entity"],
      spans: 9,
      hours: 5,
      code: "IE-1",
      session: "Session-2980",
    },
    {
      id: "Failure_27",
      ref: "#3a5cb9",
      insight: "Insurance reason scope incorrect",
      description:
        "Sold insurance for a change of plan, outside the insurance model base.",
      tags: ["insurance"],
      spans: 8,
      hours: 3,
      code: "CE-1",
      session: "Session-2943",
    },
    {
      id: "Failure_28",
      ref: "#71ce04",
      insight: "Route quoted before fares loaded",
      description:
        "A fastest route went out while the fare rules were still being read.",
      tags: ["timing", "search-rules"],
      spans: 23,
      hours: 2,
      code: "CC-3",
      session: "Session-2906",
    },
    {
      id: "Failure_30",
      ref: "#0d4411",
      insight: "Discount claim unsupported",
      description:
        "A round-trip discount was offered that no retrieved policy carries.",
      tags: ["payment", "entity-rules"],
      spans: 31,
      hours: 1,
      code: "IE-1",
      session: "Session-3091",
    },
  ],
  default: [
    {
      id: "Failure_14",
      ref: "#c21f09",
      insight: "Answer sent without the check",
      description: "The verification step was skipped under a long context.",
      tags: ["verification"],
      spans: 19,
      hours: 8,
      code: "CE-1",
      session: "Session-3054",
    },
    {
      id: "Failure_16",
      ref: "#55ab30",
      insight: "Retrieved parts only partly used",
      description: "Three documents came back, the answer leaned on one.",
      tags: ["retrieval", "synthesis"],
      spans: 27,
      hours: 6,
      code: "CC-3",
      session: "Session-3017",
    },
    {
      id: "Failure_18",
      ref: "#9f2204",
      insight: "Thread lost mid-run",
      description: "The agent carried on past the point the request had moved.",
      tags: ["context"],
      spans: 12,
      hours: 4,
      code: "IE-1",
      session: "Session-2980",
    },
    {
      id: "Failure_19",
      ref: "#3e7712",
      insight: "Handoff repeated the same work",
      description: "Two agents each did the lookup the other had already done.",
      tags: ["handoff", "cost"],
      spans: 44,
      hours: 2,
      code: "CC-3",
      session: "Session-2943",
    },
    {
      id: "Failure_20",
      ref: "#68dd51",
      insight: "Confidence stated above evidence",
      description: "A firm answer rested on a single low-confidence match.",
      tags: ["calibration"],
      spans: 15,
      hours: 1,
      code: "CE-1",
      session: "Session-2906",
    },
  ],
};

const REASONING: ReasoningColumn[] = [
  {
    title: "Understand request",
    nodes: [
      {
        title: "User request",
        status: "Intent captured",
        tone: "ok",
        body: "The traveller asks for a six-day itinerary.",
        step: "Step 1 · Evidence check",
      },
      {
        title: "Trip constraints",
        status: "Dates and route",
        tone: "info",
        body: "Origin, destination, timing, and trip length.",
        step: "Step 2 · Evidence check",
      },
      {
        title: "Answer scope",
        status: "Single itinerary",
        tone: "info",
        body: "One plan is requested.",
        step: "Step 3 · Evidence check",
      },
    ],
  },
  {
    title: "Gather evidence",
    nodes: [
      {
        title: "Fare policy",
        status: "Retrieved",
        tone: "ok",
        body: "Fare rules and discounts loaded for review.",
        step: "Step 1 · Evidence check",
      },
      {
        title: "Route options",
        status: "Retrieved",
        tone: "ok",
        body: "Available routes and travel times collected.",
        step: "Step 2 · Evidence check",
      },
      {
        title: "Destination details",
        status: "Retrieved",
        tone: "ok",
        body: "Requested city and stay details confirmed.",
        step: "Step 3 · Evidence check",
      },
    ],
  },
  {
    title: "Plan and check",
    nodes: [
      {
        title: "Route selection",
        status: "Selected",
        tone: "ok",
        body: "A route is chosen for the requested journey.",
        step: "Step 1 · Evidence check",
      },
      {
        title: "Budget check",
        status: "Needs review",
        tone: "watch",
        body: "Quoted totals need to match retrieved fare rules.",
        step: "Step 2 · Evidence check",
      },
      {
        title: "Itinerary coverage",
        status: "Validated",
        tone: "ok",
        body: "The plan covers the requested travel days.",
        step: "Step 3 · Evidence check",
      },
    ],
  },
  {
    title: "Verify outcome",
    nodes: [
      {
        title: "Response facts",
        status: "Validated",
        tone: "ok",
        body: "Dates, cities, and route details are checked.",
        step: "Step 1 · Evidence check",
      },
      {
        title: "Fare accuracy",
        status: "Failed",
        tone: "bad",
        body: "A discount claim differs from retrieved policy.",
        step: "Step 2 · Evidence check",
      },
      {
        title: "Final outcome",
        status: "Review needed",
        tone: "watch",
        body: "The itinerary is assembled with a fare warning.",
        step: "Step 3 · Evidence check",
      },
    ],
  },
];

const REASONING_LINKS: ReasoningLink[] = [
  { from: "User request", to: "Route options", traces: 420 },
  { from: "User request", to: "Fare policy", traces: 310 },
  { from: "Trip constraints", to: "Route options", traces: 480 },
  { from: "Trip constraints", to: "Destination details", traces: 260 },
  { from: "Answer scope", to: "Destination details", traces: 180 },
  { from: "Answer scope", to: "Fare policy", traces: 90 },
  { from: "Route options", to: "Route selection", traces: 470 },
  { from: "Fare policy", to: "Budget check", traces: 400 },
  { from: "Destination details", to: "Itinerary coverage", traces: 300 },
  { from: "Route options", to: "Itinerary coverage", traces: 210 },
  { from: "Fare policy", to: "Route selection", traces: 120 },
  { from: "Route selection", to: "Response facts", traces: 450 },
  { from: "Budget check", to: "Fare accuracy", traces: 380, tone: "bad" },
  { from: "Itinerary coverage", to: "Response facts", traces: 240 },
  { from: "Budget check", to: "Final outcome", traces: 110, tone: "bad" },
  { from: "Itinerary coverage", to: "Final outcome", traces: 190 },
];

const METRICS: MetricGroup[] = [
  {
    title: "Coordination structure",
    metrics: [
      { label: "Policy safety", value: 0.54 },
      { label: "Delegation accuracy", value: 0.79 },
      { label: "Goal alignment", value: 0.74 },
    ],
  },
  {
    title: "Interaction quality",
    metrics: [
      { label: "Instruction following", value: 0.27 },
      { label: "Handoff quality", value: 0.91 },
      { label: "Semantic consistency", value: 0.22 },
      { label: "Context preservation", value: 0.38 },
      { label: "Confidence calibration", value: 0.22 },
      { label: "Verification quality", value: 0.37 },
      { label: "Communication efficiency", value: 0.71 },
    ],
  },
  {
    title: "Outcome quality",
    metrics: [
      { label: "Groundedness", value: 0.5 },
      { label: "Task completion", value: 0.0 },
      { label: "Constraint satisfaction", value: 0.42 },
    ],
  },
];

/**
 * What a session on this application usually costs: the middle of them, so
 * one runaway does not drag the mark it is read against.
 */
export function usualCost(sessions: SessionRow[]): number {
  const spend = sessions
    .map((run) => run.costScore)
    .sort((left, right) => left - right);
  return spend[Math.floor(spend.length / 2)] ?? 0;
}

/** How far over the usual a session has to run before it is worth saying. */
export const COST_LOOSE = 1.2;

/** A protocol that is not on this application yet, and what it would do. */
export interface ProtocolOffer {
  code: string;
  name: string;
  what: string;
}

/** The L9 protocols the console can put on an application. */
export const PROTOCOL_OFFERS: ProtocolOffer[] = [
  {
    code: "CONSENT",
    name: "Agreement before acting",
    what: "Holds an agent back from acting on a shared term until the others have answered it.",
  },
  {
    code: "RECALL",
    name: "Carried context, checked",
    what: "Makes each agent restate what it is carrying, so a fault is caught where it is picked up.",
  },
  {
    code: "QUORUM",
    name: "Agreement before answering",
    what: "Keeps an answer from going out until enough of the agents hold the same one.",
  },
];

const PROTOCOLS: Protocol[] = [
  {
    code: "ACCORD",
    name: "Coordination and shared task context",
    what: "How the agents agree on what they are each holding.",
    share: 0.175,
    state: "Activated",
    figures: [
      { label: "Overhead tokens", value: "28,986" },
      { label: "Run-based terms", value: "2,228" },
      { label: "Contract tokens", value: "382,862" },
    ],
    tiles: [
      {
        label: "Activation",
        value: "Activated",
        note: "Reached the contract at 1.4s",
      },
      {
        label: "Participation",
        value: "System prompt",
        note: "Posted through",
      },
      {
        label: "Entity matching",
        value: "String similarity",
        note: "Four terms, no re-work",
      },
      {
        label: "Term selection",
        value: "4 locked · 0 over-selected",
        note: "60% coverage over the run",
      },
    ],
    blocks: [
      {
        title: "Who participates",
        chips: [
          {
            label: "Agents involved",
            names: [
              "Moderator",
              "Concierge Assistant",
              "Schedule Assistant",
              "Itinerary Assistant",
            ],
          },
          { label: "Agents left out", names: ["Booking Agent"] },
        ],
      },
      {
        title: "Locked terms",
        note: "Four terms held for the whole run.",
        terms: [
          {
            name: "config_reload",
            status: "Extended",
            tone: "watch",
            figures: [
              { label: "Similarity", value: "0.3577" },
              { label: "References", value: "18" },
              { label: "Locked by", value: "Moderator" },
            ],
          },
          {
            name: "cancellation_action",
            status: "Contained",
            tone: "ok",
            figures: [
              { label: "Similarity", value: "0.2104" },
              { label: "References", value: "17" },
              { label: "Locked by", value: "Concierge Assistant" },
            ],
          },
          {
            name: "runtime_stall",
            status: "Extended",
            tone: "watch",
            figures: [
              { label: "Similarity", value: "0.2711" },
              { label: "References", value: "7" },
              { label: "Locked by", value: "Schedule Assistant" },
            ],
          },
          {
            name: "timeout_cascade",
            status: "Contained",
            tone: "ok",
            figures: [
              { label: "Similarity", value: "0.2652" },
              { label: "References", value: "10" },
              { label: "Locked by", value: "Itinerary Assistant" },
            ],
          },
        ],
      },
    ],
  },
  {
    code: "CONCORD",
    name: "Candidate selection and scoring",
    what: "How a winning answer is picked from the ones on offer.",
    share: 0.828,
    state: "Activated",
    figures: [
      { label: "Run tokens", value: "1,192,519" },
      { label: "Candidates", value: "16 / 16" },
      { label: "Rejected", value: "0" },
    ],
    tiles: [
      { label: "Candidates", value: "4 offered", note: "All four scored" },
      { label: "Picked", value: "1", note: "On the second pass" },
      { label: "Re-runs", value: "0", note: "Nothing sent back" },
      {
        label: "Verification",
        value: "Passed",
        note: "Checked against policy",
      },
    ],
    blocks: [
      {
        title: "Candidate scoring",
        note: "Every candidate was scored before one was taken.",
        terms: [
          {
            name: "Candidate A",
            status: "Selected",
            tone: "ok",
            figures: [
              { label: "Score", value: "0.81" },
              { label: "Grounded", value: "Yes" },
              { label: "Offered by", value: "Itinerary Assistant" },
            ],
          },
          {
            name: "Candidate B",
            status: "Runner-up",
            tone: "watch",
            figures: [
              { label: "Score", value: "0.74" },
              { label: "Grounded", value: "Partly" },
              { label: "Offered by", value: "Schedule Assistant" },
            ],
          },
        ],
      },
      {
        title: "Token allocation",
        bars: [
          { label: "Analysis", value: 161491 },
          { label: "Seeds", value: 251586 },
          { label: "Draws", value: 441491 },
          { label: "Finish", value: 38951 },
        ],
      },
    ],
  },
];

const MODELS: NamedRole[] = [
  { name: "GPT-4", role: "Primary reasoning" },
  { name: "GPT-3.5", role: "Quick responses" },
  { name: "Claude 3", role: "Long context analysis" },
];

const ALL_STEPS = REASONING.flatMap((column) =>
  column.nodes.map((node) => node.title),
);

const ALL_METRICS = METRICS.flatMap((group) =>
  group.metrics.map((metric) => metric.label),
);

/** The run as a waterfall: the moderator opens, the agents work, the tools
    are reached for, and the answer is checked on the way out. */
function timelineFor(
  agents: string[],
  tools: string[],
  failing: boolean,
): TraceSpan[] {
  const spans: TraceSpan[] = [
    {
      name: "Classify request",
      actor: agents[0] ?? "Moderator",
      kind: "agent",
      start: 0,
      duration: 820,
      status: "ok",
    },
  ];
  agents.slice(1).forEach((agent, index) => {
    const start = 900 + index * 1600;
    spans.push({
      name: "Draft contribution",
      actor: agent,
      kind: "agent",
      start,
      duration: 1500,
      status: "ok",
    });
    spans.push({
      name: "Model call",
      actor: MODELS[index % MODELS.length].name,
      kind: "llm",
      start: start + 220,
      duration: 900,
      status: "ok",
    });
    const tool = tools[index % Math.max(tools.length, 1)];
    if (tool) {
      spans.push({
        name: "Lookup",
        actor: tool,
        kind: "tool",
        start: start + 700,
        duration: 620,
        status: index === 1 && failing ? "warn" : "ok",
      });
    }
  });
  const last = spans.reduce(
    (end, span) => Math.max(end, span.start + span.duration),
    0,
  );
  spans.push({
    name: "Verify answer",
    actor: agents[0] ?? "Moderator",
    kind: "agent",
    start: last + 120,
    duration: 760,
    status: failing ? "error" : "ok",
  });
  return spans;
}

/**
 * The application's cognitive failures laid across its six recorded runs,
 * worst run first, so the runs add up to what the application is said to
 * have found.
 */
function splitFailures(total: number): number[] {
  const weights = [4, 2, 2, 1, 1, 0];
  const sum = weights.reduce((count, weight) => count + weight, 0);
  const shares = weights.map((weight) => (weight / sum) * total);
  const whole = shares.map(Math.floor);
  let left = total - whole.reduce((count, part) => count + part, 0);
  const order = shares
    .map((share, index) => ({ index, rest: share - Math.floor(share) }))
    .sort((a, b) => b.rest - a.rest);
  for (const entry of order) {
    if (left <= 0) break;
    whole[entry.index] += 1;
    left -= 1;
  }
  return whole;
}

function sessionsFor(app: ConsoleApp): SessionRow[] {
  const topics = TOPICS[app.id] ?? [];
  const agents = (AGENTS[app.id] ?? []).map((agent) => agent.name);
  const tools = TOOLS[app.id] ?? [];
  const insights = INSIGHTS[app.id] ?? INSIGHTS.default;

  const spread = splitFailures(app.cognitiveFailures);

  return Array.from({ length: 6 }, (_, index) => {
    const topic = topics[index % Math.max(topics.length, 1)];
    const failures = spread[index];
    const id = `Session-${3091 - index * 37}`;
    // Each run takes the moderator and a turning share of the rest, so the
    // page has something different to light whichever agent is picked.
    const tookPart = agents.filter(
      (_, seat) => seat === 0 || (seat + index) % 2 === 0,
    );
    const reached = tools.filter((_, seat) => (seat + index) % 2 === 0);
    const mine = insights.filter((insight) => insight.session === id);
    const codes = mine.length
      ? Array.from(new Set(mine.map((insight) => insight.code)))
      : FAILURES.slice(0, failures).map((failure) => failure.code);

    return {
      id,
      topic: topic ? topic.label : "Session",
      failures,
      costScore: Number((4.82 - index * 0.32).toFixed(2)),
      spans: 30 - index * 4,
      when: `${index + 3}h ago`,
      status: (failures >= 3 ? "error" : failures > 0 ? "warn" : "ok") as
        "error" | "warn" | "ok",
      agents: tookPart,
      models: [MODELS[index % MODELS.length].name],
      tools: reached,
      failureCodes: failures > 0 ? codes : [],
      steps: ALL_STEPS.filter((_, seat) => (seat + index) % 3 === 0),
      protocols: index % 3 === 0 ? ["ACCORD", "CONCORD"] : ["CONCORD"],
      weakMetrics: ALL_METRICS.filter((_, seat) => (seat + index) % 4 === 0),
      duration: `${(14 + index * 1.4).toFixed(1)}s`,
      cost: `$${(0.0005 + index * 0.00007).toFixed(5)}`,
      readings: [
        { label: "Answer relevancy", value: 0.915 - index * 0.04 },
        { label: "Answer groundedness", value: 0.87 - index * 0.05 },
        { label: "Utilization accuracy", value: 0.94 - index * 0.03 },
      ],
      timeline: timelineFor(tookPart, reached, failures > 0),
      // Only the run somebody already looked into carries a verdict, and
      // only it has anything to enforce off the back of.
      // The traces the application is said to have had investigated are its
      // worst ones, and they are the only ones that came back malicious.
      investigated: index < app.maliciousTraces,
      verdict: (index < app.maliciousTraces
        ? "malicious"
        : undefined) as SessionRow["verdict"],
      // An agent is only read as malicious once something has looked at the
      // run; before that there is nothing to read it from.
      suspects: index < app.maliciousTraces && tookPart[1] ? [tookPart[1]] : [],
      carried: index < app.maliciousTraces && tookPart[2] ? [tookPart[2]] : [],
      turns: [
        {
          actor: "Traveller",
          role: "asks",
          text: topic ? topic.label : "A question for the application.",
        },
        {
          actor: tookPart[0] ?? "Moderator",
          role: "hands out",
          text: "Classified the request and passed it to the agents holding the relevant context.",
        },
        {
          actor: tookPart[1] ?? "Agent",
          role: "answers",
          text: "Put together a draft from what the lookups returned.",
        },
        {
          actor: tookPart[0] ?? "Moderator",
          role: failures > 0 ? "flags" : "closes",
          text:
            failures > 0
              ? "Checked the draft and found a claim the retrieved policy does not carry."
              : "Checked the draft against the retrieved policy and sent it out.",
        },
      ],
    };
  });
}

function topologyFor(app: ConsoleApp): TopologyNode[] {
  const agents = AGENTS[app.id] ?? [];
  const tools = TOOLS[app.id] ?? [];
  return [
    ...agents.map((agent, index) => ({
      id: `agent-${index}`,
      label: agent.name,
      kind: (index === 0 ? "moderator" : "agent") as TopologyNode["kind"],
      // Spread around the application's own score, so the ring reads the
      // way the card that led here did.
      health: Math.max(
        0.12,
        Math.min(0.96, performanceOf(app) + (index % 3) * 0.18 - 0.18),
      ),
      note: agent.role,
    })),
    ...tools.map((tool, index) => ({
      id: `tool-${index}`,
      label: tool,
      kind: "tool" as const,
      note: "tool",
    })),
  ];
}

function edgesFor(app: ConsoleApp): TopologyEdge[] {
  const agents = AGENTS[app.id] ?? [];
  const tools = TOOLS[app.id] ?? [];
  const edges: TopologyEdge[] = [];
  // The moderator hands work out and takes answers back; each agent reaches
  // for the tool it was given.
  agents.slice(1).forEach((_, index) => {
    edges.push({
      from: "agent-0",
      to: `agent-${index + 1}`,
      messages: 420 - index * 90,
    });
    edges.push({
      from: `agent-${index + 1}`,
      to: "agent-0",
      messages: 310 - index * 70,
    });
    if (tools.length > 0) {
      edges.push({
        from: `agent-${index + 1}`,
        to: `tool-${index % tools.length}`,
        messages: 190 - index * 40,
      });
    }
  });
  return edges.filter((edge) => edge.messages > 0);
}

/** A fixed spread of numbers from a name, so a chart never moves between
    visits but still looks like real measurement. */
function wobble(seed: string, index: number): number {
  let hash = 0;
  for (const letter of `${seed}-${index}`) {
    hash = (hash * 31 + letter.charCodeAt(0)) % 100000;
  }
  return (hash % 1000) / 1000;
}

/** How the efficiency score is spread across the runs on each topic. */
function spreadFor(app: ConsoleApp) {
  return (TOPICS[app.id] ?? []).map((topic) => {
    const middle = 6 + wobble(topic.label, 0) * 16;
    const width = 2 + wobble(topic.label, 1) * 7;
    const low = Math.max(1, middle - width * 1.7);
    const high = middle + width * 1.9;
    // A tail of outliers, which is where the expensive runs hide.
    const points = Array.from({ length: 22 }, (_, index) => {
      const roll = wobble(topic.label, index + 2);
      return roll > 0.78
        ? high + roll * 38
        : low + roll * Math.max(high - low, 1);
    });
    return {
      topic: topic.label,
      low,
      q1: middle - width / 2,
      median: middle,
      q3: middle + width / 2,
      high,
      points,
    };
  });
}

const INEFFICIENCY = [
  { label: "mean_result_len", weight: 0.92 },
  { label: "context_growth_rate", weight: 0.81 },
  { label: "llm_calls_via_session_property", weight: 0.74 },
  { label: "llm_calls_via_edges", weight: 0.56 },
  { label: "n_tools", weight: 0.18 },
  { label: "acc_summarizer_agent_run", weight: -0.17 },
  { label: "token_efficiency_ratio", weight: -0.28 },
  { label: "acc_router_agent_dispatch", weight: -0.42 },
  { label: "backtrack_rate", weight: -0.53 },
  { label: "hallucination_signal_rate", weight: -0.76 },
];

/** The runs that returned the least for what they cost. */
function worstFor(sessions: SessionRow[]) {
  return [...sessions]
    .sort((left, right) => right.costScore - left.costScore)
    .slice(0, 5)
    .map((session) => ({
      id: session.id,
      topic: session.topic,
      score: session.costScore,
      features: INEFFICIENCY.map((feature, index) => ({
        label: feature.label,
        // Each run leans on the same features to a slightly different degree.
        weight: Number(
          (feature.weight * (0.7 + wobble(session.id, index) * 0.55)).toFixed(
            2,
          ),
        ),
      })),
    }));
}

function summaryFor(app: ConsoleApp, sessions: SessionRow[]): AppSummary {
  // Quality is what the runs themselves were graded at; security is how much
  // of what they reached for they were allowed to reach for.
  const readings = sessions.flatMap((session) => session.readings);
  const quality =
    readings.reduce((sum, reading) => sum + reading.value, 0) /
    Math.max(readings.length, 1);
  return {
    health: healthOf(app),
    quality,
    performance: performanceOf(app),
    security: securityOf(app),
    cognitiveFailures: sessions.reduce(
      (sum, session) => sum + session.failures,
      0,
    ),
    fatalErrors: app.fatalErrors,
    minorErrors: app.minorErrors,
    authorizedCalls: app.authorizedCalls,
    deniedCalls: app.deniedCalls,
    maliciousTraces: app.maliciousTraces,
  };
}

export function detailFor(appId: string): AppDetail | null {
  const app = CONSOLE_APPS.find((entry) => entry.id === appId);
  if (!app) {
    return null;
  }
  const sessions = sessionsFor(app);
  return {
    app,
    tags:
      app.id === "trip-planner"
        ? ["Logistics", "Trip planning"]
        : ["Multi-agent", "Assistant"],
    headline: app.description,
    healthScore: healthOf(app),
    summary: summaryFor(app, sessions),
    agents: AGENTS[app.id] ?? [],
    llms: MODELS,
    tools: TOOLS[app.id] ?? [],
    topology: topologyFor(app),
    topologyEdges: edgesFor(app),
    topics: TOPICS[app.id] ?? [],
    failures: FAILURES,
    insights: INSIGHTS[app.id] ?? INSIGHTS.default,
    cost: {
      note: "A disproportionate share of cost sits in multi-step, tool-heavy sessions and repeated verification, which is orchestration to tighten rather than answers to lose.",
      topSession: "Session-3091",
      topTopic: (TOPICS[app.id] ?? [])[1]?.label ?? "—",
      efficientSessions: 784,
      waste: 0.1,
      protocols: [
        { code: "No LP", tokens: 534, cost: 0.09, duration: 410 },
        { code: "ACCORD", tokens: 998, cost: 0.03, duration: 260 },
        { code: "CONCORD", tokens: 128, cost: 0.02, duration: 95 },
      ],
      spread: spreadFor(app),
      worst: worstFor(sessions),
    },
    reasoning: {
      outcome: REASONING.some((column) =>
        column.nodes.some((node) => node.tone === "bad"),
      )
        ? "Review needed"
        : REASONING.some((column) =>
              column.nodes.some((node) => node.tone === "watch"),
            )
          ? "Worth a look"
          : "Answer stands",
      columns: REASONING,
      links: REASONING_LINKS,
      of: 500,
    },
    metrics: METRICS,
    protocols: PROTOCOLS,
    sessions,
  };
}
