import manifestData from "../content/agents.json";

export interface ToolGroup {
  id: string;
  name: string;
  tools: string[];
}

interface ManifestEntry {
  source: string;
  groups: ToolGroup[];
}

export type ManifestApp = { id: string; name?: string };

/** Bucket for tools a trace calls that the application never declared. */
export const UNDECLARED_GROUP_ID = "undeclared";
export const UNDECLARED_GROUP_LABEL = "Undeclared";

// Framework control flow, excluded from the manifest by the generator too.
const IGNORED_TOOLS = new Set(["end_task"]);

export function isIgnoredTool(tool: string): boolean {
  return IGNORED_TOOLS.has(tool);
}

const manifest = manifestData as Record<string, ManifestEntry | undefined>;

function candidateKeys(app: ManifestApp | undefined): string[] {
  if (!app?.id && !app?.name) {
    return [];
  }
  const keys: string[] = [];
  if (app.id) {
    keys.push(app.id);
  }
  const slug = app.name?.trim().toLowerCase().replace(/\s+/g, "-");
  if (slug) {
    keys.push(`app-${slug}`, slug);
  }
  return keys;
}

function resolveEntry(app: ManifestApp | undefined): ManifestEntry | undefined {
  for (const key of candidateKeys(app)) {
    const entry = manifest[key];
    if (entry) {
      return entry;
    }
  }
  return undefined;
}

export function getApplicationToolGroups(
  app: ManifestApp | undefined,
): ToolGroup[] {
  return resolveEntry(app)?.groups ?? [];
}

export function getApplicationToolCount(app: ManifestApp | undefined): number {
  return getApplicationToolGroups(app).reduce(
    (total, group) => total + group.tools.length,
    0,
  );
}

export function getApplicationToolNames(
  app: ManifestApp | undefined,
): string[] {
  return getApplicationToolGroups(app).flatMap((group) => group.tools);
}

/** Maps every declared tool name to the id of the group that owns it. */
export function buildToolGroupIndex(
  app: ManifestApp | undefined,
): Map<string, string> {
  const index = new Map<string, string>();
  for (const group of getApplicationToolGroups(app)) {
    for (const tool of group.tools) {
      index.set(tool, group.id);
    }
  }
  return index;
}

export function getToolGroupLabel(
  app: ManifestApp | undefined,
  groupId: string,
): string {
  if (groupId === UNDECLARED_GROUP_ID) {
    return UNDECLARED_GROUP_LABEL;
  }
  return (
    getApplicationToolGroups(app).find((group) => group.id === groupId)?.name ??
    groupId.replace(/_/g, " ")
  );
}
