/**
 * Typed API client for the Detective BFF.
 *
 * Base URL: in dev the Vite proxy rewrites "/api/*" → "http://localhost:8000/api/*".
 * In production set VITE_API_BASE_URL (e.g. "https://api.example.com") and
 * fetch calls will use that origin.
 */

import type { Application, InvestigationStatus } from "./applicationStore";
import { adaptDetectiveEvidence, extractStage1 } from "./detectiveResult";
import type { Investigation } from "./investigationStore";
import {
  clearAuthAccessToken,
  ensureFreshAuthAccessToken,
  getAuthAccessToken,
} from "./authToken";
import { getRuntimeConfig } from "./runtimeConfig";
import { isTechniqueId } from "./techniques";

// ── helpers ──────────────────────────────────────────────────────────────────

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function getBaseUrl(): string {
  return trimTrailingSlash(getRuntimeConfig().VITE_API_BASE_URL);
}

export type ErrorContext =
  | "auth"
  | "applications.load"
  | "applications.create"
  | "traces.load"
  | "traces.content"
  | "traces.upload"
  | "investigations.load"
  | "investigations.create"
  | "investigations.rerun"
  | "investigations.override"
  | "investigations.stream"
  | "investigations.cancel"
  | "generic";

export class ApiError extends Error {
  status: number;
  responseText: string;

  constructor(message: string, status: number, responseText: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.responseText = responseText;
  }
}

export const AUTH_FORCED_LOGOUT_EVENT = "detective:auth-forced-logout";

type ForcedLogoutReason = "user_not_allowed" | "unauthorized";

function dispatchForcedLogoutEvent(reason: ForcedLogoutReason): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(AUTH_FORCED_LOGOUT_EVENT, {
      detail: { reason },
    }),
  );
}

export interface AuthMeResponse {
  authenticated: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    role: "view" | "execute" | "admin";
  } | null;
}

export interface ManagedUser {
  email: string;
  username: string;
  role: "view" | "execute" | "admin";
  created_at: string;
}

export interface InvestigationStreamHeartbeat {
  type: "heartbeat";
}

export interface InvestigationStreamEvent {
  type: "event";
  event_id: string;
  event_type: string;
  app_id: string;
  investigation_id: string;
  status: "pending" | "started" | "completed" | "failed";
  timestamp: string;
  error?: string;
  result?: unknown;
}

export type InvestigationStreamMessage =
  | InvestigationStreamHeartbeat
  | InvestigationStreamEvent;

function parseApiDetail(responseText: string): string | null {
  if (!responseText) return null;
  const trimmed = responseText.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed) as { detail?: unknown };
    if (typeof parsed.detail === "string") {
      return parsed.detail;
    }
  } catch {
    // Not JSON, ignore.
  }

  return trimmed;
}

const DEFAULT_MESSAGES: Record<ErrorContext, string> = {
  auth: "We could not verify your sign-in. Please sign in again.",
  "applications.load":
    "We could not load applications right now. Please try again.",
  "applications.create":
    "We could not create the application. Please try again.",
  "investigations.load":
    "We could not load investigations right now. Please try again.",
  "traces.load":
    "We could not load traces right now. Please try again.",
  "traces.content":
    "We could not load this trace for preview. Please try again.",
  "traces.upload":
    "We could not upload the trace right now. Please try again.",
  "investigations.create":
    "We could not start the investigation. Please try again.",
  "investigations.rerun":
    "We could not re-run this investigation with the existing trace.",
  "investigations.override":
    "We could not update the verdict. Please try again.",
  "investigations.stream":
    "Live investigation updates were interrupted. Trying to reconnect may help.",
  "investigations.cancel":
    "We could not cancel the investigations started in this session.",
  generic: "Something went wrong. Please try again.",
};

