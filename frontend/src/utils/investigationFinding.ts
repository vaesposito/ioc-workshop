import type { AttackResult, Investigation } from "./investigationStore";

export interface InvestigationFindingView {
  label: string;
  tone: "running" | "malicious" | "benign" | "failed" | "neutral";
}

export interface EvidencePastCases {
  href: string;
  label: string;
  count: number;
}

export function getInvestigationFindingView(
  investigation: Pick<Investigation, "status" | "verdict" | "results"> & {
    evidenceCount?: number;
  },
): InvestigationFindingView {
  const isRunning =
    investigation.status === "pending" || investigation.status === "started";
  if (isRunning) {
    return { label: "Running", tone: "running" };
  }

  if (investigation.status === "failed" || investigation.verdict === "error") {
    return { label: "Failed", tone: "failed" };
  }

  if (investigation.verdict === "malicious") {
    return { label: "Malicious", tone: "malicious" };
  }

  return { label: "Benign", tone: "benign" };
}

export function investigationsListHref(filters: {
  appId?: string | null;
  verdict?: string | null;
  query?: string | null;
}): string {
  const params = new URLSearchParams();
  if (filters.appId) {
    params.set("app", filters.appId);
  }
  if (filters.verdict) {
    params.set("verdict", filters.verdict);
  }
  const query = filters.query?.trim();
  if (query) {
    params.set("q", query);
  }
  const qs = params.toString();
  return qs ? `/investigations?${qs}` : "/investigations";
}

function evidenceSearchHaystack(
  item: Pick<AttackResult, "pattern" | "description" | "type" | "excerpt">,
): string {
  return [item.pattern, item.description, item.type, item.excerpt]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();
}

function isBaselineEvidencePattern(pattern: string): boolean {
  const text = pattern.toLowerCase();
  return (
    /\bbaseline\b/.test(text) ||
    text.includes("benign run") ||
    text.includes("what a benign")
  );
}

const SECRET_PREFIX_RE = /^(akia|sk_live_|sk_test_|ghp_|mongodb)/i;
const IBAN_RE = /\b[A-Z]{2}\d{2}[A-Z0-9]{4,30}\b/g;
const EMAIL_RE = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi;
const HANDLE_RE = /\b[a-z][a-z0-9]{2,}[.][a-z][a-z0-9]{2,}\b/gi;
const HANDLE_SKIP_RIGHT = new Set([
  "xlsx",
  "xls",
  "docx",
  "pdf",
  "json",
  "txt",
  "csv",
  "html",
  "com",
  "org",
  "net",
  "edu",
  "io",
  "ai",
]);

function isIbanKey(value: string): boolean {
  return /^[a-z]{2}\d{2}[a-z0-9]{4,}$/.test(value);
}

