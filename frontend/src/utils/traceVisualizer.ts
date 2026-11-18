import type { TraceConversationTurn } from "./api";
import type { AttackResult, ConversationTurn } from "./investigationStore";
import { decodeTraceEscapes, stripEmoji } from "./decodeEscapes";

export type VisualizerKind =
  | "user"
  | "assistant"
  | "reasoning"
  | "tool_call"
  | "tool_result";

export interface HighlightRange {
  evidenceId: string;
  start: number;
  end: number;
}

export interface ObservationStepReference {
  start: number;
  end: number;
  step: number;
}

export interface VisualizerEvent {
  id: string;
  index: number;
  kind: VisualizerKind;
  title: string;
  text: string;
  toolNames: string[];
  sourceIndex: number;
  /** On a tool call: the conversation turn holding its result. */
  resultSourceIndex?: number;
  /** A tool result whose response was empty in the trace. */
  empty?: boolean;
  /** A tool call with no result turn in the trace. */
  unanswered?: boolean;
  highlighted: boolean;
  matchedEvidenceIds: string[];
  highlights: HighlightRange[];
}

export type ChatCluster =
  | { key: string; variant: "user"; event: VisualizerEvent }
  | {
      key: string;
      variant: "agent";
      event: VisualizerEvent | null;
      actions: VisualizerEvent[];
    };

const THINKING_RE =
  /<model_thinking>([\s\S]*?)<\/model_thinking>/gi;
const STEP_INDEX_RE = /\[(\d{3,})\]/g;
const MIN_NEEDLE = 8;
const FALLBACK_EXCERPTS = new Set([
  "no conversational excerpt was available in this trace.",
  "trace contents were not available for mock analysis.",
]);
const RISK_MARKERS = [
  "successfully transferred",
  "transfer_bank_to_venmo",
  "transfer_bank_to_zelle",
  "send_money",
  "unauthorized transfer",
];

function asText(value: unknown): string {
  if (typeof value === "string") {
    return stripEmoji(decodeTraceEscapes(value));
  }
  if (value == null) {
    return "";
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function collapseMap(text: string): { normalized: string; map: number[] } {
  let normalized = "";
  const map: number[] = [];
  let prevSpace = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (/\s/.test(char)) {
      if (!prevSpace && normalized.length > 0) {
        normalized += " ";
        map.push(i);
      }
      prevSpace = true;
      continue;
    }
    prevSpace = false;
    normalized += char.toLowerCase();
    map.push(i);
  }
  return { normalized, map };
}

function isWordChar(char: string | undefined): boolean {
  return Boolean(char) && /[A-Za-z0-9]/.test(char as string);
}

function expandToWordBounds(
  text: string,
  start: number,
  end: number,
): HighlightRange {
  let from = Math.max(0, start);
  let to = Math.min(text.length, end);
  while (from > 0 && isWordChar(text[from]) && isWordChar(text[from - 1])) {
    from -= 1;
  }
  while (to < text.length && isWordChar(text[to - 1]) && isWordChar(text[to])) {
    to += 1;
  }
  return { evidenceId: "", start: from, end: to };
}

export function findHighlightRange(
  haystack: string,
  needle: string,
): HighlightRange | null {
  const trimmed = needle.trim();
  if (trimmed.length < MIN_NEEDLE) {
    return null;
  }

  const direct = haystack.toLowerCase().indexOf(trimmed.toLowerCase());
  if (direct >= 0) {
    return expandToWordBounds(haystack, direct, direct + trimmed.length);
  }

  const hay = collapseMap(haystack);
  const prefixes = [collapseMap(trimmed).normalized];
  if (prefixes[0].length > 80) {
    prefixes.push(prefixes[0].slice(0, 160), prefixes[0].slice(0, 80));
  }

  for (const prefix of prefixes) {
    if (prefix.length < MIN_NEEDLE) {
      continue;
    }
    const idx = hay.normalized.indexOf(prefix);
    if (idx < 0 || hay.map.length === 0) {
      continue;
    }
    const start = hay.map[idx];
    const endIndex = Math.min(idx + prefix.length - 1, hay.map.length - 1);
    const end = hay.map[endIndex] + 1;
    if (end > start) {
      return expandToWordBounds(haystack, start, end);
    }
  }
  return null;
}

export function parseToolNames(raw: unknown): string[] {
  if (!raw) {
    return [];
  }
  if (Array.isArray(raw)) {
    return raw.flatMap((item) => {
      if (typeof item === "string") {
        return item.trim() ? [item.trim()] : [];
      }
      if (item && typeof item === "object") {
        const record = item as { name?: unknown; function?: { name?: unknown } };
        const name =
          typeof record.name === "string"
            ? record.name
            : typeof record.function?.name === "string"
              ? record.function.name
              : "";
        return name ? [name] : [];
      }
      return [];
    });
  }
  if (typeof raw === "string") {
    return raw
      .split("\n")
      .map((line) =>
        line.replace(/^[-*]\s*/, "").replace(/^Tool calls:\s*/i, "").trim(),
      )
      .filter((line) => /^[a-zA-Z][a-zA-Z0-9_]*$/.test(line));
  }
  return [];
}

function splitReasoning(content: string): { reasoning: string; visible: string } {
  const reasoningParts: string[] = [];
  const visible = content.replace(THINKING_RE, (_match, inner: string) => {
    reasoningParts.push(inner.trim());
    return "";
  });
  return {
    reasoning: reasoningParts.join("\n\n").trim(),
    visible: visible.replace(/^\s+/, "").trim(),
  };
}

function usableNeedle(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const trimmed = value.trim();
  return trimmed.length >= MIN_NEEDLE && !FALLBACK_EXCERPTS.has(trimmed.toLowerCase());
}

export function parseConversationSteps(
  ...sources: Array<string | null | undefined>
): number[] {
  const found: number[] = [];
  const seen = new Set<number>();
  for (const source of sources) {
    if (!source) {
      continue;
    }
    STEP_INDEX_RE.lastIndex = 0;
    for (const match of source.matchAll(STEP_INDEX_RE)) {
      const index = Number(match[1]);
      if (!Number.isInteger(index) || seen.has(index)) {
        continue;
      }
      seen.add(index);
      found.push(index);
    }
  }
  return found;
}

function parseEvidenceStep(step: AttackResult["step"]): number | undefined {
  if (typeof step === "number" && Number.isInteger(step) && step >= 0) {
    return step;
  }
  if (typeof step === "string" && /^\d+$/.test(step.trim())) {
    const parsed = Number(step.trim());
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
  }
  return undefined;
}

export function parseObservationStepReferences(
  observation: string,
): ObservationStepReference[] {
  const references: ObservationStepReference[] = [];
  // Also lists such as "steps 140, 146" and "steps 230→234": one link per number.
  const pattern = /\bsteps?\s+#?\d+(?:\s*(?:,|and|→|->|–|-)\s*\d+)*/gi;
  for (const match of observation.matchAll(pattern)) {
    let first = true;
    for (const number of match[0].matchAll(/\d+/g)) {
      const numberStart = match.index + (number.index ?? 0);
      references.push({
        start: first ? match.index : numberStart,
        end: numberStart + number[0].length,
        step: Number(number[0]),
      });
      first = false;
    }
  }
  return references;
}

function uniqueNeedles(values: string[]): string[] {
  const seen = new Set<string>();
  const needles: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (seen.has(key) || !usableNeedle(value)) {
      continue;
    }
    seen.add(key);
    needles.push(value);
  }
  return needles;
}