export function toUserMessage(
  error: unknown,
  context: ErrorContext = "generic",
): string {
  if (error instanceof ApiError) {
    const detail = parseApiDetail(error.responseText);
    if (detail === "user_not_allowed") {
      return "Your account does not have access to this app. Please contact an administrator.";
    }
    if (detail?.toLowerCase().includes("missing on disk")) {
      return "The original trace file for this investigation is no longer available, so rerun cannot be started.";
    }

    if (error.status === 401) {
      return "Your session has expired. Please sign in again.";
    }
    if (error.status === 403) {
      return "You do not have permission to perform this action.";
    }
    if (error.status === 404) {
      return "The requested resource was not found.";
    }
    if (error.status === 409) {
      return "This action conflicts with the current state. Refresh and try again.";
    }
    if (error.status >= 500) {
      return "The server is unavailable right now. Please try again shortly.";
    }

    return DEFAULT_MESSAGES[context] ?? DEFAULT_MESSAGES.generic;
  }

  if (error instanceof TypeError) {
    return "Network connection issue. Please check your internet connection and try again.";
  }

  return DEFAULT_MESSAGES[context] ?? DEFAULT_MESSAGES.generic;
}

export function sanitizeInvestigationError(
  rawError: string | undefined,
): string {
  if (!rawError || rawError.trim().length === 0) {
    return "This investigation run failed before completing analysis.";
  }

  const lower = rawError.toLowerCase();
  if (
    lower.includes("traceback") ||
    lower.includes("exception") ||
    lower.includes("sql") ||
    rawError.length > 180
  ) {
    return "This investigation run failed before completing analysis. Please retry the run.";
  }

  return rawError;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  await ensureFreshAuthAccessToken();

  const buildHeaders = () => {
    const token = getAuthAccessToken();
    const headers = new Headers(init?.headers);
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    return headers;
  };

  const executeRequest = async () =>
    fetch(`${getBaseUrl()}${path}`, {
      ...init,
      headers: buildHeaders(),
    });

  let res = await executeRequest();
  if (res.status === 401) {
    const first401Text = await res.clone().text().catch(() => "");
    if (parseApiDetail(first401Text) === "user_not_allowed") {
      clearAuthAccessToken();
      dispatchForcedLogoutEvent("user_not_allowed");
      throw new ApiError(
        `BFF ${init?.method ?? "GET"} ${path} → ${res.status}: ${first401Text}`,
        res.status,
        first401Text,
      );
    }

    const refreshed = await ensureFreshAuthAccessToken({ forceRefresh: true });
    if (refreshed) {
      res = await executeRequest();
    }
  }

  if (res.status === 401) {
    const final401Text = await res.clone().text().catch(() => "");
    if (parseApiDetail(final401Text) === "user_not_allowed") {
      dispatchForcedLogoutEvent("user_not_allowed");
    } else {
      dispatchForcedLogoutEvent("unauthorized");
    }
    clearAuthAccessToken();
  }

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    if (parseApiDetail(text) === "user_not_allowed") {
      clearAuthAccessToken();
      dispatchForcedLogoutEvent("user_not_allowed");
    }
    throw new ApiError(
      `BFF ${init?.method ?? "GET"} ${path} → ${res.status}: ${text}`,
      res.status,
      text,
    );
  }

  // Some endpoints (for example DELETE /api/users/{email}) return 204 No Content.
  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return undefined as T;
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

// ── BFF raw shapes ────────────────────────────────────────────────────────────

interface BffApplication {
  id: string;
  name: string;
  description: string | null;
  created_at: string; // ISO-8601
}

