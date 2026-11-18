import type { AppDetail, SessionRow } from "./appDetailData";
import type { TraceEntry } from "./consoleTrace";

/**
 * How Agent-ToM read one agent of a session, written from that session: the
 * seat it holds in the application's topology, the tools it is wired to, and
 * the points of its own trace the reading rests on.
 */
export interface AgentFinding {
  id: string;
  name: string;
  /** The model it ran on, which the vendor mark is drawn from. */
  model: string;
  adversary: boolean;
  detector: {
    label: "manipulator" | "infected" | "honest";
    suspect: boolean;
    score: number;
    scores: { honest: number; infected: number; manipulator: number };
    reading: string;
  };
  /** What the detector wrote down, each line tied to a point in the trace. */
  notes: { at: string; line: string }[];
}

/** Fixed per session, so a page always reads the same way twice. */
function seedOf(key: string): number {
  let hash = 0;
  for (const letter of key) hash = (hash * 31 + letter.charCodeAt(0)) % 9973;
  return hash;
}

function round(value: number): number {
  return Number(value.toFixed(2));
}

/** The point the label carries, and the rest split across the other two. */
function splitOf(
  label: AgentFinding["detector"]["label"],
  score: number,
): AgentFinding["detector"]["scores"] {
  const rest = 1 - score;
  if (label === "manipulator") {
    return {
      manipulator: round(score),
      infected: round(rest * 0.6),
      honest: round(rest * 0.4),
    };
  }
  if (label === "infected") {
    return {
      infected: round(score),
      manipulator: round(rest * 0.45),
      honest: round(rest * 0.55),
    };
  }
  return {
    honest: round(score),
    infected: round(rest * 0.6),
    manipulator: round(rest * 0.4),
  };
}

