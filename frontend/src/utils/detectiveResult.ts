import type { AttackResult } from "./investigationStore";

export interface DetectiveStage1 {
  summary?: string;
  reasoning?: string;
  classification?: string;
  hypotheses?: DetectiveHypothesis[];
}

export interface DetectiveHypothesis {
  step?: string | number;
  action?: string;
  intent?: string;
  anomalies?: string[];
  confidence?: string | number;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asAnomalies(value: unknown): string[] | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? [trimmed] : [];
  }
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value
    .map((item) => {
      if (typeof item === "string") {
        return item.trim();
      }
      const row = asRecord(item);
      return (
        asString(row?.text) ??
        asString(row?.anomaly) ??
        asString(row?.description) ??
        asString(row?.message) ??
        ""
      );
    })
    .filter((item) => item.length > 0);
}

function asHypothesis(value: unknown): DetectiveHypothesis | null {
  const row = asRecord(value);
  if (!row) {
    return null;
  }
  return {
    step:
      typeof row.step === "number" || typeof row.step === "string"
        ? row.step
        : typeof row.trace_step === "number" || typeof row.trace_step === "string"
          ? row.trace_step
          : undefined,
    action: asString(row.action) ?? asString(row.excerpt) ?? asString(row.pattern),
    intent: asString(row.intent) ?? asString(row.relevance) ?? asString(row.description),
    anomalies: asAnomalies(row.anomalies),
    confidence:
      typeof row.confidence === "number" || typeof row.confidence === "string"
        ? row.confidence
        : undefined,
  };
}

export function extractStage1(result: unknown): DetectiveStage1 | null {
  const parsed = asRecord(result);
  if (!parsed) {
    return null;
  }
  const extra = asRecord(parsed.extra);
  const judgement = asRecord(extra?.evoguard_judgement) ?? asRecord(parsed.evoguard_judgement);
  const nested = asRecord(judgement?.stage1) ?? judgement;
  if (!nested) {
    return null;
  }
  const hypotheses = Array.isArray(nested.hypotheses)
    ? nested.hypotheses
        .map(asHypothesis)
        .filter((item): item is DetectiveHypothesis => item !== null)
    : undefined;
  const summary = asString(nested.summary);
  const reasoning = asString(nested.reasoning);
  const classification = asString(nested.classification);
  if (!summary && !reasoning && !hypotheses?.length) {
    return null;
  }
  return { summary, reasoning, classification, hypotheses };
}

export function padConversationStep(step: string | number | undefined): string | undefined {
  const numeric = Number(step);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return undefined;
  }
  return `[${String(Math.trunc(numeric)).padStart(3, "0")}]`;
}

export function formatConfidencePercent(value: unknown): string | null {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  const percent = numeric <= 1 ? numeric * 100 : numeric;
  const rounded = Math.round(percent);
  if (rounded < 0 || rounded > 100) {
    return null;
  }
  return `${rounded}%`;
}

function adaptHypothesisList(hypotheses: DetectiveHypothesis[]): AttackResult[] {
  return hypotheses.map((hypothesis, index) => {
    const action = hypothesis.action?.trim() || `Finding ${index + 1}`;
    const intent = hypothesis.intent?.trim() ?? "";
    const anomalies = hypothesis.anomalies ?? [];
    const stepToken = padConversationStep(hypothesis.step);
    const confidenceRaw = Number(hypothesis.confidence);
    const confidence = Number.isFinite(confidenceRaw) ? confidenceRaw : undefined;
    return {
      id: String(index),
      type: "Finding",
      step: hypothesis.step,
      pattern: action,
      description: [intent, ...anomalies].filter(Boolean).join(" "),
      excerpt: action,
      relevance: intent,
      anomalies,
      confidence,
      where: stepToken ? `Step ${stepToken}` : undefined,
      severity: (anomalies.length > 0 ? "high" : "medium") as AttackResult["severity"],
    };
  });
}

export function adaptDetectiveEvidence(evidence: unknown[] | undefined): AttackResult[] {
  const fromEvidence: DetectiveHypothesis[] = [];
  const evidenceLabels: Array<0 | 1 | undefined> = [];
  for (const rawItem of evidence ?? []) {
    const item = asHypothesis(rawItem);
    if (!item || (!item.action && !item.intent)) {
      continue;
    }
    const benign = asRecord(rawItem)?.benign;
    fromEvidence.push(item);
    evidenceLabels.push(benign === 0 || benign === 1 ? benign : undefined);
  }
  if (fromEvidence.length > 0) {
    return adaptHypothesisList(fromEvidence).map((item, index) => {
      const benign = evidenceLabels[index];
      return benign === undefined ? item : { ...item, benign };
    });
  }
  return [];
}
