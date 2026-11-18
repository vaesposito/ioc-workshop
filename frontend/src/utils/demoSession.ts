const BASELINE_KEY = "detective:demo-baseline-investigation-ids";

function readIdSet(key: string): Set<string> {
  if (typeof window === "undefined") {
    return new Set();
  }
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return new Set();
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return new Set();
    }
    return new Set(
      parsed.filter((value): value is string => typeof value === "string"),
    );
  } catch {
    return new Set();
  }
}

function writeIdSet(key: string, ids: Set<string>): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(key, JSON.stringify([...ids]));
}

export function rememberDemoBaseline(ids: string[]): void {
  if (ids.length === 0) {
    return;
  }
  if (readIdSet(BASELINE_KEY).size > 0) {
    return;
  }
  writeIdSet(BASELINE_KEY, new Set(ids));
}

export function getUserInitiatedInvestigationIds(currentIds: string[]): string[] {
  const baseline = readIdSet(BASELINE_KEY);
  if (baseline.size === 0) {
    return [];
  }
  return currentIds.filter((id) => !baseline.has(id));
}