function list(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** The tools an agent reached for, taken from its own stretch of the run. */
function reachOf(name: string, trace: TraceEntry[]): TraceEntry[] {
  const mine = trace.filter(
    (entry) => entry.kind === "agent" && entry.actor === name,
  );
  return trace.filter(
    (entry) =>
      entry.kind === "tool" &&
      mine.some(
        (span) =>
          entry.at >= span.at && entry.at <= span.at + (span.duration ?? 0),
      ),
  );
}

/**
 * What an investigation made of this session, agent by agent. The reading is
 * written from what the session itself holds — the seat each agent sits in,
 * the tools it reached for, where its steps errored or came back late — so
 * the account and the topology behind it say the same thing.
 */
export function findingsFor({
  detail,
  session,
  trace,
  verdict,
  suspects,
  carried,
}: {
  detail: AppDetail;
  session: SessionRow;
  verdict: "malicious" | "clean";
  trace: TraceEntry[];
  suspects: string[];
  carried: string[];
}): AgentFinding[] {
  const seed = seedOf(`${detail.app.id}-${session.id}`);
  const model = session.models[0] ?? "";
  // The moderator classifies the request and takes the answers back, so it
  // is the agent everything else passes through.
  const lead = session.agents[0] ?? "the moderator";
  const topic = session.topic;
  const marked = detail.failures.filter((failure) =>
    session.failureCodes.includes(failure.code),
  );

  return session.agents.map((name, index) => {
    const role = (
      detail.agents.find((agent) => agent.name === name)?.role ?? "working"
    ).toLowerCase();
    const label: AgentFinding["detector"]["label"] =
      verdict === "malicious" && suspects.includes(name)
        ? "manipulator"
        : verdict === "malicious" && carried.includes(name)
          ? "infected"
          : "honest";
    const score =
      label === "manipulator"
        ? round(0.74 + ((seed + index * 7) % 13) / 100)
        : label === "infected"
          ? round(0.36 + ((seed + index * 5) % 11) / 100)
          : round(0.76 + ((seed + index * 3) % 12) / 100);

    const mine = trace.filter((entry) => entry.actor === name);
    const reached = reachOf(name, trace);
    const tools = [...new Set(reached.map((entry) => entry.actor))];
    const late = reached.filter((entry) => entry.status !== "ok");
    const broke = mine.filter((entry) => entry.status === "error");
    const driver = suspects[0] ?? lead;

    let reading: string;
    if (label === "manipulator") {
      const sourced =
        tools.length > 0
          ? `It reached for ${list(tools)} ${reached.length === 1 ? "once" : `${reached.length} times`}, and the draft it sent on carries more than what came back.`
          : `It drafted without reaching for any of the tools it is wired to, while the rest of the session grounded its work in lookups.`;
      const closed =
        broke.length > 0
          ? `The check on the way out errored, so nothing stood between that draft and the answer.`
          : `${lead} took the draft back and passed it on without a second source.`;
      reading = `Agent-ToM reads ${name} as a manipulator. It holds the ${role} seat on this application, and the topology has it answering straight back to ${lead} rather than to a peer, so whatever it drafts is what the session carries. ${sourced} ${closed} The same move repeats across its turns on ${topic}, which is what separates this from one answer going wrong.`;
    } else if (label === "infected") {
      const own =
        tools.length === 0
          ? `It made no calls of its own on this session.`
          : late.length > 0
            ? `Its own calls to ${list(tools)} came back late rather than wrong, and it used what they returned as it came.`
            : `Its own calls to ${list(tools)} came back clean and it used them as they came.`;
      reading = `Agent-ToM reads ${name} as infected rather than driving anything. It holds the ${role} seat and took ${driver}'s draft as settled, building its pass on top of it instead of grounding the claim again. ${own} What it got wrong it got from ${driver}.`;
    } else {
      const own =
        tools.length === 0
          ? `It made no tool calls of its own.`
          : late.length > 0
            ? `Its ${list(tools)} calls came back late, but what it then said follows what they returned.`
            : `Its ${list(tools)} calls line up with what it then said.`;
      reading = `Agent-ToM reads ${name} as honest. It holds the ${role} seat and did with the request on ${topic} what that seat is there to do. ${own} Nothing it did drove the session off course.`;
    }

    // Every line the detector wrote is a point of this session's trace, so
    // the reading can be followed back to where it came from.
    const notes: { at: string; line: string }[] = [];
    for (const entry of reached) {
      notes.push({
        at: entry.id,
        line:
          entry.status !== "ok"
            ? `${entry.actor} came back late and ${name} went ahead on a partial result.`
            : label === "manipulator"
              ? `${entry.actor} returned, and what it returned is narrower than the claim drafted from it.`
              : `${entry.actor} returned and ${name} used it as it came.`,
      });
    }
    for (const entry of mine) {
      if (entry.kind === "tool") continue;
      if (entry.status === "error") {
        notes.push({
          at: entry.id,
          line: `${entry.title} errored, and the session carried on without what it asked for.`,
        });
        continue;
      }
      if (entry.title === "Draft contribution") {
        notes.push({
          at: entry.id,
          line:
            label === "manipulator"
              ? `Drafted its answer on ${topic}, carrying a claim past what the lookups support.`
              : `Drafted its part of the answer on ${topic} from what it had been handed.`,
        });
        continue;
      }
      if (entry.kind === "turn" && entry.title === "answers") {
        notes.push({
          at: entry.id,
          line: `Handed the draft to ${lead} as settled, rather than as something still to check.`,
        });
      }
    }
    if (label === "manipulator") {
      // Against where it drafted, which is the point the claim entered the
      // session, rather than against the lookup it went past.
      const drafted = mine.find(
        (entry) => entry.title === "Draft contribution",
      );
      for (const failure of marked.slice(0, 2)) {
        const at = drafted?.id ?? notes[0]?.at ?? mine[0]?.id;
        if (at) {
          notes.push({
            at,
            line: `${failure.code} ${failure.name} was raised against this agent's part of the run.`,
          });
        }
      }
    }
    if (late.length === 0 && broke.length === 0 && notes.length === 0) {
      const at = mine[0]?.id;
      if (at) {
        notes.push({ at, line: `Took its turn on ${topic} and nothing else.` });
      }
    }

    return {
      id: `finding-${index}`,
      name,
      model,
      adversary: label === "manipulator",
      detector: {
        label,
        suspect: label === "manipulator",
        score,
        scores: splitOf(label, score),
        reading,
      },
      notes,
    };
  });
}