function collectIdentityKeys(text: string): string[] {
  const keys: string[] = [];
  for (const match of text.matchAll(new RegExp(IBAN_RE.source, "g"))) {
    const value = match[0].toLowerCase();
    if (!SECRET_PREFIX_RE.test(value)) {
      keys.push(value);
    }
  }
  for (const match of text.matchAll(new RegExp(EMAIL_RE.source, "gi"))) {
    const value = match[0].toLowerCase();
    if (!SECRET_PREFIX_RE.test(value)) {
      keys.push(value);
    }
  }
  for (const match of text.matchAll(new RegExp(HANDLE_RE.source, "gi"))) {
    const value = match[0].toLowerCase();
    const right = value.split(".")[1] ?? "";
    if (HANDLE_SKIP_RIGHT.has(right) || SECRET_PREFIX_RE.test(value)) {
      continue;
    }
    keys.push(value);
  }
  const seen = new Set<string>();
  return keys.filter((key) => {
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function getEvidenceIdentityKeys(
  item: Pick<AttackResult, "pattern" | "description" | "excerpt">,
): string[] {
  return collectIdentityKeys(
    [item.pattern, item.description, item.excerpt]
      .filter((value): value is string => Boolean(value))
      .join("\n"),
  );
}

function identityKeysMatch(left: string, right: string): boolean {
  if (left === right) {
    return true;
  }
  if (isIbanKey(left) && isIbanKey(right) && left.length >= 8 && right.length >= 8) {
    return left.startsWith(right) || right.startsWith(left);
  }
  return false;
}

export function evidenceItemsShareIdentity(
  left: Pick<AttackResult, "pattern" | "description" | "excerpt">,
  right: Pick<AttackResult, "pattern" | "description" | "excerpt">,
): boolean {
  const leftPattern = (left.pattern ?? "").trim().toLowerCase();
  const rightPattern = (right.pattern ?? "").trim().toLowerCase();
  if (leftPattern && leftPattern === rightPattern) {
    return true;
  }
  const leftKeys = getEvidenceIdentityKeys(left);
  const rightKeys = getEvidenceIdentityKeys(right);
  return leftKeys.some((leftKey) =>
    rightKeys.some((rightKey) => identityKeysMatch(leftKey, rightKey)),
  );
}

function pickEvidenceSearchQuery(
  item: Pick<AttackResult, "id" | "pattern" | "description" | "excerpt">,
): string | null {
  const keys = getEvidenceIdentityKeys(item);
  const iban = keys
    .filter((key) => isIbanKey(key))
    .sort((left, right) => right.length - left.length)[0];
  if (iban) {
    return iban;
  }
  const handle = keys.find((key) => key.includes(".") && !key.includes("@"));
  if (handle) {
    return handle;
  }
  const email = keys.find((key) => key.includes("@"));
  if (email) {
    return email;
  }
  const pattern = item.pattern?.trim() ?? "";
  if (!pattern || isBaselineEvidencePattern(pattern)) {
    return null;
  }
  return pattern;
}

/** Real report finding identity used to find recurrences. */
export function getEvidenceSearchQuery(
  item: Pick<AttackResult, "id" | "pattern" | "description" | "excerpt">,
): string | null {
  if (item.id.startsWith("pipeline-")) {
    return null;
  }
  return pickEvidenceSearchQuery(item);
}

export function investigationMatchesListQuery(
  investigation: Pick<Investigation, "id" | "name" | "results">,
  query: string,
): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  if (
    investigation.name.toLowerCase().includes(normalized) ||
    investigation.id.toLowerCase().includes(normalized)
  ) {
    return true;
  }
  return investigation.results.some((item) =>
    evidenceSearchHaystack(item).includes(normalized),
  );
}

export function investigationHasEvidenceQuery(
  investigation: Pick<Investigation, "results">,
  query: string,
): boolean {
  const identity = query.trim().toLowerCase();
  if (!identity) {
    return false;
  }
  return investigation.results.some((item) => {
    if ((item.pattern ?? "").trim().toLowerCase() === identity) {
      return true;
    }
    if (
      getEvidenceIdentityKeys(item).some((key) => identityKeysMatch(key, identity))
    ) {
      return true;
    }
    return evidenceSearchHaystack(item).includes(identity);
  });
}

export function countOtherEvidenceRuns(
  investigations: Array<Pick<Investigation, "id" | "results">>,
  currentId: string,
  item: Pick<AttackResult, "pattern" | "description" | "excerpt">,
): number {
  return investigations.filter(
    (row) =>
      row.id !== currentId &&
      row.results.some((other) => evidenceItemsShareIdentity(item, other)),
  ).length;
}

export function getEvidencePastCases(options: {
  item: Pick<AttackResult, "id" | "pattern" | "description" | "excerpt">;
  currentId: string;
  investigations: Array<Pick<Investigation, "id" | "results">>;
}): EvidencePastCases | null {
  const query = getEvidenceSearchQuery(options.item);
  if (!query) {
    return null;
  }
  const otherCount = countOtherEvidenceRuns(
    options.investigations,
    options.currentId,
    options.item,
  );
  if (otherCount < 1) {
    return null;
  }
  const countLabel =
    otherCount === 1 ? "1 other run" : `${otherCount} other runs`;
  return {
    href: investigationsListHref({ query }),
    label: `Investigations table · this evidence · ${countLabel}`,
    count: otherCount,
  };
}