interface BffInvestigation {
  id: string;
  app_id: string;
  trace_file_id: string | null;
  name: string;
  technique: string;
  status: string; // "pending" | "started" | "completed" | "failed"
  result: BffResult | string | null;
  memory_readiness?: boolean | null;
  readiness_score?: number | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

interface BffResult {
  label?: string; // "malicious" | "benign" | "error"
  description?: string;
  result?: string;
  evidence?: BffEvidence[];
  memory?: unknown;
  error?: string;
  model?: string;
  duration?: number;
  cost?: number | string;
  extra?: {
    execution?: {
      requested_technique?: string;
      effective_technique?: string;
      forced_baseline?: boolean;
      requested_memory_ready?: boolean;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface BffTraceManagerRow {
  trace_file_id: string;
  trace_name: string;
  app_id: string | null;
  app_name: string | null;
  latest_label: string | null;
  latest_investigation_id?: string | null;
  latest_status?: string | null;
  latest_analyzed_at?: string | null;
  investigations_count: number;
  submitted_at: string;
}

interface BffInvestigationAccepted {
  id: string;
  trace_file_id: string;
  status: string;
}

interface BffTraceAssociationAccepted {
  investigations: BffInvestigationAccepted[];
}

interface BffTraceFileOut {
  id: string;
  app_id: string | null;
  uploaded_by_email: string;
  original_filename: string;
  file_size_bytes: number;
  created_at: string;
}

interface BffTraceUploadAccepted {
  trace_files: BffTraceFileOut[];
}

export interface TraceUploadFile {
  id: string;
  appId: string | null;
  uploadedByEmail: string;
  originalFilename: string;
  fileSizeBytes: number;
  createdAtMs: number;
}

export interface TraceUploadAccepted {
  traceFiles: TraceUploadFile[];
}

export interface TraceManagerRow {
  traceFileId: string;
  traceName: string;
  appId: string | null;
  appName: string | null;
  latestLabel: "malicious" | "benign" | null;
  latestInvestigationId: string | null;
  latestStatus: "completed" | "pending" | "started" | "failed" | null;
  latestAnalyzedAtMs: number | null;
  investigationsCount: number;
  submittedAtMs: number;
}

export interface TraceConversationTurn {
  role?: string;
  content?: string | null;
  tool_calls?: string | unknown;
}

export interface TraceContent {
  traceFileId: string;
  originalFilename: string;
  appId: string | null;
  createdAtMs: number;
  conversation: TraceConversationTurn[];
}

interface BffEvidence {
  excerpt?: string;
  relevance?: string;
  type?: string;
  description?: string;
  pattern?: string;
  severity?: string;
  [key: string]: unknown;
}

function parseMaybeJson(value: unknown): unknown {
  let current = value;
  for (let i = 0; i < 2; i += 1) {
    if (typeof current !== "string") break;
    const text = current.trim();
    if (!text) return "";
    try {
      current = JSON.parse(text);
    } catch {
      return current;
    }
  }
  return current;
}

function normalizeResult(raw: BffInvestigation["result"]): BffResult | null {
  if (raw == null) return null;
  if (typeof raw === "object") return raw;
  const parsed = parseMaybeJson(raw);
  return parsed && typeof parsed === "object" ? (parsed as BffResult) : null;
}

function normalizeErrorMessage(value: unknown): string | undefined {
  if (value == null) return undefined;
  const parsed = parseMaybeJson(value);
  if (typeof parsed === "string") {
    const trimmed = parsed.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  try {
    return JSON.stringify(parsed);
  } catch {
    return String(parsed);
  }
}

function normalizeDescription(value: unknown): string | undefined {
  if (value == null) return undefined;
  const parsed = parseMaybeJson(value);
  if (typeof parsed === "string") {
    const trimmed = parsed.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return undefined;
}

function parseTimestamp(value: string | null): number | undefined {
  if (!value) return undefined;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : undefined;
}

function normalizeNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function normalizeText(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseInvestigationStreamMessage(
  data: unknown,
): InvestigationStreamMessage | null {
  if (typeof data !== "string") {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) {
    return null;
  }

  if (parsed.type === "heartbeat") {
    return { type: "heartbeat" };
  }

  if (
    typeof parsed.event_id !== "string" ||
    typeof parsed.event_type !== "string" ||
    typeof parsed.app_id !== "string" ||
    typeof parsed.investigation_id !== "string" ||
    typeof parsed.status !== "string" ||
    typeof parsed.timestamp !== "string"
  ) {
    return null;
  }

  if (
    parsed.status !== "pending" &&
    parsed.status !== "started" &&
    parsed.status !== "completed" &&
    parsed.status !== "failed"
  ) {
    return null;
  }

  return {
    type: "event",
    event_id: parsed.event_id,
    event_type: parsed.event_type,
    app_id: parsed.app_id,
    investigation_id: parsed.investigation_id,
    status: parsed.status,
    timestamp: parsed.timestamp,
    error: normalizeText(parsed.error),
    result: parsed.result,
  };
}

export function buildInvestigationsStreamUrl(params: {
  accessToken: string;
  appId?: string;
}): string {
  if (typeof window === "undefined") {
    throw new Error("WebSocket stream is only available in browser runtime");
  }

  // Open the WebSocket against the app's own origin instead of the public API
  // host. The same-origin request is proxied by the frontend nginx (prod) or
  // the Vite dev proxy (local) straight to the BFF, bypassing the public API
  // edge that strips the hop-by-hop Connection/Upgrade handshake headers.
  const origin = new URL(window.location.origin);
  const wsProtocol = origin.protocol === "https:" ? "wss:" : "ws:";
  const wsBase = `${wsProtocol}//${origin.host}`;
  const wsUrl = new URL("/api/investigations/stream/ws", wsBase);

  wsUrl.searchParams.set("access_token", params.accessToken);
  if (params.appId) {
    wsUrl.searchParams.set("app_id", params.appId);
  }

  return wsUrl.toString();
}

function adaptParsedInvestigationResult(
  parsedResult: BffResult | null,
  status: Investigation["status"],
  fallbackError?: unknown,
): Pick<
  Investigation,
  | "results"
  | "error"
  | "description"
  | "modelReasoning"
  | "memory"
  | "effectiveTechnique"
  | "executionMetadata"
  | "model"
  | "durationSeconds"
  | "cost"
  | "token"
  | "verdict"
> {
  const stage1 = extractStage1(parsedResult);
  const results = adaptDetectiveEvidence(parsedResult?.evidence);

  const error =
    status === "failed"
      ? normalizeErrorMessage(parsedResult?.error ?? fallbackError)
      : undefined;
  const description = normalizeDescription(
    stage1?.summary ?? parsedResult?.description ?? parsedResult?.result,
  );
  const durationSeconds = normalizeNumber(parsedResult?.duration);
  const model = normalizeText(parsedResult?.model);
  const cost =
    typeof parsedResult?.cost === "number" ||
    typeof parsedResult?.cost === "string"
      ? parsedResult.cost
      : undefined;
  const token = normalizeNumber(parsedResult?.token);
  const executionMetadata = parsedResult?.extra?.execution;
  const effectiveTechnique = normalizeText(
    executionMetadata?.effective_technique,
  );

  const verdict: Investigation["verdict"] =
    status === "failed"
      ? "error"
      : parsedResult?.label === "malicious"
        ? "malicious"
        : "benign";

  return {
    results,
    error,
    description,
    modelReasoning: stage1?.reasoning,
    memory: parsedResult?.memory as Investigation["memory"],
    effectiveTechnique,
    executionMetadata,
    model,
    durationSeconds,
    cost,
    token,
    verdict,
  };
}

export function adaptInvestigationResultFromStream(
  result: unknown,
  status: Investigation["status"],
): Pick<
  Investigation,
  | "results"
  | "error"
  | "description"
  | "modelReasoning"
  | "memory"
  | "effectiveTechnique"
  | "executionMetadata"
  | "model"
  | "durationSeconds"
  | "cost"
  | "token"
  | "verdict"
> {
  const parsedResult = normalizeResult(
    (result ?? null) as BffInvestigation["result"],
  );
  return adaptParsedInvestigationResult(parsedResult, status, result);
}

function normalizeInvestigationStatus(value: unknown): Investigation["status"] {
  if (
    value === "completed" ||
    value === "pending" ||
    value === "started" ||
    value === "failed"
  ) {
    return value;
  }
  return "completed";
}

// ── adapters ─────────────────────────────────────────────────────────────────

function adaptApplication(
  raw: BffApplication,
  pendingAppIds: Set<string>,
): Application {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description ?? "",
    createdAt: new Date(raw.created_at).getTime(),
    investigationStatus: pendingAppIds.has(raw.id)
      ? "running"
      : ("idle" as InvestigationStatus),
    memoryReadinessByTechnique: {
      evoguard: 0,
    },
  };
}

function adaptTraceManagerRow(raw: BffTraceManagerRow): TraceManagerRow {
  const label =
    raw.latest_label === "malicious"
      ? "malicious"
      : raw.latest_label === "benign"
        ? "benign"
        : null;
  const rawStatus = raw.latest_status?.trim().toLowerCase();
  const status =
    rawStatus === "completed" ||
    rawStatus === "pending" ||
    rawStatus === "started" ||
    rawStatus === "failed"
      ? rawStatus
      : null;
  const analyzedAt = raw.latest_analyzed_at
    ? new Date(raw.latest_analyzed_at).getTime()
    : NaN;

  return {
    traceFileId: raw.trace_file_id,
    traceName: raw.trace_name,
    appId: raw.app_id,
    appName: raw.app_name,
    latestLabel: label,
    latestInvestigationId: raw.latest_investigation_id ?? null,
    latestStatus: status,
    latestAnalyzedAtMs: Number.isFinite(analyzedAt) ? analyzedAt : null,
    investigationsCount: raw.investigations_count,
    submittedAtMs: new Date(raw.submitted_at).getTime(),
  };
}

function adaptTraceUploadAccepted(raw: BffTraceUploadAccepted): TraceUploadAccepted {
  return {
    traceFiles: raw.trace_files.map((row) => ({
      id: row.id,
      appId: row.app_id,
      uploadedByEmail: row.uploaded_by_email,
      originalFilename: row.original_filename,
      fileSizeBytes: row.file_size_bytes,
      createdAtMs: new Date(row.created_at).getTime(),
    })),
  };
}

function adaptInvestigation(raw: BffInvestigation): Investigation {
  const parsedResult = normalizeResult(raw.result);
  const status: Investigation["status"] = normalizeInvestigationStatus(
    raw.status,
  );
  const adapted = adaptParsedInvestigationResult(
    parsedResult,
    status,
    raw.result,
  );

  return {
    id: raw.id,
    trace_id: `trace-${raw.id.slice(0, 8)}`,
    traceFileId: raw.trace_file_id ?? undefined,
    applicationId: raw.app_id,
    name: raw.name,
    technique: raw.technique,
    effectiveTechnique: adapted.effectiveTechnique,
    executionMetadata: adapted.executionMetadata,
    description: adapted.description,
    modelReasoning: adapted.modelReasoning,
    status,
    error: adapted.error,
    results: adapted.results,
    verdict: adapted.verdict,
    createdAt: new Date(raw.created_at).getTime(),
    startedAt: parseTimestamp(raw.started_at),
    completedAt: parseTimestamp(raw.completed_at),
    memory: adapted.memory,
    memoryReadiness:
      raw.memory_readiness === null || raw.memory_readiness === undefined
        ? undefined
        : raw.memory_readiness,
    readinessScore:
      raw.readiness_score === null || raw.readiness_score === undefined
        ? undefined
        : raw.readiness_score,
    confidence: normalizeNumber(
      parsedResult?.confidence ?? parsedResult?.extra?.confidence,
    ),
    model: adapted.model,
    durationSeconds: adapted.durationSeconds,
    cost: adapted.cost,
    token: adapted.token,
  };
}

// ── public API ────────────────────────────────────────────────────────────────

export async function fetchApplications(): Promise<Application[]> {
  const apps = await request<BffApplication[]>("/api/applications");
  const pendingAppIds = new Set<string>();
  return apps.map((a) => adaptApplication(a, pendingAppIds));
}

export async function createApplication(values: {
  name: string;
  description: string;
}): Promise<Application> {
  const raw = await request<BffApplication>("/api/applications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: values.name,
      description: values.description,
    }),
  });
  return adaptApplication(raw, new Set());
}

export async function fetchInvestigations(params?: {
  appId?: string;
}): Promise<Investigation[]> {
  const qs = params?.appId ? `?app_id=${params.appId}` : "";
  const rows = await request<BffInvestigation[]>(`/api/investigations${qs}`);
  return rows.map(adaptInvestigation);
}

export async function fetchTraceManagerRows(): Promise<TraceManagerRow[]> {
  const rows = await request<BffTraceManagerRow[]>("/api/investigations/traces");
  return rows.map(adaptTraceManagerRow);
}

export async function fetchTraceContent(traceFileId: string): Promise<TraceContent> {
  const raw = await request<{
    trace_file_id: string;
    original_filename: string;
    app_id: string | null;
    created_at: string;
    conversation: TraceConversationTurn[];
  }>(`/api/investigations/traces/${encodeURIComponent(traceFileId)}`);

  return {
    traceFileId: raw.trace_file_id,
    originalFilename: raw.original_filename,
    appId: raw.app_id,
    createdAtMs: new Date(raw.created_at).getTime(),
    conversation: Array.isArray(raw.conversation) ? raw.conversation : [],
  };
}

export async function uploadTraceOnly(formData: FormData): Promise<TraceUploadAccepted> {
  const raw = await request<BffTraceUploadAccepted>("/api/investigations/traces", {
    method: "POST",
    body: formData,
  });
  return adaptTraceUploadAccepted(raw);
}

export async function fetchInvestigation(id: string): Promise<Investigation> {
  const raw = await request<BffInvestigation>(`/api/investigations/${id}`);
  return adaptInvestigation(raw);
}

export async function submitInvestigation(
  formData: FormData,
): Promise<{ id: string; trace_file_id: string; status: string }> {
  const technique = formData.get("technique");
  if (typeof technique !== "string" || !isTechniqueId(technique)) {
    throw new Error("Unsupported technique selected");
  }

  return request<{ id: string; trace_file_id: string; status: string }>(
    "/api/investigations",
    {
    method: "POST",
    body: formData, // multipart — do NOT set Content-Type header
    },
  );
}

export async function rerunInvestigationFromTrace(params: {
  appId: string;
  technique: string;
  traceFileId: string;
  namePrefix?: string;
}): Promise<{ id: string; trace_file_id: string; status: string }[]> {
  if (!isTechniqueId(params.technique)) {
    throw new Error("Unsupported technique selected");
  }

  const response = await request<BffTraceAssociationAccepted>(
    "/api/investigations/traces/associate",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_id: params.appId,
        technique: params.technique,
        trace_file_ids: [params.traceFileId],
        name_prefix: params.namePrefix ?? "Re-run",
      }),
    },
  );

