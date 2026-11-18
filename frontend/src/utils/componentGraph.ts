import type { Application } from "./applicationStore";
import type { Investigation } from "./investigationStore";
import type { VisualizerEvent } from "./traceVisualizer";
import {
  buildToolGroupIndex,
  getApplicationToolGroups,
  getToolGroupLabel,
  isIgnoredTool,
  UNDECLARED_GROUP_ID,
  type ManifestApp,
} from "./toolManifest";

export type ComponentKind = "user" | "agent" | "tool";

export interface MaliciousCite {
  investigationId: string;
  investigationName: string;
  applicationId: string;
  evidenceId: string;
  where: string;
  action: string;
  traceFileId?: string;
  traceLabel: string;
}

export interface MaliciousTraceGroup {
  key: string;
  traceLabel: string;
  applicationId: string;
  traceFileId?: string;
  steps: MaliciousStepCite[];
}

export interface MaliciousStepCite {
  key: string;
  investigationId: string;
  evidenceId: string;
  stepLabel: string;
}

export interface ComponentNode {
  id: string;
  label: string;
  kind: ComponentKind;
  tools: string[];
}

export interface ComponentEdge {
  from: string;
  to: string;
  count: number;
  malicious: boolean;
}

export interface LaidOutNode extends ComponentNode {
  x: number;
  y: number;
  r: number;
  calls: number;
  malicious: boolean;
  undeclared: boolean;
  cites: MaliciousCite[];
}

export interface LaidOutGraph {
  width: number;
  height: number;
  nodes: LaidOutNode[];
  edges: ComponentEdge[];
}

type GraphNodeInput = ComponentNode & {
  calls: number;
  malicious: boolean;
  undeclared: boolean;
  cites: MaliciousCite[];
};

const COMPONENT_DETAIL: Record<string, string> = {
  user: "The person who issued this task.",
  agent: "The assistant that ran the conversation and tool calls.",
  email_tools: "Inbox, search, and outbound mail tools.",
  calendar_tools: "Calendar days, events, and scheduling tools.",
  drive_tools: "Cloud file list, search, and write tools.",
  financial_transfer: "Bank account, Venmo, and Zelle payment tools.",
  communication_tools: "Phone, messaging, and spam tools.",
  web_tools: "Web page fetch and publish tools.",
  linkedin_tools: "Professional profile lookup tools.",
  spam_filter_tools: "Mail filters, rules, and reprocessing tools.",
  flight_tools: "Flight search and booking tools.",
  hotel_tools: "Hotel search and reservation tools.",
  restaurant_tools: "Restaurant search and reservation tools.",
  excel_tools: "Spreadsheet read and write tools.",
  [UNDECLARED_GROUP_ID]: "Tool called but not present in the app manifest.",
};

export function describeComponent(id: string): string {
  return COMPONENT_DETAIL[id] ?? "Tools used in this view.";
}

export function selectionKindLabel(kind: ComponentKind): string {
  if (kind === "user") {
    return "Selected user";
  }
  if (kind === "agent") {
    return "Selected agent";
  }
  return "Selected component";
}

function nodeForId(id: string, label: string): ComponentNode {
  if (id === "user") {
    return { id: "user", label: "User", kind: "user", tools: [] };
  }
  if (id === "agent") {
    return { id: "agent", label: "Agentic App", kind: "agent", tools: [] };
  }
  return { id, label, kind: "tool", tools: [] };
}

function addEdge(
  edges: Map<string, ComponentEdge>,
  from: string,
  to: string,
  malicious: boolean,
) {
  if (from === to) {
    return;
  }
  const key = `${from}>${to}`;
  const current = edges.get(key);
  if (current) {
    current.count += 1;
    current.malicious = current.malicious || malicious;
    return;
  }
  edges.set(key, { from, to, count: 1, malicious });
}

