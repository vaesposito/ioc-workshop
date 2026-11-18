/**
 * The console's content while it has no source behind it: invented
 * applications in the spirit of the design, with every reading the cards
 * have a place for. Fixed rather than generated, so the page reads the same
 * on every reload and can be pointed at in a review.
 */
export interface ConsoleApp {
  id: string;
  name: string;
  description: string;
  agents: number;
  traces: number;
  authorizedCalls: number;
  deniedCalls: number;
  fatalErrors: number;
  minorErrors: number;
  /** What the detectors found across this application's traces. */
  cognitiveFailures: number;
  /** Traces whose investigation came back malicious. */
  maliciousTraces: number;
  tokens: number;
  /** How the cost moved against the period before, as a share of one. */
  costChange: number;
  /** What is already in place off the back of what was found. */
  applied: { protocols: number; blockedAgents: number; blockedCalls: number };
}

export const CONSOLE_APPS: ConsoleApp[] = [
  {
    id: "trip-planner",
    name: "Trip Planner",
    description:
      "A multi-agent application that allows the team to plan their corporate travel.",
    agents: 6,
    traces: 18,
    authorizedCalls: 1240,
    deniedCalls: 14,
    fatalErrors: 3,
    minorErrors: 6,
    cognitiveFailures: 10,
    maliciousTraces: 3,
    tokens: 50000,
    costChange: 0.25,
    applied: { protocols: 1, blockedAgents: 1, blockedCalls: 2 },
  },
  {
    id: "aether",
    name: "Aether",
    description:
      "Reads shared mailboxes and files, and answers on behalf of the team.",
    agents: 3,
    traces: 24,
    authorizedCalls: 2410,
    deniedCalls: 2,
    fatalErrors: 1,
    minorErrors: 4,
    cognitiveFailures: 4,
    maliciousTraces: 0,
    tokens: 38000,
    costChange: -0.12,
    applied: { protocols: 0, blockedAgents: 0, blockedCalls: 0 },
  },
  {
    id: "marketing-assistant",
    name: "Marketing Assistant",
    description:
      "Drafts campaigns, schedules them, and reports on what each one returned.",
    agents: 4,
    traces: 12,
    authorizedCalls: 860,
    deniedCalls: 7,
    fatalErrors: 3,
    minorErrors: 9,
    cognitiveFailures: 8,
    maliciousTraces: 1,
    tokens: 74000,
    costChange: 0.08,
    applied: { protocols: 1, blockedAgents: 0, blockedCalls: 1 },
  },
  {
    id: "e-commerce-app",
    name: "E-Commerce App",
    description:
      "Takes orders, answers buyers, and moves refunds through the payment tools.",
    agents: 8,
    traces: 31,
    authorizedCalls: 3120,
    deniedCalls: 9,
    fatalErrors: 3,
    minorErrors: 7,
    cognitiveFailures: 6,
    maliciousTraces: 2,
    tokens: 126000,
    costChange: -0.31,
    applied: { protocols: 0, blockedAgents: 1, blockedCalls: 0 },
  },
];

/**
 * How well the application is running, out of one. Everything that went
 * wrong is read against how much it ran: a run that stopped before
 * answering weighs heaviest, a cognitive failure next, a minor error least.
 * The score decays rather than subtracts, so a bad application lands low
 * without every bad application landing at nothing.
 */
export function performanceOf(app: ConsoleApp): number {
  const traces = Math.max(app.traces, 1);
  const trouble =
    (app.fatalErrors * 3 + app.cognitiveFailures * 1.5 + app.minorErrors) /
    traces;
  return 1 / (1 + trouble);
}

/**
 * How well it is holding against being pushed at: a trace an investigation
 * called malicious weighs heaviest, refused calls count against the traffic
 * they sit in.
 */
export function securityOf(app: ConsoleApp): number {
  const traces = Math.max(app.traces, 1);
  const calls = Math.max(app.authorizedCalls + app.deniedCalls, 1);
  const risk =
    (app.maliciousTraces * 4) / traces + (app.deniedCalls / calls) * 10;
  return 1 / (1 + risk);
}

/** The two angles, read as one figure. */
export function healthOf(app: ConsoleApp): number {
  return (performanceOf(app) + securityOf(app)) / 2;
}

/** 1240 reads as 1.2k, which is what a card has the room for. */
export function compact(value: number): string {
  if (value < 1000) {
    return `${value}`;
  }
  if (value < 1000000) {
    const thousands = value / 1000;
    return `${thousands >= 10 ? Math.round(thousands) : thousands.toFixed(1)}k`;
  }
  return `${(value / 1000000).toFixed(1)}M`;
}
