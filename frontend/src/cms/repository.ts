import applicationsJson from "../content/applications.json";
import investigationsJson from "../content/investigations.json";
import memoryStatusJson from "../content/memory-status.json";
import tracesJson from "../content/traces.json";
import bankTransferTraceJson from "../content/trace-content/trace-bank-transfer-001.json";
import calendarTraceJson from "../content/trace-content/trace-calendar-001.json";
import investigationsExportJson from "../../../preload_artifacts/investigations_export.json";
import type { Application } from "../utils/applicationStore";
import { adaptDetectiveEvidence, extractStage1 } from "../utils/detectiveResult";
import type { Investigation } from "../utils/investigationStore";
import type { TraceContent, TraceManagerRow } from "../utils/api";
import { isCannedTrace } from "../utils/cannedTraceIds";
import { simulationStore } from "./simulationStore";
import { appVisibilityStore } from "./appVisibility";

interface CmsApplication {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

export interface CmsInvestigation
  extends Omit<Investigation, "createdAt" | "startedAt" | "completedAt"> {
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

interface CmsTrace {
  traceFileId: string;
  traceName: string;
  appId: string | null;
  appName: string | null;
  latestLabel: "malicious" | "benign" | null;
  latestInvestigationId: string | null;
  latestStatus: "completed" | "pending" | "started" | "failed" | null;
  latestAnalyzedAt: string | null;
  investigationsCount: number;
  submittedAt: string;
}

interface CmsMemoryStatus {
  appId: string;
  techniques: {
    evoguard: boolean;
  };
}

interface PreloadInvestigation {
  id: string;
  app_id: string;
  trace_file_id: string;
  name: string;
  technique: string;
  status: "completed" | "pending" | "started" | "failed";
  result: unknown;
  memory_readiness?: boolean;
  readiness_score?: number | null;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

interface PreloadTrace {
  trace_file_id: string;
  trace_name: string;
  app_id: string;
  app_name: string;
  latest_label: "malicious" | "benign" | null;
  investigations_count: number;
  submitted_at: string;
}

// A trace/investigation pair seeded from preload_artifacts that hasn't been "run" by the
// user yet. It becomes a real completed investigation once `startSimulatedRun` fires.
export interface SimulatedPoolEntry {
  traceFileId: string;
  traceName: string;
  appId: string;
  appName: string;
  submittedAt: string;
  traceContentFile: string;
  investigation: CmsInvestigation;
}

export type ApplicationTechniqueReadiness = CmsMemoryStatus["techniques"];

const applications = applicationsJson as CmsApplication[];
const traces = tracesJson as CmsTrace[];

// Traces the demo carries as recordings: a debate that was run and taped, with
// no investigation behind it and nothing in the preload artifacts to match.
const RECORDED_TRACE_IDS = new Set(["trace-code-panel-001"]);
const memoryStatuses = memoryStatusJson as CmsMemoryStatus[];
const fallbackInvestigations = investigationsJson as CmsInvestigation[];

// The preload dumps are global (every app in one file), so map each backend app id
// to its frontend application and select records by that id rather than by file.
const BACKEND_TO_FRONTEND_APP: Record<string, string> = {
  "ea13e259-502e-4e0b-823b-a7cc19630b30": "app-bank-transfer",
  "0b6ac904-d491-4cb4-a73e-1ed4123c91d6": "app-calendar",
  "4ed044e7-da91-4ce3-b7d6-72ebfdf3a42e": "app-american-airlines",
  "713a9802-c152-4865-a064-53cf97af7fd4": "app-spam-filtering",
  "c1d6d8d3-faed-4772-b732-34373ace933c": "app-bank-transfer",
  "f14bd423-c4ab-467a-b476-3da6c9e1b3ee": "app-calendar",
  "8f53ce3c-c8a7-4b28-bbce-ef570a65c8cb": "app-american-airlines",
};

// Curated demo results are sourced from the exported investigations. Each entry's
// `name` embeds the app and trace, e.g. "Evoguard · Bank Transfer · malicious_2bc228d40820".
interface ExportInvestigation {
  id: string;
  app_id: string;
  trace_file_id: string;
  trace_original_filename?: string;
  technique: string;
  name: string;
  status: string;
  result: unknown;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

const APP_NAME_TO_FRONTEND_APP: Record<string, string> = {
  Calendar: "app-calendar",
  "Bank Transfer": "app-bank-transfer",
  "American Airlines": "app-american-airlines",
  "Spam Filtering": "app-spam-filtering",
};

// Parse the app name and trace file from an exported investigation `name`.
function parseExportName(name: string): { appName: string; traceName: string } | null {
  const segments = name.split("·").map((segment) => segment.trim());
  if (segments.length < 2) {
    return null;
  }
  const appName = segments[segments.length - 2];
  const traceStem = segments[segments.length - 1];
  if (!appName || !traceStem) {
    return null;
  }
  return { appName, traceName: `${traceStem}.json` };
}

const DEFAULT_PRELOAD_TRACE_BY_APP: Record<string, string> = {
  "app-bank-transfer": "malicious_bfe15401bce1.json",
  "app-calendar": "malicious_cb1d5395e1f3.json",
  "app-american-airlines": "malicious_350faa9d00f2.json",
  "app-spam-filtering": "malicious_be4ef6c26357.json",
};

const traceContentById: Record<string, TraceContent> = {
  "trace-bank-transfer-001": {
    ...(bankTransferTraceJson as Omit<TraceContent, "createdAtMs"> & { createdAt: string }),
    createdAtMs: new Date(bankTransferTraceJson.createdAt).getTime(),
  },
  "trace-calendar-001": {
    ...(calendarTraceJson as Omit<TraceContent, "createdAtMs"> & { createdAt: string }),
    createdAtMs: new Date(calendarTraceJson.createdAt).getTime(),
  },
};

// Simulated pool trace conversations are lazily bundled by Vite from trace-content/pool/*.json.
const poolTraceContentModules = import.meta.glob<{
  default: Omit<TraceContent, "createdAtMs"> & { createdAt: string };
}>("../content/trace-content/pool/*.json", { eager: true });

const preloadTraceModules = import.meta.glob<{
  default: {
    id: string;
    conversation: TraceContent["conversation"];
  };
}>("../../../preload_artifacts/*/evoguard/traces/*.json", { eager: true });

const poolTraceContentByFile: Record<
  string,
  Omit<TraceContent, "createdAtMs"> & { createdAt: string }
> = {};
for (const [modulePath, mod] of Object.entries(poolTraceContentModules)) {
  const fileName = modulePath.split("/").pop() ?? modulePath;
  poolTraceContentByFile[`pool/${fileName}`] = mod.default;
}

const preloadTraceContentByFilename: Record<
  string,
  { conversation: TraceContent["conversation"]; id: string }
> = {};
for (const [modulePath, mod] of Object.entries(preloadTraceModules)) {
  const fileName = modulePath.split("/").pop() ?? modulePath;
  preloadTraceContentByFilename[fileName] = mod.default;
}

const poolTraceContentByOriginalFilename: Record<
  string,
  Omit<TraceContent, "createdAtMs"> & { createdAt: string }
> = {};
for (const content of Object.values(poolTraceContentByFile)) {
  poolTraceContentByOriginalFilename[content.originalFilename] = content;
}

function poolRunStatus(traceFileId: string): "pending" | "started" | "completed" | null {
  return simulationStore.get(traceFileId)?.status ?? null;
}

function timestamp(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toApplication(
  application: CmsApplication,
  pendingApplicationIds: Set<string>,
): Application {
  const readiness = memoryStatuses.find((status) => status.appId === application.id);
  return {
    id: application.id,
    name: application.name,
    description: application.description,
    createdAt: new Date(application.createdAt).getTime(),
    investigationStatus: pendingApplicationIds.has(application.id) ? "running" : "idle",
    memoryReadinessByTechnique: {
      evoguard: readiness?.techniques.evoguard ? 100 : 0,
    },
  };
}

function tryParseJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function extractResultDetails(result: unknown): {
  description?: string;
  modelReasoning?: string;
  results?: Investigation["results"];
  verdict?: Investigation["verdict"];
  model?: string;
  durationSeconds?: number;
  token?: number;
} {
  const parsed = tryParseJson(result);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {};
  }

  const raw = parsed as Record<string, unknown>;
  const stage1 = extractStage1(parsed);
  const results = adaptDetectiveEvidence(
    Array.isArray(raw.evidence) ? raw.evidence : undefined,
  );
  const label = raw.label;

  return {
    description:
      typeof raw.result === "string"
        ? raw.result
        : stage1?.summary ?? undefined,
    modelReasoning: stage1?.reasoning,
    results: results.length > 0 ? results : undefined,
    verdict:
      label === "malicious" || label === "benign" || label === "error"
        ? label
        : undefined,
    model: typeof raw.model === "string" ? raw.model : undefined,
    durationSeconds:
      typeof raw.duration === "number" ? raw.duration : undefined,
    token: typeof raw.token === "number" ? raw.token : undefined,
  };
}

function toInvestigation(investigation: CmsInvestigation): Investigation {
  const raw = investigation as CmsInvestigation & {
    result?: unknown;
    modelReasoning?: string;
    description?: string;
  };

  const parsedResultDetails = extractResultDetails(raw.result);
  const description = parsedResultDetails.description ?? raw.description ?? undefined;
  const modelReasoning = parsedResultDetails.modelReasoning ?? raw.modelReasoning ?? undefined;
  const results = parsedResultDetails.results ?? [];

  return {
    ...investigation,
    description,
    modelReasoning,
    results,
    verdict: parsedResultDetails.verdict ?? investigation.verdict,
    model: raw.model ?? parsedResultDetails.model ?? investigation.model,
    durationSeconds:
      raw.durationSeconds ?? parsedResultDetails.durationSeconds ?? investigation.durationSeconds,
    token: raw.token ?? parsedResultDetails.token ?? investigation.token,
    createdAt: new Date(investigation.createdAt).getTime(),
    startedAt: timestamp(investigation.startedAt),
    completedAt: timestamp(investigation.completedAt),
  };
}

function toPreloadInvestigation(
  sourceAppId: string,
  raw: PreloadInvestigation,
  trace: PreloadTrace,
): CmsInvestigation {
  const app = applications.find((application) => application.id === sourceAppId);
  const details = extractResultDetails(raw.result);
  // The export names embed the backend app name; show the frontend one instead.
  const nameSegments = raw.name.split("·").map((segment) => segment.trim());
  if (app && nameSegments.length >= 2) {
    nameSegments[nameSegments.length - 2] = app.name;
  }
  return {
    id: raw.id,
    trace_id: `trace-${raw.id.slice(0, 8)}`,
    traceFileId: trace.trace_file_id,
    applicationId: sourceAppId,
    name: nameSegments.join(" · "),
    technique: raw.technique,
    createdAt: raw.created_at,
    startedAt: raw.started_at,
    completedAt: raw.completed_at,
    status: raw.status,
    description: details.description,
    modelReasoning: details.modelReasoning,
    results: details.results ?? [],
    verdict: details.verdict ?? "error",
    model: details.model,
    durationSeconds: details.durationSeconds,
    token: details.token,
    memoryReadiness: raw.memory_readiness,
    readinessScore: raw.readiness_score,
    appName: app?.name,
    result: raw.result,
  } as CmsInvestigation;
}

function buildCanonicalRunEntries(): SimulatedPoolEntry[] {
  const entries: SimulatedPoolEntry[] = [];
  const seenTraceIds = new Set<string>();
  for (const raw of investigationsExportJson as ExportInvestigation[]) {
    const parsedName = parseExportName(raw.name);
    const backendAppId = BACKEND_TO_FRONTEND_APP[raw.app_id];
    const namedAppId = parsedName && APP_NAME_TO_FRONTEND_APP[parsedName.appName];
    const frontendAppId = backendAppId ?? namedAppId;
    const appName = applications.find((app) => app.id === frontendAppId)?.name;
    const traceName = raw.trace_original_filename ?? parsedName?.traceName;
    if (!appName || !traceName || (backendAppId && namedAppId && backendAppId !== namedAppId)) {
      continue;
    }
    // Only surface the curated canned traces across every view.
    if (!frontendAppId || !isCannedTrace(traceName)) {
      continue;
    }
    if (seenTraceIds.has(raw.trace_file_id)) {
      continue;
    }
    seenTraceIds.add(raw.trace_file_id);
    const trace: PreloadTrace = {
      trace_file_id: raw.trace_file_id,
      trace_name: traceName,
      app_id: raw.app_id,
      app_name: appName,
      submitted_at: raw.created_at,
    } as PreloadTrace;
    const content = poolTraceContentByOriginalFilename[traceName];
    const investigation = toPreloadInvestigation(
      frontendAppId,
      raw as unknown as PreloadInvestigation,
      trace,
    );
    entries.push({
      traceFileId: raw.trace_file_id,
      traceName,
      appId: frontendAppId,
      appName: applications.find((app) => app.id === frontendAppId)?.name ?? appName,
      submittedAt: raw.created_at,
      traceContentFile: content?.traceFileId
        ? `pool/${content.traceFileId}.json`
        : "",
      investigation,
    });
  }
  return entries;
}

const canonicalRunEntries = buildCanonicalRunEntries();

// One deterministic run per app is visible immediately; the rest are delayed. Prefer the
// configured default trace name when it exists, otherwise fall back to the first record.
const canonicalInitialTraceIds = new Set(
  Object.keys(BACKEND_TO_FRONTEND_APP)
    .map((backendId) => BACKEND_TO_FRONTEND_APP[backendId])
    .map((frontendAppId) => {
      const appEntries = canonicalRunEntries.filter((entry) => entry.appId === frontendAppId);
      if (appEntries.length === 0) {
        return undefined;
      }
      const preferredName = DEFAULT_PRELOAD_TRACE_BY_APP[frontendAppId];
      const preferred = appEntries.find((entry) => entry.traceName === preferredName);
      return (preferred ?? appEntries[0]).traceFileId;
    })
    .filter((traceFileId): traceFileId is string => Boolean(traceFileId)),
);

function canonicalPoolEntries(): SimulatedPoolEntry[] {
  return canonicalRunEntries.filter(
    (entry) => !canonicalInitialTraceIds.has(entry.traceFileId),
  );
}

export function getCanonicalSimulatedRunEntry(
  traceFileId: string,
): SimulatedPoolEntry | undefined {
  return canonicalPoolEntries().find((entry) => entry.traceFileId === traceFileId);
}

export function getCanonicalSimulatedRunEntryByInvestigationId(
  investigationId: string,
): SimulatedPoolEntry | undefined {
  return canonicalPoolEntries().find(
    (entry) => entry.investigation.id === investigationId,
  );
}

export function isCanonicalSimulatedTrace(traceFileId: string): boolean {
  return getCanonicalSimulatedRunEntry(traceFileId) !== undefined;
}

function toTrace(trace: CmsTrace): TraceManagerRow {
  return {
    traceFileId: trace.traceFileId,
    traceName: trace.traceName,
    appId: trace.appId,
    appName: trace.appName,
    latestLabel: trace.latestLabel,
    latestInvestigationId: trace.latestInvestigationId,
    latestStatus: trace.latestStatus,
    latestAnalyzedAtMs: timestamp(trace.latestAnalyzedAt) ?? null,
    investigationsCount: trace.investigationsCount,
    submittedAtMs: timestamp(trace.submittedAt) ?? 0,
  };
}

function findOrThrow<T>(items: T[], predicate: (item: T) => boolean, message: string): T {
  const item = items.find(predicate);
  if (!item) throw new Error(message);
  return item;
}

function matchesDefaultPreloadTraceName(value: string | null | undefined, appId: string): boolean {
  const preferred = DEFAULT_PRELOAD_TRACE_BY_APP[appId];
  if (!preferred || !value) {
    return false;
  }
  return value.toLowerCase().includes(preferred.toLowerCase());
}

function sortPreloadedFirst<T extends { applicationId?: string; appId?: string | null; traceName?: string | null; name?: string | null }>(
  rows: T[],
): T[] {
  return [...rows].sort((left, right) => {
    const leftAppId = left.applicationId ?? left.appId ?? "";
    const rightAppId = right.applicationId ?? right.appId ?? "";

    const leftScoped = matchesDefaultPreloadTraceName(
      left.traceName ?? left.name ?? null,
      leftAppId,
    );
    const rightScoped = matchesDefaultPreloadTraceName(
      right.traceName ?? right.name ?? null,
      rightAppId,
    );

    if (leftScoped !== rightScoped) {
      return leftScoped ? -1 : 1;
    }

    return 0;
  });
}

export const cmsRepository = {
  async listAllApplications(): Promise<Application[]> {
    const pendingApplicationIds = new Set(
      canonicalRunEntries
        .map((entry) => entry.investigation)
        .filter((investigation) => investigation.status === "pending" || investigation.status === "started")
        .map((investigation) => investigation.applicationId),
    );
    for (const entry of canonicalPoolEntries()) {
      const status = poolRunStatus(entry.traceFileId);
      if (status === "pending" || status === "started") {
        pendingApplicationIds.add(entry.appId);
      }
    }
    return applications.map((application) => toApplication(application, pendingApplicationIds));
  },

  async listApplications(): Promise<Application[]> {
    const all = await cmsRepository.listAllApplications();
    return all.filter((application) => appVisibilityStore.isVisible(application.id));
  },

  async listInvestigations(appId?: string): Promise<Investigation[]> {
    const baked = sortPreloadedFirst(
      canonicalRunEntries.filter((entry) => canonicalInitialTraceIds.has(entry.traceFileId))
        .map((entry) => entry.investigation),
    )
      .filter((investigation) => !appId || investigation.applicationId === appId)
      .map(toInvestigation);
    const fallback = canonicalRunEntries.length === 0
      ? sortPreloadedFirst(fallbackInvestigations)
          .filter((investigation) => !appId || investigation.applicationId === appId)
          .map(toInvestigation)
      : [];
    const revealed = canonicalPoolEntries()
      .filter((entry) => !appId || entry.appId === appId)
      .map((entry) => {
        const record = simulationStore.get(entry.traceFileId);
        if (!record) return null; // not triggered yet; don't show as an investigation

        // Timestamps reflect the actual demo interaction, not the historical preload data.
        const triggeredAtIso = new Date(record.triggeredAt).toISOString();
        const startedAtIso =
          record.status === "completed" || record.status === "started"
            ? new Date(record.scheduledStartedAt).toISOString()
            : undefined;
        const completedAtIso =
          record.status === "completed"
            ? new Date(record.scheduledCompletedAt).toISOString()
            : undefined;

        return toInvestigation({
          ...entry.investigation,
          status: record.status,
          createdAt: triggeredAtIso,
          startedAt: startedAtIso,
          completedAt: completedAtIso,
        });
      })
      .filter((investigation): investigation is Investigation => investigation !== null);
    return [...(baked.length > 0 ? baked : fallback), ...revealed].filter(
      (investigation) => appVisibilityStore.isVisible(investigation.applicationId),
    );
  },

  async listTraceManagerRows(): Promise<TraceManagerRow[]> {
    const canonicalRows = canonicalRunEntries.map((entry) => {
      const record = simulationStore.get(entry.traceFileId);
      const initial = canonicalInitialTraceIds.has(entry.traceFileId);
      const status = initial ? "completed" : record?.status ?? null;
      const completed = initial || status === "completed";
      const investigation = toInvestigation(entry.investigation);
      return toTrace({
        traceFileId: entry.traceFileId,
        traceName: entry.traceName,
        appId: entry.appId,
        appName: entry.appName,
        latestLabel: completed && investigation.verdict !== "error"
          ? investigation.verdict
          : null,
        latestInvestigationId: completed ? investigation.id : null,
        latestStatus: status,
        latestAnalyzedAt:
          completed
            ? record
              ? new Date(record.scheduledCompletedAt).toISOString()
              : investigation.completedAt
                ? new Date(investigation.completedAt).toISOString()
                : null
            : null,
        investigationsCount: completed ? 1 : 0,
        submittedAt: entry.submittedAt,
      });
    });
    // The preload rows stand in for the whole trace list when they are there,
    // which would drop the traces that are a recording in their own right
    // rather than a stand-in for one. Those come from the content either way.
    const recorded = traces
      .filter((trace) => RECORDED_TRACE_IDS.has(trace.traceFileId))
      .map(toTrace);
    const rows =
      canonicalRows.length > 0
        ? [...canonicalRows, ...recorded]
        : traces.map(toTrace);
    return rows.filter((row) => !row.appId || appVisibilityStore.isVisible(row.appId));
  },

  async getTraceContent(traceFileId: string): Promise<TraceContent> {
    const baked = traceContentById[traceFileId];
    if (baked) return baked;

    const poolEntry = canonicalRunEntries.find((entry) => entry.traceFileId === traceFileId);
    const preloadTrace = poolEntry && preloadTraceContentByFilename[poolEntry.traceName];
    if (preloadTrace) {
      return {
        traceFileId,
        originalFilename: poolEntry.traceName,
        appId: poolEntry.appId,
        createdAtMs: new Date(poolEntry.submittedAt).getTime(),
        conversation: preloadTrace.conversation,
      };
    }

    const rawPoolContent = poolEntry && poolTraceContentByFile[poolEntry.traceContentFile];
    if (rawPoolContent) {
      return {
        ...rawPoolContent,
        createdAtMs: new Date(rawPoolContent.createdAt).getTime(),
      };
    }

    const canonicalContent = poolEntry &&
      poolTraceContentByOriginalFilename[poolEntry.traceName];
    if (canonicalContent) {
      return {
        ...canonicalContent,
        traceFileId,
        createdAtMs: new Date(canonicalContent.createdAt).getTime(),
      };
    }

    const defaultContent = poolEntry && Object.values(traceContentById).find(
      (content) => content.originalFilename === poolEntry.traceName,
    );
    if (defaultContent) {
      return { ...defaultContent, traceFileId };
    }

    return findOrThrow(
      Object.values(traceContentById),
      (trace) => trace.traceFileId === traceFileId,
      `CMS trace content not found: ${traceFileId}`,
    );
  },

  async getApplicationMemoryStatus(appId: string): Promise<ApplicationTechniqueReadiness> {
    const status = memoryStatuses.find((entry) => entry.appId === appId);
    return status?.techniques ?? { evoguard: false };
  },
};