function citeWhere(result: Investigation["results"][number]): string {
  const where = result.where?.trim();
  if (where) {
    return where.startsWith("Step") ? where : `Where · ${where}`;
  }
  return "Investigation evidence";
}

function citeAction(result: Investigation["results"][number]): string {
  return (
    result.type?.trim() ||
    result.pattern?.trim() ||
    result.excerpt?.trim() ||
    result.description?.trim() ||
    ""
  );
}

export function citeStepLabel(where: string): string {
  const match = where.match(/Step\s*\[?(\d+)\]?/i);
  if (match?.[1]) {
    return `Step [${match[1].padStart(3, "0")}]`;
  }
  const stripped = where.replace(/^Where ·\s*/i, "").trim();
  return stripped || "Step";
}

export function citeTraceLabel(investigation: Investigation): string {
  const haystack = [investigation.name, investigation.trace_id]
    .filter(Boolean)
    .join(" ");
  const file = haystack.match(/(?:malicious|benign)_[a-z0-9]+\.json/i);
  if (file?.[0]) {
    return file[0];
  }
  const detective = investigation.name.match(
    /^Detective:\s*(.+?)(?:\s+\d+)?$/i,
  );
  const fromDetective = detective?.[1]?.trim();
  if (fromDetective && !/^trace$/i.test(fromDetective)) {
    return fromDetective;
  }
  return "";
}

function citeTraceKey(cite: Pick<MaliciousCite, "traceFileId" | "investigationId">): string {
  return cite.traceFileId || cite.investigationId;
}

export function groupMaliciousCites(
  cites: MaliciousCite[],
  traceNameById?: Record<string, string>,
): MaliciousTraceGroup[] {
  const groups = new Map<string, MaliciousTraceGroup>();
  for (const cite of cites) {
    const key = citeTraceKey(cite);
    const lookedUp = cite.traceFileId
      ? traceNameById?.[cite.traceFileId]
      : undefined;
    const traceLabel =
      lookedUp ||
      cite.traceLabel ||
      (cite.traceFileId ? cite.traceFileId.slice(0, 8) : "Untitled");
    const stepLabel = citeStepLabel(cite.where);
    const stepKey = stepLabel.toLowerCase();
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        key,
        traceLabel,
        applicationId: cite.applicationId,
        traceFileId: cite.traceFileId,
        steps: [
          {
            key: stepKey,
            investigationId: cite.investigationId,
            evidenceId: cite.evidenceId,
            stepLabel,
          },
        ],
      });
      continue;
    }
    if (lookedUp && existing.traceLabel !== lookedUp) {
      existing.traceLabel = lookedUp;
    } else if (!existing.traceLabel.includes(".json") && traceLabel.includes(".json")) {
      existing.traceLabel = traceLabel;
    }
    if (!existing.steps.some((step) => step.key === stepKey)) {
      existing.steps.push({
        key: stepKey,
        investigationId: cite.investigationId,
        evidenceId: cite.evidenceId,
        stepLabel,
      });
    }
  }
  return [...groups.values()].map((group) => ({
    ...group,
    steps: [...group.steps].sort((a, b) => a.stepLabel.localeCompare(b.stepLabel)),
  }));
}

function componentIdsInText(
  text: string,
  toolGroups: Map<string, string>,
): string[] {
  const ids = new Set<string>();
  for (const [tool, groupId] of toolGroups) {
    if (text.includes(tool)) {
      ids.add(groupId);
    }
  }
  return [...ids];
}

