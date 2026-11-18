/** Whatever the reader has their finger on, anywhere on the page. */
export interface ConsolePick {
  kind: "agent" | "tool" | "topic" | "failure" | "step" | "protocol" | "metric";
  /** Unique within its kind, so the same thing can be lit in two places. */
  id: string;
  /** Said back to the reader above the traces. */
  label: string;
}

export interface Pickable {
  pick?: ConsolePick | null;
  onPick?: (pick: ConsolePick) => void;
}

/** True where this is the thing currently picked. */
export function isPicked(
  pick: ConsolePick | null | undefined,
  kind: ConsolePick["kind"],
  id: string,
): boolean {
  return Boolean(pick && pick.kind === kind && pick.id === id);
}

/** True where this run touched whatever is picked on the page. */
export function touches(
  session: {
    topic: string;
    agents: string[];
    models: string[];
    tools: string[];
    failureCodes: string[];
    steps: string[];
    protocols: string[];
    weakMetrics: string[];
    id: string;
  },
  pick: ConsolePick | null,
  /** Written-up failures, so picking one row lights the run it came from. */
  insights: { id: string; session: string }[] = [],
): boolean {
  if (!pick) return false;
  switch (pick.kind) {
    case "topic":
      return session.topic === pick.id;
    case "agent":
      return (
        session.agents.includes(pick.id) || session.models.includes(pick.id)
      );
    case "tool":
      return session.tools.includes(pick.id);
    case "step":
      return session.steps.includes(pick.id);
    case "protocol":
      // A locked term is picked as "ACCORD:config_reload".
      return session.protocols.includes(pick.id.split(":")[0]);
    case "metric":
      return (
        session.weakMetrics.includes(pick.id) ||
        session.protocols.includes(pick.id.split(":")[0])
      );
    case "failure":
      if (session.failureCodes.includes(pick.id)) return true;
      return insights.some(
        (insight) => insight.id === pick.id && insight.session === session.id,
      );
    default:
      return false;
  }
}
