import type { SessionRow } from "./appDetailData";

export interface TraceEntry {
  id: string;
  at: number;
  kind: "turn" | "agent" | "llm" | "tool";
  actor: string;
  title: string;
  body?: string;
  duration?: number;
  status: "error" | "warn" | "ok";
}

/** The run itself, turns and spans in the order they happened. */
export function traceOf(session: SessionRow): TraceEntry[] {
  const end = session.timeline.reduce(
    (last, span) => Math.max(last, span.start + span.duration),
    1,
  );
  const spoken: TraceEntry[] = session.turns.map((turn, index) => ({
    id: `trace-turn-${index}`,
    // The question opens the run, the rest fall where the work got to.
    at: (index / Math.max(session.turns.length - 1, 1)) * end,
    kind: "turn",
    actor: turn.actor,
    title: turn.role,
    body: turn.text,
    status: "ok",
  }));
  const worked: TraceEntry[] = session.timeline.map((span, index) => ({
    id: `trace-span-${index}`,
    at: span.start,
    kind: span.kind,
    actor: span.actor,
    title: span.name,
    body:
      span.status === "error"
        ? `${span.name} was called and came back an error after ${span.duration} ms. The session carried on without what it asked for.`
        : span.status === "warn"
          ? `${span.name} answered in ${span.duration} ms, late enough that the step after it went ahead on a partial result.`
          : `${span.name} answered in ${span.duration} ms and the result was taken into the draft.`,
    duration: span.duration,
    status: span.status,
  }));
  return [...spoken, ...worked].sort((left, right) => left.at - right.at);
}