  return response.investigations;
}

export async function cancelUserInitiatedInvestigations(
  ids: string[],
): Promise<string[]> {
  if (ids.length === 0) {
    return [];
  }
  const raw = await request<{ deleted_ids: string[] }>(
    "/api/investigations/cancel-user-initiated",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    },
  );
  return raw.deleted_ids ?? [];
}

export async function overrideInvestigationVerdict(
  id: string,
  verdict: "malicious" | "benign",
  reason?: string,
): Promise<Investigation> {
  const raw = await request<BffInvestigation>(
    `/api/investigations/${id}/verdict`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        verdict,
        reason,
      }),
    },
  );
  return adaptInvestigation(raw);
}

export async function fetchAuthMe(): Promise<AuthMeResponse> {
  return request<AuthMeResponse>("/api/auth/me");
}

export async function fetchUsers(): Promise<ManagedUser[]> {
  return request<ManagedUser[]>("/api/users");
}

export async function createUser(values: {
  email: string;
  username: string;
  role: "view" | "execute" | "admin";
}): Promise<ManagedUser> {
  return request<ManagedUser>("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
}

export async function updateUserRole(
  email: string,
  role: "view" | "execute" | "admin",
): Promise<ManagedUser> {
  return request<ManagedUser>(`/api/users/${encodeURIComponent(email)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
}

export async function deleteUser(email: string): Promise<void> {
  await request<unknown>(`/api/users/${encodeURIComponent(email)}`, {
    method: "DELETE",
  });
}