function collectMaliciousCites(
  investigations: Investigation[],
  toolGroups: Map<string, string>,
): Map<string, MaliciousCite[]> {
  const byComponent = new Map<string, MaliciousCite[]>();
  for (const investigation of investigations) {
    if (investigation.verdict !== "malicious") {
      continue;
    }
    for (const result of investigation.results) {
      const blob = [
        result.excerpt,
        result.pattern,
        result.description,
        result.type,
        result.where,
        ...(result.anomalies ?? []),
      ]
        .filter(Boolean)
        .join(" ");
      const ids = componentIdsInText(blob, toolGroups);
      if (ids.length === 0) {
        continue;
      }
      const cite: MaliciousCite = {
        investigationId: investigation.id,
        investigationName: investigation.name || "Investigation",
        applicationId: investigation.applicationId,
        evidenceId: result.id,
        where: citeWhere(result),
        action: citeAction(result),
        traceFileId: investigation.traceFileId,
        traceLabel: citeTraceLabel(investigation),
      };
      for (const id of ids) {
        if (id === "user") {
          continue;
        }
        const current = byComponent.get(id) ?? [];
        const stepKey = citeStepLabel(cite.where).toLowerCase();
        const duplicate = current.some(
          (row) =>
            citeTraceKey(row) === citeTraceKey(cite) &&
            citeStepLabel(row.where).toLowerCase() === stepKey,
        );
        if (!duplicate) {
          current.push(cite);
          byComponent.set(id, current);
        }
      }
    }
  }
  return byComponent;
}

function citesFor(
  map: Map<string, MaliciousCite[]>,
  id: string,
): MaliciousCite[] {
  return map.get(id) ?? [];
}

function toolRowCounts(count: number, maxCols = 4): number[] {
  if (count <= 0) {
    return [];
  }
  if (count <= maxCols) {
    return [count];
  }
  const rows = Math.ceil(count / maxCols);
  const base = Math.floor(count / rows);
  const extra = count % rows;
  return Array.from({ length: rows }, (_, index) =>
    base + (index < extra ? 1 : 0),
  );
}

function layoutVertical(nodes: GraphNodeInput[]): LaidOutNode[] {
  const user = nodes.find((node) => node.kind === "user");
  const agent = nodes.find((node) => node.kind === "agent");
  const tools = nodes.filter((node) => node.kind === "tool");
  const gapX = 108;
  const gapY = 116;
  const padX = 52;
  const padY = 48;
  const counts = toolRowCounts(tools.length, 4);
  const cols = Math.max(1, ...counts, 1);
  const contentWidth = Math.max(0, cols - 1) * gapX;
  const cx = padX + contentWidth / 2;
  const laid: LaidOutNode[] = [];
  let y = padY;

  if (user) {
    laid.push({ ...user, x: cx, y, r: 18 });
    y += gapY;
  }
  if (agent) {
    laid.push({ ...agent, x: cx, y, r: 20 });
    y += gapY;
  }

  let index = 0;
  for (let row = 0; row < counts.length; row += 1) {
    const count = counts[row];
    const rowWidth = Math.max(0, count - 1) * gapX;
    const startX = cx - rowWidth / 2;
    for (let col = 0; col < count; col += 1) {
      const tool = tools[index];
      index += 1;
      if (!tool) {
        break;
      }
      laid.push({ ...tool, x: startX + col * gapX, y, r: 18 });
    }
    y += gapY;
  }

  return laid;
}

function layoutHorizontal(nodes: GraphNodeInput[]): LaidOutNode[] {
  const user = nodes.find((node) => node.kind === "user");
  const agent = nodes.find((node) => node.kind === "agent");
  const tools = nodes.filter((node) => node.kind === "tool");
  const spineGap = 108;
  const toolGapX = 108;
  const gapY = 124;
  const padX = 52;
  const padY = 52;
  const counts = toolRowCounts(tools.length, 4);
  const rows = Math.max(1, counts.length);
  const cy = padY + Math.max(0, rows - 1) * (gapY / 2);
  const laid: LaidOutNode[] = [];
  let x = padX;

  if (user) {
    laid.push({ ...user, x, y: cy, r: 18 });
    x += spineGap;
  }
  if (agent) {
    laid.push({ ...agent, x, y: cy, r: 20 });
    x += spineGap;
  }

  let index = 0;
  const toolOrigin = x;
  for (let row = 0; row < counts.length; row += 1) {
    const count = counts[row];
    const rowY =
      rows === 1 ? cy : cy + (row - (rows - 1) / 2) * gapY;
    for (let col = 0; col < count; col += 1) {
      const tool = tools[index];
      index += 1;
      if (!tool) {
        break;
      }
      laid.push({
        ...tool,
        x: toolOrigin + col * toolGapX,
        y: rowY,
        r: 18,
      });
    }
  }

  return laid;
}

