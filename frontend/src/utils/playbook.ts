import bankTransferPlaybookRaw from "../../../preload_artifacts/bank_transfer/evoguard/memory/playbooks/final_playbook.txt?raw";
import calendarPlaybookRaw from "../../../preload_artifacts/calendar/evoguard/memory/playbooks/final_playbook.txt?raw";
import americanAirlinesPlaybookRaw from "../../../preload_artifacts/american_airlines/evoguard/memory/playbooks/final_playbook.txt?raw";
import spamFilteringPlaybookRaw from "../../../preload_artifacts/spam_filtering/evoguard/memory/playbooks/final_playbook.txt?raw";

const RAW_PLAYBOOKS: Record<string, string> = {
  "app-bank-transfer": bankTransferPlaybookRaw,
  "app-calendar": calendarPlaybookRaw,
  "app-american-airlines": americanAirlinesPlaybookRaw,
  "app-spam-filtering": spamFilteringPlaybookRaw,
};

export interface PlaybookEntry {
  id: string;
  text: string;
}

const ID_TOKEN = /(obj|eva|dec|evd)-\d{3,6}/gi;

// Pull the human-readable rule out of a playbook line. Lines look like:
//   [obj-00001] helpful=.. harmful=.. :: [alias] helpful=.. harmful=.. | <text>
//   [obj-00003] helpful=.. harmful=.. :: [obj-00003] helpful=.. harmful=.. :: [A1-00001] <text>
function extractExplanation(line: string): string {
  const pipe = line.lastIndexOf(" | ");
  let text = pipe !== -1 ? line.slice(pipe + 3) : line;
  if (pipe === -1) {
    const sep = text.lastIndexOf(" :: ");
    if (sep !== -1) {
      text = text.slice(sep + 4);
    }
  }
  // Drop a leading alias tag ("[A1-00001] ") and any counter prefix left over.
  return text
    .replace(/^\s*\[[^\]]+\]\s*/, "")
    .replace(/^\s*helpful=\d+\s+harmful=\d+\s*::?\s*/i, "")
    .replace(/^\s*\[[^\]]+\]\s*/, "")
    .trim();
}

function parsePlaybook(raw: string): Map<string, PlaybookEntry> {
  const entries = new Map<string, PlaybookEntry>();
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("[")) {
      continue;
    }
    const text = extractExplanation(trimmed);
    if (!text) {
      continue;
    }
    // The primary id opens the line; keep the first entry that defines each id.
    const primary = trimmed.match(/^\[((?:obj|eva|dec|evd)-\d{3,6})\]/i);
    if (!primary) {
      continue;
    }
    const primaryId = primary[1].toLowerCase();
    const entry: PlaybookEntry = { id: primaryId, text };
    if (!entries.has(primaryId)) {
      entries.set(primaryId, entry);
    }
    // Also index the aliased id (e.g. "[obj-00017]") so either reference resolves.
    const bracketIds = trimmed.match(/\[((?:obj|eva|dec|evd)-\d{3,6})\]/gi) ?? [];
    for (const token of bracketIds) {
      const id = token.slice(1, -1).toLowerCase();
      if (!entries.has(id)) {
        entries.set(id, entry);
      }
    }
  }
  return entries;
}

const cache = new Map<string, Map<string, PlaybookEntry>>();

function playbookFor(appId: string): Map<string, PlaybookEntry> | undefined {
  const raw = RAW_PLAYBOOKS[appId];
  if (!raw) {
    return undefined;
  }
  let parsed = cache.get(appId);
  if (!parsed) {
    parsed = parsePlaybook(raw);
    cache.set(appId, parsed);
  }
  return parsed;
}

export function getPlaybookEntry(
  appId: string | undefined | null,
  id: string,
): PlaybookEntry | undefined {
  if (!appId) {
    return undefined;
  }
  return playbookFor(appId)?.get(id.toLowerCase());
}

export type PlaybookRefPart =
  | { type: "text"; text: string }
  | { type: "ref"; text: string; id: string };

// Split reasoning text into plain runs and playbook references. Handles the
// forms seen in the model output: `obj-00003`, `(obj-00003, obj-00012)`,
// `[obj-00016]`, and the shorthand `obj-00003/00012` (bare trailing numbers).
export function splitPlaybookRefs(text: string): PlaybookRefPart[] {
  const parts: PlaybookRefPart[] = [];
  let cursor = 0;
  ID_TOKEN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ID_TOKEN.exec(text)) !== null) {
    const [token] = match;
    const prefix = token.split("-")[0].toLowerCase();
    const start = match.index;
    if (start > cursor) {
      parts.push({ type: "text", text: text.slice(cursor, start) });
    }
    parts.push({ type: "ref", text: token, id: token.toLowerCase() });
    let end = start + token.length;
    // Expand a trailing shorthand list like "/00012/00015" into more refs.
    const shorthand = /^(\s*\/\s*)(\d{3,6})/;
    let rest = text.slice(end);
    let more = rest.match(shorthand);
    while (more) {
      parts.push({ type: "text", text: more[1] });
      parts.push({ type: "ref", text: more[2], id: `${prefix}-${more[2]}` });
      end += more[0].length;
      rest = text.slice(end);
      more = rest.match(shorthand);
    }
    cursor = end;
    ID_TOKEN.lastIndex = end;
  }
  if (cursor < text.length) {
    parts.push({ type: "text", text: text.slice(cursor) });
  }
  return parts;
}
