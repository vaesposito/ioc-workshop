import type { TraceManagerRow } from "./api";
import type { Application } from "./applicationStore";
import type { Investigation } from "./investigationStore";
import { getApplicationCopy } from "../content/application-copy";
import { getApplicationToolCount } from "./toolManifest";

export type AppHealth = "suspicious" | "healthy" | "unanalyzed";
export type AppCriticality = "high" | "medium" | "low";
export type IssueSeverity = "critical" | "high" | "medium" | "low";

export interface IssueSeverityCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export const EMPTY_ISSUE_COUNTS: IssueSeverityCounts = {
  critical: 0,
  high: 0,
  medium: 0,
  low: 0,
};

export interface AppPortfolioStats {
  totalTraces: number;
  analyzedTraces: number;
  suspiciousTraces: number;
  healthyTraces: number;
  pendingTraces: number;
  health: AppHealth;
  criticality: AppCriticality;
}

export function getApplicationInventory(
  app: Pick<Application, "id" | "name">,
): {
  tools: number;
  agents: number;
} {
  return { tools: getApplicationToolCount(app), agents: 1 };
}

export function getApplicationPurpose(app: Application): {
  purpose: string;
  shortDescription: string;
} {
  const copy = getApplicationCopy(app);
  if (copy) {
    return { purpose: copy.purpose, shortDescription: copy.shortDescription };
  }

  const description = app.description?.trim();
  if (description && description.length > 0) {
    return {
      shortDescription: description,
      purpose: description,
    };
  }

  return {
    shortDescription: "Agentic application under Detective monitoring.",
    purpose:
      "Detective inspects this application's traces for contradictions between inferred intent and observed actions.",
  };
}

export function investigationReportPath(
  trace: TraceManagerRow,
): string | null {
  return trace.latestInvestigationId
    ? `/investigations/${trace.latestInvestigationId}`
    : null;
}

export function isAnalyzedTrace(trace: TraceManagerRow): boolean {
  return (
    trace.investigationsCount > 0 &&
    (trace.latestStatus === "completed" ||
      trace.latestStatus === "failed" ||
      trace.latestLabel !== null)
  );
}

export function traceHasInvestigation(trace: TraceManagerRow): boolean {
  return (
    trace.investigationsCount > 0 ||
    Boolean(trace.latestInvestigationId) ||
    trace.latestStatus != null
  );
}

export function isSuspiciousTrace(trace: TraceManagerRow): boolean {
  return trace.latestLabel === "malicious";
}

export function isHealthyTrace(trace: TraceManagerRow): boolean {
  return isAnalyzedTrace(trace) && trace.latestLabel === "benign";
}

export function getAppPortfolioStats(
  traces: TraceManagerRow[],
): AppPortfolioStats {
  const totalTraces = traces.length;
  const suspiciousTraces = traces.filter(isSuspiciousTrace).length;
  const healthyTraces = traces.filter(isHealthyTrace).length;
  const pendingTraces = traces.filter(
    (trace) =>
      trace.latestStatus === "pending" || trace.latestStatus === "started",
  ).length;
  const analyzedTraces = traces.filter(isAnalyzedTrace).length;
  const health: AppHealth =
    suspiciousTraces > 0
      ? "suspicious"
      : healthyTraces > 0
        ? "healthy"
        : "unanalyzed";
  const criticality: AppCriticality =
    suspiciousTraces >= 5 ? "high" : suspiciousTraces >= 1 ? "medium" : "low";

  return {
    totalTraces,
    analyzedTraces,
    suspiciousTraces,
    healthyTraces,
    pendingTraces,
    health,
    criticality,
  };
}

export function formatTraceDate(timestampMs: number | null | undefined): string {
  if (!timestampMs || !Number.isFinite(timestampMs)) {
    return "—";
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestampMs);
}