type GraphLayoutMode = "compact" | "flow" | "horizontal" | "vertical";

function layoutNodes(
  nodes: GraphNodeInput[],
  mode: GraphLayoutMode = "flow",
): LaidOutNode[] {
  if (mode === "vertical") {
    return layoutVertical(nodes);
  }
  if (mode === "horizontal") {
    return layoutHorizontal(nodes);
  }
  if (mode === "compact") {
    const gapX = 96;
    const gapY = 104;
    const cols = Math.min(nodes.length, 5);
    return nodes.map((node, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const count = Math.min(cols, nodes.length - row * cols);
      const rowWidth = (count - 1) * gapX;
      return {
        ...node,
        x: 48 + (cols - 1) * gapX / 2 - rowWidth / 2 + col * gapX,
        y: 40 + row * gapY,
        r: node.kind === "agent" ? 20 : 18,
      };
    });
  }

  const user = nodes.find((node) => node.kind === "user");
  const agent = nodes.find((node) => node.kind === "agent");
  const tools = nodes.filter((node) => node.kind === "tool");
  const height = 304;
  const gapX = 112;
  const gapY = 112;
  const laid: LaidOutNode[] = [];

  if (user) {
    laid.push({ ...user, x: 56, y: height / 2, r: 18 });
  }
  if (agent) {
    laid.push({ ...agent, x: 156, y: height / 2, r: 20 });
  }
  tools.forEach((tool, index) => {
    const col = Math.floor(index / 3);
    const row = index % 3;
    const rows = Math.min(3, tools.length - col * 3);
    const blockHeight = (rows - 1) * gapY;
    laid.push({
      ...tool,
      x: 272 + col * gapX,
      y: height / 2 - blockHeight / 2 + row * gapY,
      r: 18,
    });
  });

  return laid;
}

function graphSize(
  nodes: LaidOutNode[],
  mode: GraphLayoutMode,
): { width: number; height: number } {
  if (nodes.length === 0) {
    return { width: 420, height: mode === "compact" ? 72 : 180 };
  }
  const labelReserve =
    mode === "compact" ? 22 : mode === "horizontal" ? 48 : 40;
  const minX = Math.min(...nodes.map((node) => node.x - node.r));
  const maxX = Math.max(...nodes.map((node) => node.x + node.r));
  const maxY = Math.max(...nodes.map((node) => node.y + node.r + labelReserve));
  const minY = Math.min(...nodes.map((node) => node.y - node.r));
  const padX = Math.max(28, minX > 0 ? minX : 28);
  const minWidth =
    mode === "compact"
      ? 320
      : mode === "horizontal"
        ? 480
        : mode === "vertical"
          ? 280
          : 420;
  const minHeight =
    mode === "compact"
      ? 80
      : mode === "horizontal"
        ? 148
        : mode === "vertical"
          ? 200
          : 168;
  return {
    width: Math.max(minWidth, maxX + padX),
    height: Math.max(minHeight, maxY - Math.min(0, minY) + 16),
  };
}