function expandStepIndexes(indexes: number[]): number[] {
  const found: number[] = [];
  const seen = new Set<number>();
  for (const index of indexes) {
    for (const candidate of [index, index - 1]) {
      if (!Number.isInteger(candidate) || candidate < 0 || seen.has(candidate)) {
        continue;
      }
      seen.add(candidate);
      found.push(candidate);
    }
  }
  return found;
}

// The detector emits `step` as a 0-based index into the conversation, so an
// explicit step is authoritative. Only guess when it is missing.
function resolveStepIndexes(
  evidenceStep: number | undefined,
  parsed: number[],
): number[] {
  if (evidenceStep !== undefined) {
    return [evidenceStep];
  }
  return expandStepIndexes(parsed);
}

const SECRET_VALUE_RE =
  /\b(?:sk_(?:live|test)_[A-Za-z0-9]{8,}|AKIA[A-Z0-9]{12,}|mongodb\+srv:\/\/[^\s"']+)/g;
const SECRET_TALK_RE = /secret|credential|api key|password|sensitive/i;

// Secrets with a fixed shape (a subset of the gitleaks/trufflehog rules).
const SECRET_FORMATS: RegExp[] = [
  /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{8,}/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\b(?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql|redis|amqp):\/\/[^\s:@/"']+:[^\s@"']+@[^\s"',]+/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
];
// The value after a label: "Datadog API Key: 8c3a7ff9d4b3e2a1", "'Passport Number': 'HGK137803'".
const LABELLED_VALUE_RE =
  /\b(?:api[ _-]?key|secret|token|password|passwd|credentials?|passport(?: number)?|bank account(?: number)?|account number|credit card(?: number)?|card number|id number|ssn|iban)['"]?\s*[:=]\s*['"]?([A-Za-z0-9][A-Za-z0-9_\-+/=.]{5,}[A-Za-z0-9=])/gi;
const IBAN_RE = /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g;
const CARD_RE = /\b\d(?:[ -]?\d){12,18}\b/g;

function luhnValid(digits: string): boolean {
  let sum = 0;
  [...digits].reverse().forEach((char, index) => {
    let value = Number(char);
    if (index % 2 === 1) {
      value *= 2;
      if (value > 9) {
        value -= 9;
      }
    }
    sum += value;
  });
  return sum % 10 === 0;
}

/** Secret and personal values in `text`: known formats, labelled values, IBANs, Luhn-valid cards. */
function sensitiveValues(text: string): Array<{ start: number; end: number; value: string }> {
  const found: Array<{ start: number; end: number; value: string }> = [];
  for (const pattern of [...SECRET_FORMATS, IBAN_RE]) {
    for (const match of text.matchAll(pattern)) {
      found.push({ start: match.index, end: match.index + match[0].length, value: match[0] });
    }
  }
  for (const match of text.matchAll(LABELLED_VALUE_RE)) {
    const start = match.index + match[0].lastIndexOf(match[1]);
    found.push({ start, end: start + match[1].length, value: match[1] });
  }
  for (const match of text.matchAll(CARD_RE)) {
    const digits = match[0].replace(/\D/g, "");
    // Long ids and timestamps pass Luhn too: a card is grouped, or named just before.
    const looksLikeCard =
      /[ -]/.test(match[0]) || /card/i.test(text.slice(Math.max(0, match.index - 30), match.index));
    if ((digits.length === 15 || digits.length === 16) && looksLikeCard && luhnValid(digits)) {
      found.push({ start: match.index, end: match.index + match[0].length, value: match[0] });
    }
  }
  return found;
}

/**
 * Pieces of a known secret, rotated or cut (the "tracking" block that leaks
 * `4eC39HqL...` as `T1zdp7dc4eC39HqLyjWDarjt`): runs of 8+ letters/digits
 * found inside the secret written twice.
 */
function secretFragments(text: string, secrets: string[]): Array<{ start: number; end: number }> {
  const cores = secrets
    .map((secret) => secret.replace(/^(?:sk|pk|rk)_(?:live|test)_/, ""))
    .filter((core) => /^[A-Za-z0-9]{12,}$/.test(core));
  if (cores.length === 0) {
    return [];
  }
  const found: Array<{ start: number; end: number }> = [];
  for (const match of text.matchAll(/[A-Za-z0-9]{8,}/g)) {
    const run = match[0];
    if (!/\d/.test(run) && run.length < 12) {
      continue;
    }
    if (cores.some((core) => `${core}${core}`.includes(run))) {
      found.push({ start: match.index, end: match.index + run.length });
    }
  }
  return found;
}

interface HighlightContext {
  knownTools: ReadonlySet<string>;
  /** Secrets seen anywhere in the trace, to recognise their fragments elsewhere. */
  traceSecrets: string[];
}

function highlightContext(events: VisualizerEvent[]): HighlightContext {
  const traceSecrets = new Set<string>();
  for (const event of events) {
    for (const { value } of sensitiveValues(event.text)) {
      traceSecrets.add(value);
    }
  }
  return {
    knownTools: new Set(
      events.flatMap((event) => event.toolNames.map((name) => name.toLowerCase())),
    ),
    traceSecrets: [...traceSecrets],
  };
}
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH_DAY_RE =
  /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/gi;
const DAY_MONTH_RE =
  /\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/gi;
const ISO_DATE_RE = /\b\d{4}-(\d{2})-(\d{2})\b/g;

function observationText(item: AttackResult): string {
  return (item.anomalies ?? []).join(" ");
}

/** "May 16", "16th May", "2024-05-16" -> "-05-16", to find `2024-05-16` in the trace. */
function monthDays(text: string): string[] {
  const found: string[] = [];
  const add = (month: number, day: number) => {
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      found.push(`-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
    }
  };
  for (const match of text.matchAll(MONTH_DAY_RE)) {
    add(MONTHS.indexOf(match[1].toLowerCase()) + 1, Number(match[2]));
  }
  for (const match of text.matchAll(DAY_MONTH_RE)) {
    add(MONTHS.indexOf(match[2].toLowerCase()) + 1, Number(match[1]));
  }
  for (const match of text.matchAll(ISO_DATE_RE)) {
    add(Number(match[1]), Number(match[2]));
  }
  return [...new Set(found)];
}

// "files" -> "file", "contact" -> "conta": loose enough for "file listing", strict enough to tell "context".
function stem(part: string): string {
  return part.replace(/s$/, "").slice(0, 5);
}

/** The excerpt names `name` literally, or every meaningful part of it ("Search emails" -> `search_emails`). */
function toolMentioned(name: string, text: string): boolean {
  const lower = text.toLowerCase();
  if (lower.includes(name.toLowerCase())) {
    return true;
  }
  const parts = name.toLowerCase().split("_").filter((part) => part.length >= 4);
  const textWords = lower.match(/[a-z]{3,}/g) ?? [];
  return (
    parts.length >= 2 &&
    parts.every((part) => textWords.some((word) => word.startsWith(stem(part))))
  );
}

/**
 * For a step on a batch of parallel calls, the result the evidence is about:
 * among the calls the excerpt names (all of them if it names none), the one
 * whose name or result matches the observation best.
 */
function batchResultForExcerpt(
  events: VisualizerEvent[],
  stepIndex: number,
  item: AttackResult,
): VisualizerEvent | undefined {
  const calls = events.filter(
    (event) =>
      event.sourceIndex === stepIndex &&
      event.kind === "tool_call" &&
      event.resultSourceIndex !== undefined,
  );
  if (calls.length < 2) {
    return undefined;
  }
  const blob = `${item.excerpt ?? ""} ${item.pattern ?? ""}`;
  const named = calls.filter((call) => toolMentioned(call.toolNames[0], blob));
  const candidates = named.length > 0 ? named : calls;
  const observation = observationText(item);
  const observed = distinctiveTokens(observation);
  const secretTalk = SECRET_TALK_RE.test(observation);
  let best: { result: VisualizerEvent; score: number } | undefined;
  for (const call of candidates) {
    const result = events.find(
      (event) =>
        event.sourceIndex === call.resultSourceIndex &&
        event.kind === "tool_result",
    );
    if (!result) {
      continue;
    }
    const body = distinctiveTokens(result.text);
    const shared = [...observed].filter(
      (token) => !HIGHLIGHT_STOPWORDS.has(token) && body.has(token),
    ).length;
    const score =
      (toolMentioned(call.toolNames[0], observation) ? 3 : 0) +
      (secretTalk && new RegExp(SECRET_VALUE_RE.source).test(result.text) ? 3 : 0) +
      Math.min(shared, 3);
    if (!best || score > best.score) {
      best = { result, score };
    }
  }
  return best?.result;
}

/**
 * A step that lands on a tool call describes an intent whose outcome lives in
 * the next turn, so both rows become candidates for the citation.
 */
function stepScope(
  events: VisualizerEvent[],
  stepIndexes: number[],
  item: AttackResult,
): VisualizerEvent[] {
  const scoped = events.filter((event) =>
    stepIndexes.includes(event.sourceIndex),
  );
  if (stepIndexes.length !== 1) {
    return scoped;
  }
  if (!scoped.some((event) => event.kind === "tool_call")) {
    return scoped;
  }
  const companion =
    batchResultForExcerpt(events, stepIndexes[0], item) ??
    events.find(
      (event) =>
        event.sourceIndex === stepIndexes[0] + 1 &&
        event.kind === "tool_result",
    );
  if (!companion) {
    return scoped;
  }
  // The call row only repeats the tool name, so the outcome replaces it.
  return [...scoped.filter((event) => event.kind !== "tool_call"), companion];
}

function distinctiveTokens(text: string | undefined): Set<string> {
  return new Set((text ?? "").toLowerCase().match(/[a-z0-9_@.]{4,}/g) ?? []);
}

function tokenOverlap(wanted: Set<string>, text: string): number {
  if (wanted.size === 0) {
    return 0;
  }
  const body = distinctiveTokens(text);
  let hits = 0;
  for (const token of wanted) {
    if (body.has(token)) {
      hits += 1;
    }
  }
  return hits / wanted.size;
}

/**
 * Picks the single row that best accounts for the evidence. Ties go to the tool
 * result, because an evidence usually describes what an action produced rather
 * than the sentence announcing it.
 */
function pickAnchorEvent(
  scoped: VisualizerEvent[],
  item: AttackResult,
): VisualizerEvent | undefined {
  if (scoped.length === 0) {
    return undefined;
  }
  const blob = `${item.excerpt ?? ""} ${item.pattern ?? ""}`;
  // An evidence about what the agent was thinking can only be the reasoning row.
  if (/thinking|internal (plan|recap)|reasoning/i.test(blob)) {
    const reasoning = scoped.find((event) => event.kind === "reasoning");
    if (reasoning) {
      return reasoning;
    }
  }
  const wanted = distinctiveTokens(blob);
  let best:
    | { event: VisualizerEvent; score: number; isResult: boolean }
    | undefined;
  for (const event of scoped) {
    const score = tokenOverlap(wanted, event.text);
    const isResult = event.kind === "tool_result";
    const better =
      !best ||
      score > best.score ||
      (score === best.score && isResult && !best.isResult);
    if (better) {
      best = { event, score, isResult };
    }
  }
  return best?.event;
}

// Common words carry no signal, so they are never highlighted. They still count
// when scoring which row to cite, where they cancel out between candidates.
const HIGHLIGHT_STOPWORDS = new Set([
  "about", "after", "also", "been", "before", "body", "both", "could", "each",
  "ensure", "from", "have", "include", "includes", "into", "more", "most",
  "must", "note", "only", "other", "over", "part", "sent", "should", "some",
  "such", "test", "than", "that", "their", "them", "then", "there", "these",
  "they", "this", "those", "user", "were", "what", "when", "which", "will",
  "with", "would", "your",
]);

/**
 * Highlights what the evidence and the row share: two-word phrases of the
 * evidence ("Hiking Trip") at every occurrence; single words everywhere when
 * they occur at most 3 times, otherwise where the most evidence words meet;
 * the dates the evidence names; secret and personal values (keys, passwords,
 * cards, IBANs, and pieces of secrets seen elsewhere in the trace). The tool
 * name itself is not repeated.
 */
function evidenceHighlights(
  text: string,
  item: AttackResult,
  context: HighlightContext,
): HighlightRange[] {
  if (!text) {
    return [];
  }
  const { knownTools } = context;
  const trim = (token: string) => token.replace(/\.+$/, "");
  const wanted = new Set([...highlightTokens(item)].map(trim));
  const observation = observationText(item);
  const observed = new Set([...distinctiveTokens(observation)].map(trim));
  const names = salientWords(`${observation}. ${String(item.relevance ?? "")}`);
  const keyOf = (token: string): string | undefined => {
    if (HIGHLIGHT_STOPWORDS.has(token) || knownTools.has(token)) {
      return undefined;
    }
    if (wanted.has(token)) {
      return token;
    }
    if (token.endsWith("s") && wanted.has(token.slice(0, -1))) {
      return token.slice(0, -1);
    }
    if (wanted.has(`${token}s`)) {
      return `${token}s`;
    }
    return snakeMatches(token, wanted) ? token : undefined;
  };
  const occurrences: Array<{ key: string; start: number; end: number }> = [];
  const lower = text.toLowerCase();
  for (const match of lower.matchAll(/[a-z0-9_@.]{4,}/g)) {
    const token = trim(match[0]);
    const key = token.length >= 4 ? keyOf(token) : undefined;
    if (key) {
      occurrences.push({ key, start: match.index, end: match.index + token.length });
      continue;
    }
    // `shared_with`, `credentials_affected`: mark the part the evidence uses.
    let offset = 0;
    for (const part of token.split("_")) {
      const partKey = token.includes("_") && part.length >= 4 ? keyOf(part) : undefined;
      if (partKey) {
        occurrences.push({ key: partKey, start: match.index + offset, end: match.index + offset + part.length });
      }
      offset += part.length + 1;
    }
  }
  const secrets = SECRET_TALK_RE.test(observation)
    ? [...text.matchAll(SECRET_VALUE_RE)].map((match) => match.index)
    : [];
  const WINDOW = 120;
  // Blank lines and numbered items ("4) Marketing ...") start a new section;
  // words only reinforce each other inside one section.
  const sectionStarts = [0];
  for (const match of text.matchAll(/\n\s*\n|\n\s*\d+\)\s|\\n\\n|\\n\s*\d+\)\s/g)) {
    sectionStarts.push(match.index);
  }
  const sectionOf = (position: number) =>
    sectionStarts.filter((start) => start <= position).length;
  // Names ("Marketing", "Alex") place a word better than common words do.
  const weight = (key: string) => (names.has(key) ? 3 : observed.has(key) ? 2 : 1);
  const density = (position: number) => {
    const section = sectionOf(position);
    const near = (at: number) =>
      Math.abs(at - position) <= WINDOW && sectionOf(at) === section;
    const keys = new Set(
      occurrences.filter((other) => near(other.start)).map((other) => other.key),
    );
    const nearSecret = secrets.some(near);
    return [...keys].reduce((sum, key) => sum + weight(key), 0) + (nearSecret ? 2 : 0);
  };
  const ranges: HighlightRange[] = [];
  const byKey = new Map<string, typeof occurrences>();
  for (const occurrence of occurrences) {
    byKey.set(occurrence.key, [...(byKey.get(occurrence.key) ?? []), occurrence]);
  }
  for (const list of byKey.values()) {
    const chosen =
      list.length <= 3
        ? list
        : [
            list.reduce((best, candidate) =>
              density(candidate.start) > density(best.start) ? candidate : best,
            ),
          ];
    for (const occurrence of chosen) {
      ranges.push({ evidenceId: item.id, start: occurrence.start, end: occurrence.end });
    }
  }
  const blob = [item.excerpt, item.relevance, observation].filter(Boolean).join(" ");
  for (const day of monthDays(blob)) {
    const match = new RegExp(`\\d{4}${day}`).exec(text);
    if (match) {
      ranges.push({ evidenceId: item.id, start: match.index, end: match.index + match[0].length });
    }
  }
  const sensitive = [
    ...sensitiveValues(text),
    ...secretFragments(text, context.traceSecrets),
  ]
    .map(({ start, end }) => ({ evidenceId: item.id, start, end }))
    .sort((a, b) => b.end - b.start - (a.end - a.start))
    .reduce<HighlightRange[]>((kept, range) => withoutOverlaps(kept, [range]), []);
  return withoutOverlaps(
    withoutOverlaps(sensitive, phraseHighlights(text, blob, item.id)),
    ranges,
  ).sort((a, b) => a.start - b.start);
}

const PHRASE_BREAKERS = new Set([
  "the", "and", "for", "with", "from", "into", "that", "this", "are", "was",
  "but", "not", "all", "any", "its", "has", "have", "via",
]);

/** Every occurrence (max 5) of two consecutive evidence words found together in the row. */
function phraseHighlights(text: string, blob: string, evidenceId: string): HighlightRange[] {
  const words = blob.match(/[A-Za-z][A-Za-z0-9'-]*/g) ?? [];
  const pairs = new Set<string>();
  for (let index = 0; index + 1 < words.length; index += 1) {
    const [first, second] = [words[index], words[index + 1]];
    const usable = (word: string) =>
      word.length >= 3 && !PHRASE_BREAKERS.has(word.toLowerCase());
    if (usable(first) && usable(second)) {
      pairs.add(`${first} ${second}`.toLowerCase());
    }
  }
  const ranges: HighlightRange[] = [];
  const escape = (word: string) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const pair of pairs) {
    const [first, second] = pair.split(" ").map(escape);
    const pattern = new RegExp(`\\b${first}\\s+${second}\\b`, "gi");
    let count = 0;
    for (const match of text.matchAll(pattern)) {
      ranges.push({ evidenceId, start: match.index, end: match.index + match[0].length });
      count += 1;
      if (count >= 5) {
        break;
      }
    }
  }
  return ranges;
}

/** Capitalised words that do not start a sentence (names, titles), lower-cased. */
function salientWords(text: string): Set<string> {
  const found = new Set<string>();
  for (const match of text.matchAll(/([.!?]\s*|^\s*)?\b([A-Z][A-Za-z]{3,})\b/g)) {
    if (match[1] === undefined) {
      found.add(match[2].toLowerCase());
    }
  }
  return found;
}

function snakeParts(token: string): string[] {
  return token.split("_").filter((part) => part.length >= 4);
}

// `search_emails` matches "search emails": every meaningful part must be wanted.
function snakeMatches(token: string, wanted: Set<string>): boolean {
  if (!token.includes("_")) {
    return false;
  }
  const parts = snakeParts(token);
  return parts.length >= 2 && parts.every((part) => wanted.has(part));
}

/**
 * Words to highlight on the cited row. Relevance and observations count here
 * only, never when choosing the row, so the citation does not move.
 */
function highlightTokens(item: AttackResult): Set<string> {
  const tokens = distinctiveTokens(
    [item.excerpt, item.pattern, item.relevance, ...(item.anomalies ?? [])]
      .filter(Boolean)
      .join(" "),
  );
  for (const token of [...tokens]) {
    if (token.includes("_")) {
      for (const part of snakeParts(token)) {
        tokens.add(part);
      }
    }
  }
  return tokens;
}

function withoutOverlaps(
  primary: HighlightRange[],
  extra: HighlightRange[],
): HighlightRange[] {
  return [
    ...primary,
    ...extra.filter(
      (range) =>
        !primary.some(
          (kept) => range.start < kept.end && kept.start < range.end,
        ),
    ),
  ];
}

/** The call row shown right above `result`, which issued it. */
function callForResult(
  events: VisualizerEvent[],
  result: VisualizerEvent,
): VisualizerEvent | undefined {
  return events.find(
    (event) =>
      event.kind === "tool_call" &&
      event.resultSourceIndex === result.sourceIndex,
  );
}

/** A paired call row holds a single tool name: mark it whole. */
function callHighlights(
  call: VisualizerEvent,
  item: AttackResult,
): HighlightRange[] {
  const name = call.toolNames[0];
  return name ? [{ evidenceId: item.id, start: 0, end: name.length }] : [];
}

function evidenceNeedles(item: AttackResult): string[] {
  const sources = [item.excerpt, item.description, item.pattern].filter(
    (value): value is string => typeof value === "string",
  );
  const needles: string[] = [];
  for (const source of sources) {
    const stripped = source
      .replace(/\[\d{3,}\]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (stripped.length >= MIN_NEEDLE && stripped.length <= 220) {
      needles.push(stripped);
    }
    const toolName = stripped.match(/^[a-z][a-z0-9_]+/i);
    if (toolName) {
      needles.push(toolName[0]);
    }
    for (const line of source.split(/\n+/)) {
      const cleaned = line
        .replace(/\[\d{3,}\]/g, " ")
        .replace(/assistant thinking/gi, " ")
        .replace(/^\s*(tool|assistant|user)\b[:\s/-]*/i, "")
        .replace(/^\s*[-·]+\s*/, "")
        .trim();
      if (cleaned.startsWith("...")) {
        continue;
      }
      needles.push(cleaned);
    }
    const emails = source.match(
      /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi,
    );
    if (emails) {
      needles.push(...emails);
    }
    const ibans = source.match(/\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/g);
    if (ibans) {
      needles.push(...ibans);
    }
  }
  return uniqueNeedles(needles);
}

function pickStepEvent(
  events: VisualizerEvent[],
  item: AttackResult,
): VisualizerEvent | undefined {
  if (events.length === 0) {
    return undefined;
  }
  const blob = `${item.excerpt ?? ""} ${item.pattern ?? ""}`.toLowerCase();
  if (blob.includes("thinking")) {
    const reasoning = events.find((event) => event.kind === "reasoning");
    if (reasoning) {
      return reasoning;
    }
  }
  if (blob.includes("tool") || blob.includes("send_") || blob.includes("schedule_")) {
    const result = events.find((event) => event.kind === "tool_result");
    if (result) {
      return result;
    }
    const call = events.find((event) => event.kind === "tool_call");
    if (call) {
      return call;
    }
  }
  return events[0];
}

function bestNeedleMatch(
  events: VisualizerEvent[],
  needles: string[],
): { event: VisualizerEvent; range: HighlightRange; score: number } | null {
  let best: { event: VisualizerEvent; range: HighlightRange; score: number } | null =
    null;
  for (const event of events) {
    for (const needle of needles) {
      const range = findHighlightRange(event.text, needle);
      if (!range) {
        continue;
      }
      const score = range.end - range.start;
      if (!best || score > best.score) {
        best = { event, range, score };
      }
    }
  }
  return best;
}

function markEvent(
  event: VisualizerEvent,
  evidenceId: string,
  range: HighlightRange | HighlightRange[] | null,
): void {
  event.highlighted = true;
  if (!event.matchedEvidenceIds.includes(evidenceId)) {
    event.matchedEvidenceIds.push(evidenceId);
  }
  const ranges = range === null ? [] : Array.isArray(range) ? range : [range];
  for (const entry of ranges) {
    if (entry.end > entry.start) {
      event.highlights.push({
        evidenceId,
        start: entry.start,
        end: entry.end,
      });
    }
  }
}

function attachUnmatched(
  events: VisualizerEvent[],
  unmatched: AttackResult[],
): void {
  const context = highlightContext(events);
  for (const item of unmatched) {
    const excerptSteps = parseConversationSteps(item.excerpt, item.where);
    const otherSteps = parseConversationSteps(item.pattern, item.description);
    const evidenceStep = parseEvidenceStep(item.step);
    const stepIndexes = resolveStepIndexes(evidenceStep, [
      ...excerptSteps,
      ...otherSteps,
    ]);
    const scoped = stepIndexes.length ? stepScope(events, stepIndexes, item) : events;
    const stepEvent =
      (evidenceStep === undefined ? undefined : pickAnchorEvent(scoped, item)) ??
      pickStepEvent(scoped, item);
    if (stepEvent) {
      markEvent(
        stepEvent,
        item.id,
        evidenceHighlights(stepEvent.text, item, context),
      );
      continue;
    }
    let attached = false;
    for (const event of scoped) {
      for (const marker of RISK_MARKERS) {
        const found = findHighlightRange(event.text, marker);
        if (!found) {
          continue;
        }
        markEvent(event, item.id, {
          evidenceId: item.id,
          start: found.start,
          end: found.end,
        });
        attached = true;
        break;
      }
      if (attached) {
        break;
      }
    }
    if (attached) {
      continue;
    }
    const fallback = scoped[0] ?? events[0];
    if (fallback) {
      markEvent(
        fallback,
        item.id,
        evidenceHighlights(fallback.text, item, context),
      );
    }
  }
}

function attachEvidence(
  events: VisualizerEvent[],
  evidence: AttackResult[],
): VisualizerEvent[] {
  const context = highlightContext(events);
  const unmatched: AttackResult[] = [];

  for (const item of evidence) {
    if (item.id === "pipeline-user-request") {
      const userEvent = events.find((event) => event.kind === "user");
      if (userEvent) {
        markEvent(userEvent, item.id, null);
        continue;
      }
    }
    if (item.id === "pipeline-final") {
      const lastAssistant = [...events]
        .reverse()
        .find((event) => event.kind === "assistant" && event.text.trim());
      if (lastAssistant) {
        markEvent(lastAssistant, item.id, null);
        continue;
      }
    }
    const evidenceStep = parseEvidenceStep(item.step);
    const excerptSteps = parseConversationSteps(item.excerpt, item.where);
    const otherSteps = parseConversationSteps(item.pattern, item.description);
    const stepIndexes = resolveStepIndexes(evidenceStep, [
      ...excerptSteps,
      ...otherSteps,
    ]);
    const scoped = stepIndexes.length ? stepScope(events, stepIndexes, item) : [];
    const needles = evidenceNeedles(item);

    if (evidenceStep !== undefined) {
      const anchor = pickAnchorEvent(scoped, item);
      if (anchor) {
        // Only the excerpt is quoted literally; the observation is paraphrase.
        const literal = bestNeedleMatch(
          [anchor],
          evidenceNeedles({ ...item, description: "" }),
        )?.range;
        const words = evidenceHighlights(anchor.text, item, context);
        markEvent(
          anchor,
          item.id,
          literal
            ? withoutOverlaps(
                [{ evidenceId: item.id, start: literal.start, end: literal.end }],
                words,
              )
            : words,
        );
        // The call and its result are one action: the call shows what was run.
        const call =
          anchor.kind === "tool_result" ? callForResult(events, anchor) : undefined;
        if (call) {
          markEvent(call, item.id, callHighlights(call, item));
        }
        continue;
      }
    }

    const best = bestNeedleMatch(scoped, needles) ?? bestNeedleMatch(events, needles);

    if (best) {
      markEvent(best.event, item.id, {
        evidenceId: item.id,
        start: best.range.start,
        end: best.range.end,
      });
      continue;
    }

    const stepEvent = pickStepEvent(scoped, item) ?? pickStepEvent(events, item);
    if (stepEvent) {
      markEvent(
        stepEvent,
        item.id,
        evidenceHighlights(stepEvent.text, item, context),
      );
      continue;
    }

    const label = `${item.pattern ?? ""} ${item.type ?? ""} ${item.excerpt ?? ""}`.toLowerCase();
    const toolEvent = events.find((event) =>
      event.toolNames.some((name) => label.includes(name.toLowerCase())),
    );
    if (toolEvent) {
      markEvent(
        toolEvent,
        item.id,
        evidenceHighlights(toolEvent.text, item, context),
      );
      continue;
    }

    if (
      item.id === "pipeline-expected" ||
      item.id.startsWith("pipeline-stage-")
    ) {
      continue;
    }
    unmatched.push(item);
  }

  attachUnmatched(events, unmatched);
  return events;
}

// "a, b, b, b" -> "a, b ×3": parallel calls to one tool read as one entry.
function compactToolTitle(names: string[]): string {
  const counts = new Map<string, number>();
  for (const name of names) {
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts]
    .map(([name, count]) => (count > 1 ? `${name} ×${count}` : name))
    .join(", ");
}

export function conversationToEvents(
  conversation: Array<TraceConversationTurn | ConversationTurn>,
  evidence: AttackResult[] = [],
): VisualizerEvent[] {
  const events: VisualizerEvent[] = [];
  // A batch of parallel calls whose results follow it one per call, in order:
  // each call is shown right above its own result.
  let batch: { names: string[]; sourceIndex: number; paired: number } | null =
    null;
  const isResultTurn = (index: number) => {
    const role = (conversation[index]?.role ?? "").toLowerCase();
    return role === "tool" || role === "function";
  };

  conversation.forEach((turn, sourceIndex) => {
    const role = (turn.role ?? "").toLowerCase();
    const content = asText(turn.content);
    const toolNames = parseToolNames(turn.tool_calls);

    const push = (
      kind: VisualizerKind,
      title: string,
      text: string,
      names: string[] = toolNames,
      extra: Partial<VisualizerEvent> = {},
    ) => {
      if (!text && names.length === 0 && !extra.empty) {
        return;
      }
      events.push({
        id: `evt-${sourceIndex}-${events.length}`,
        index: events.length,
        kind,
        title,
        text,
        toolNames: names,
        sourceIndex,
        highlighted: false,
        matchedEvidenceIds: [],
        highlights: [],
        ...extra,
      });
    };

    const pushCall = (name: string, callIndex: number, resultIndex?: number) =>
      push("tool_call", `Tool · ${name}`, name, [name], {
        sourceIndex: callIndex,
        resultSourceIndex: resultIndex,
        unanswered: resultIndex === undefined,
      });

    if (role === "user") {
      batch = null;
      push("user", "User", content, []);
      return;
    }

    if (role === "tool" || role === "function") {
      const position = batch ? sourceIndex - batch.sourceIndex - 1 : -1;
      const pairedName =
        batch && position >= 0 && position < batch.paired
          ? batch.names[position]
          : undefined;
      if (batch && pairedName) {
        pushCall(pairedName, batch.sourceIndex, sourceIndex);
      }
      const label =
        toolNames.length > 0 ? compactToolTitle(toolNames) : pairedName;
      push(
        "tool_result",
        label ? `Result · ${label}` : "Tool result",
        content,
        toolNames,
        { empty: !content.trim() && Boolean(pairedName) },
      );
      // Calls the trace never answered follow the answered ones.
      if (batch && pairedName && position === batch.paired - 1) {
        batch.names
          .slice(batch.paired)
          .forEach((name) => pushCall(name, batch!.sourceIndex));
      }
      return;
    }

    const { reasoning, visible } = splitReasoning(content);
    if (reasoning) {
      push("reasoning", "Reasoning", reasoning, []);
    }
    if (visible) {
      push("assistant", "Agent", visible, []);
    }
    let paired = 0;
    while (paired < toolNames.length && isResultTurn(sourceIndex + 1 + paired)) {
      paired += 1;
    }
    batch = paired > 0 ? { names: toolNames, sourceIndex, paired } : null;
    if (paired === 0) {
      toolNames.forEach((name) => pushCall(name, sourceIndex));
    }
  });

  return attachEvidence(events, evidence);
}

export function clusterChatEvents(events: VisualizerEvent[]): ChatCluster[] {
  const clusters: ChatCluster[] = [];
  let agent: Extract<ChatCluster, { variant: "agent" }> | null = null;

  const flushAgent = () => {
    if (!agent) {
      return;
    }
    // The closing assistant message becomes the visible bubble; everything else,
    // including the assistant turns between tool calls, stays in the timeline.
    const closing = agent.actions
      .map((event, index) => ({ event, index }))
      .filter(({ event }) => event.kind === "assistant")
      .pop();
    if (closing) {
      agent.event = closing.event;
      agent.actions.splice(closing.index, 1);
    }
    if (agent.event || agent.actions.length > 0) {
      clusters.push(agent);
    }
    agent = null;
  };

  const ensureAgent = (key: string) => {
    if (!agent) {
      agent = { key, variant: "agent", event: null, actions: [] };
    }
    return agent;
  };

  for (const event of events) {
    if (event.kind === "user") {
      flushAgent();
      clusters.push({ key: event.id, variant: "user", event });
      continue;
    }
    ensureAgent(event.id).actions.push(event);
  }
  flushAgent();
  return clusters;
}

export function findEventForEvidence(
  events: VisualizerEvent[],
  evidenceId: string,
): VisualizerEvent | undefined {
  const matched = events.filter((event) =>
    event.matchedEvidenceIds.includes(evidenceId),
  );
  // A cited call is paired with its result, which is where focus belongs.
  return matched.find((event) => event.kind !== "tool_call") ?? matched[0];
}

export function markId(eventId: string, evidenceId: string): string {
  return `${eventId}-mark-${evidenceId}`;
}