// Display-only: drops the malicious_/benign_ label and the .json extension.
// The underlying filenames/traceName values are left unchanged.
export function formatTraceDisplayName(
  name: string | null | undefined,
): string {
  if (!name) {
    return "";
  }
  return name
    .replace(/^evoguard\s*[·-]\s*/i, "")
    .replace(/\bcalendar\b/g, "Calendar")
    .replace(/(?:malicious|benign)_/gi, "")
    .replace(/\.json\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const SHUFFLE_SEED_KEY = "detective:trace-shuffle-seed:v1";

// One trace order per demo session: kept across navigation and reloads, renewed by "Reset demo".
export function demoShuffleSeed(): string {
  try {
    const stored = localStorage.getItem(SHUFFLE_SEED_KEY);
    if (stored) {
      return stored;
    }
    const seed = Math.random().toString(36).slice(2);
    localStorage.setItem(SHUFFLE_SEED_KEY, seed);
    return seed;
  } catch {
    return "demo";
  }
}

export function resetDemoShuffleSeed(): void {
  try {
    localStorage.removeItem(SHUFFLE_SEED_KEY);
  } catch {
    // Storage unavailable: the fallback seed is fixed anyway.
  }
}

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// Deterministic shuffle: given the same seed and keys it always returns the same
// order, so react-query refetches don't reshuffle the list mid-session.
export function seededShuffle<T>(
  items: readonly T[],
  keyOf: (item: T) => string,
  seed: string,
): T[] {
  return [...items].sort(
    (left, right) =>
      hashSeed(`${seed}:${keyOf(left)}`) - hashSeed(`${seed}:${keyOf(right)}`),
  );
}

export function detectionStatusLabel(trace: TraceManagerRow): string {
  if (trace.latestStatus === "pending" || trace.latestStatus === "started") {
    return "Running";
  }
  if (trace.latestStatus === "failed") {
    return "Failed";
  }
  if (trace.investigationsCount === 0) {
    return "Not analyzed";
  }
  if (trace.latestStatus === "completed" || trace.latestLabel) {
    return "Completed";
  }
  return "Analyzed";
}

export function issueCountTotal(counts: IssueSeverityCounts): number {
  return counts.critical + counts.high + counts.medium + counts.low;
}

export function highestIssueSeverity(
  counts: IssueSeverityCounts,
): IssueSeverity | null {
  if (counts.critical > 0) {
    return "critical";
  }
  if (counts.high > 0) {
    return "high";
  }
  if (counts.medium > 0) {
    return "medium";
  }
  if (counts.low > 0) {
    return "low";
  }
  return null;
}

export function getTraceIssueCounts(
  investigation: Investigation | undefined,
  trace: TraceManagerRow,
): IssueSeverityCounts {
  const counts: IssueSeverityCounts = { ...EMPTY_ISSUE_COUNTS };

  if (investigation) {
    if (investigation.verdict !== "malicious") {
      return counts;
    }
    if (investigation.results.length === 0) {
      counts.medium = 1;
      return counts;
    }
    for (const result of investigation.results) {
      counts[result.severity] += 1;
    }
    return counts;
  }

  if (isSuspiciousTrace(trace)) {
    counts.medium = 1;
  }
  return counts;
}

export function getAppIssueCounts(
  investigations: Investigation[],
  traces: TraceManagerRow[],
): IssueSeverityCounts {
  const totals: IssueSeverityCounts = { ...EMPTY_ISSUE_COUNTS };
  for (const trace of traces) {
    const completed = getLatestCompletedInvestigation(
      investigations,
      trace.traceFileId,
    );
    const next = getTraceIssueCounts(completed, trace);
    totals.critical += next.critical;
    totals.high += next.high;
    totals.medium += next.medium;
    totals.low += next.low;
  }
  return totals;
}

export function getInvestigationIssueCounts(
  investigation: Investigation,
): IssueSeverityCounts {
  const counts: IssueSeverityCounts = { ...EMPTY_ISSUE_COUNTS };
  for (const result of investigation.results) {
    const severity = result.severity;
    if (severity in counts) {
      counts[severity] += 1;
    } else {
      counts.medium += 1;
    }
  }
  return counts;
}

export function getInvestigationsForTrace(
  investigations: Investigation[],
  traceFileId: string,
): Investigation[] {
  return investigations
    .filter((investigation) => investigation.traceFileId === traceFileId)
    .sort(
      (left, right) =>
        (right.completedAt ?? right.createdAt) -
        (left.completedAt ?? left.createdAt),
    );
}

export function getLatestCompletedInvestigation(
  investigations: Investigation[],
  traceFileId: string,
): Investigation | undefined {
  return getInvestigationsForTrace(investigations, traceFileId).find(
    (investigation) => investigation.status === "completed",
  );
}