export function buildAppComponentGraph(
  app: Pick<Application, "id" | "name">,
  _investigations?: Investigation[],
): LaidOutGraph {
  const nodes = [
    nodeForId("user", "User"),
    nodeForId("agent", "Agentic App"),
    ...getApplicationToolGroups(app).map((group) => ({
      ...nodeForId(group.id, group.name),
      tools: group.tools,
    })),
  ].map((node) => ({
    ...node,
    calls: 0,
    cites: [] as MaliciousCite[],
    malicious: false,
    undeclared: false,
  }));
  const laid = layoutNodes(nodes, "horizontal");
  const size = graphSize(laid, "horizontal");
  const edges: ComponentEdge[] = [
    { from: "user", to: "agent", count: 1, malicious: false },
  ];
  for (const node of nodes) {
    if (node.kind === "tool") {
      edges.push({ from: "agent", to: node.id, count: 1, malicious: false });
    }
  }
  return {
    width: size.width,
    height: size.height,
    nodes: laid,
    edges,
  };
}

export function buildTraceComponentGraph(
  events: VisualizerEvent[],
  investigations: Investigation[] = [],
  mode: "flow" | "horizontal" | "vertical" = "flow",
  options: { omitAgent?: boolean; app?: ManifestApp } = {},
): LaidOutGraph {
  const omitAgent = Boolean(options.omitAgent);
  const toolGroups = buildToolGroupIndex(options.app);
  const cites = collectMaliciousCites(investigations, toolGroups);
  const toolsByComponent = new Map<string, Set<string>>();
  const calls = new Map<string, number>();
  const edges = new Map<string, ComponentEdge>();
  calls.set("user", 0);
  if (!omitAgent) {
    calls.set("agent", 0);
  }

  for (const event of events) {
    if (event.kind === "user") {
      calls.set("user", (calls.get("user") ?? 0) + 1);
      continue;
    }
    if (event.kind === "assistant" || event.kind === "reasoning") {
      if (!omitAgent) {
        addEdge(edges, "user", "agent", false);
        calls.set("agent", (calls.get("agent") ?? 0) + 1);
      }
      continue;
    }
    const names = event.toolNames.filter(
      (name) => Boolean(name) && !isIgnoredTool(name),
    );
    if (names.length === 0) {
      continue;
    }
    for (const name of names) {
      const id = toolGroups.get(name) ?? UNDECLARED_GROUP_ID;
      if (!toolsByComponent.has(id)) {
        toolsByComponent.set(id, new Set());
      }
      toolsByComponent.get(id)!.add(name);
      calls.set(id, (calls.get(id) ?? 0) + 1);
      // Only the agentic app can reach a tool: never link one component to another.
      if (!omitAgent) {
        addEdge(
          edges,
          "agent",
          id,
          cites.has(id) || id === UNDECLARED_GROUP_ID,
        );
      }
    }
  }

  if (
    !omitAgent &&
    !edges.has("user>agent") &&
    (calls.get("user") ?? 0) + (calls.get("agent") ?? 0) > 0
  ) {
    addEdge(edges, "user", "agent", false);
  }

  const nodes = [
    {
      ...nodeForId("user", "User"),
      calls: calls.get("user") ?? 0,
      malicious: false,
      undeclared: false,
      cites: [] as MaliciousCite[],
    },
    ...(omitAgent
      ? []
      : [
          {
            ...nodeForId("agent", "Agentic App"),
            calls: calls.get("agent") ?? 0,
            cites: citesFor(cites, "agent"),
            malicious: cites.has("agent"),
            undeclared: false,
          },
        ]),
    ...[...toolsByComponent.entries()].map(([id, tools]) => ({
      ...nodeForId(id, getToolGroupLabel(options.app, id)),
      tools: [...tools],
      calls: calls.get(id) ?? 0,
      cites: citesFor(cites, id),
      malicious: cites.has(id),
      undeclared: id === UNDECLARED_GROUP_ID,
    })),
  ];
  const laid = layoutNodes(nodes, mode);
  const size = graphSize(laid, mode);
  return {
    width: size.width,
    height: size.height,
    nodes: laid,
    edges: [...edges.values()].filter(
      (edge) =>
        !omitAgent || (edge.from !== "agent" && edge.to !== "agent"),
    ),
  };
}
