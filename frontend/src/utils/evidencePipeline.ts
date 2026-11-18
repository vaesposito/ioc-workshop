import type { AttackResult } from "./investigationStore";

export interface PipelineEvidence extends AttackResult {
  stageTitle: string;
}

export interface EvidenceDisplay {
  title: string;
  where: string | null;
}

const STEP_TITLE_PREFIX_RE =
  /^(Steps?\s+)(\[\d{3,}\](?:\s*(?:[–—\-\/])\s*\[\d{3,}\])*)\s*[—–-]\s+/i;
const STEP_SPAN_RE = /\[(\d{3,})\](?:\s*[–—-]\s*\[(\d{3,})\])?/g;
const BARE_STEP_RE = /\bSteps?\s+(\d{1,4})\b/i;
const LEADING_STEP_TOKEN_RE = /^(?:Steps?\s+)?\[\d{1,4}\]\s*(?:[—–-]\s*)?/i;
const STEP_PAREN_RE =
  /\s*\(\s*Steps?\s+(?:\[\d{1,4}\]|\d{1,4})(?:\s*[–—\-/,&]\s*(?:\[\d{1,4}\]|\d{1,4}))*\s*\)/gi;

export function evidenceElementId(id: string): string {
  return `evidence-${id}`;
}

export function startUppercase(text: string): string {
  const chars = [...text];
  const index = chars.findIndex((ch) => /\p{L}/u.test(ch));
  if (index < 0) {
    return text;
  }
  chars[index] = chars[index].toLocaleUpperCase();
  return chars.join("");
}

export function cleanEvidenceTitle(text: string): string {
  const stripped = text
    .replace(LEADING_STEP_TOKEN_RE, "")
    .replace(STEP_PAREN_RE, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .trim();
  return stripped || text.trim();
}

function formatWhereSpans(text: string): string | null {
  const spans: string[] = [];
  STEP_SPAN_RE.lastIndex = 0;
  for (const match of text.matchAll(STEP_SPAN_RE)) {
    const span = match[2] ? `[${match[1]}]–[${match[2]}]` : `[${match[1]}]`;
    if (!spans.includes(span)) {
      spans.push(span);
    }
    if (spans.length >= 4) {
      break;
    }
  }
  if (spans.length === 0) {
    return null;
  }
  return spans.join(" / ");
}

export function parseEvidenceDisplay(
  item: Pick<
    PipelineEvidence,
    "pattern" | "excerpt" | "stageTitle" | "type" | "where" | "step"
  >,
): EvidenceDisplay {
  const raw =
    item.excerpt?.trim() ||
    item.pattern?.trim() ||
    item.stageTitle?.trim() ||
    item.type ||
    "Evidence";
  const title = startUppercase(cleanEvidenceTitle(raw));
  if (item.where?.trim()) {
    return { title, where: item.where.trim() };
  }
  if (item.step !== undefined && item.step !== null && String(item.step).trim()) {
    return { title, where: `Step [${String(item.step).padStart(3, "0")}]` };
  }
  const prefixed = raw.match(STEP_TITLE_PREFIX_RE);
  if (prefixed) {
    const where = `${prefixed[1]}${prefixed[2]}`.replace(/\s+/g, " ").trim();
    const fromPrefix = raw.slice(prefixed[0].length).trim();
    return {
      title: startUppercase(cleanEvidenceTitle(fromPrefix || raw)),
      where,
    };
  }
  const fromBrackets = formatWhereSpans(
    `${item.pattern ?? ""}\n${item.excerpt ?? ""}`,
  );
  if (fromBrackets) {
    return { title, where: fromBrackets };
  }
  const bare = `${item.pattern ?? ""} ${item.excerpt ?? ""}`.match(BARE_STEP_RE);
  return {
    title,
    where: bare?.[1]
      ? `Step [${bare[1].padStart(3, "0")}]`
      : null,
  };
}

export function buildEvidencePipeline(options: {
  evidence: AttackResult[];
}): PipelineEvidence[] {
  return options.evidence.map((item) => ({
    ...item,
    stageTitle: item.pattern?.trim() || item.type || "Finding",
  }));
}
