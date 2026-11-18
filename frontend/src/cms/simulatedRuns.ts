import { queryClient } from "../query/client";
import { queryKeys } from "../query/keys";
import { addInvestigationTerminalNotification } from "../utils/notificationStore";
import {
  getCanonicalSimulatedRunEntry,
  getCanonicalSimulatedRunEntryByInvestigationId,
  type CmsInvestigation,
  type SimulatedPoolEntry,
} from "./repository";
import { simulationStore, type SimulatedRunRecord } from "./simulationStore";

// Randomized so repeated demo runs don't all take the exact same time to "complete".
// The run is normally finished by the reasoning stream (completeSimulatedRun);
// this window is only a safety net so a run never gets stuck if the streaming
// view is unmounted (e.g. the user navigates away mid-run).
const STARTED_DELAY_RANGE_MS: [number, number] = [400, 700];
const COMPLETED_AT_RANGE_MS: [number, number] = [45000, 50000];

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

const activeTimers = new Map<string, ReturnType<typeof setTimeout>[]>();
const startedListeners = new Set<(investigationId: string) => void>();

export function onSimulatedRunQueued(
  listener: (investigationId: string) => void,
): () => void {
  startedListeners.add(listener);
  return () => startedListeners.delete(listener);
}

function clearTimers(traceFileId: string): void {
  activeTimers.get(traceFileId)?.forEach(clearTimeout);
  activeTimers.delete(traceFileId);
}

function invalidateAffectedCaches(): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.investigations.all() });
  void queryClient.invalidateQueries({ queryKey: queryKeys.traces.all() });
  void queryClient.invalidateQueries({ queryKey: queryKeys.applications() });
}

function schedule(traceFileId: string, record: SimulatedRunRecord): void {
  clearTimers(traceFileId);
  const timers: ReturnType<typeof setTimeout>[] = [];
  const now = Date.now();

  if (record.status === "pending") {
    timers.push(
      setTimeout(
        () => {
          simulationStore.set(traceFileId, { ...record, status: "started" });
          invalidateAffectedCaches();
        },
        Math.max(0, record.scheduledStartedAt - now),
      ),
    );
  }

  if (record.status !== "completed") {
    timers.push(
      setTimeout(
        () => {
          simulationStore.set(traceFileId, { ...record, status: "completed" });
          invalidateAffectedCaches();
          notifyRunCompleted(traceFileId);
        },
        Math.max(0, record.scheduledCompletedAt - now),
      ),
    );
  }

  activeTimers.set(traceFileId, timers);
}

function notifyRunCompleted(traceFileId: string): void {
  const entry = getPoolEntry(traceFileId);
  if (!entry) return;

  addInvestigationTerminalNotification({
    investigationId: entry.investigation.id,
    status: "completed",
    createdAt: Date.now(),
    appName: entry.appName,
    investigationName: entry.investigation.name,
  });
}

export function getPoolEntry(traceFileId: string): SimulatedPoolEntry | undefined {
  return getCanonicalSimulatedRunEntry(traceFileId);
}

export function isPoolTrace(traceFileId: string): boolean {
  return getPoolEntry(traceFileId) !== undefined;
}

export function getPoolInvestigation(traceFileId: string): CmsInvestigation | undefined {
  return getPoolEntry(traceFileId)?.investigation;
}

export function getPoolEntryByInvestigationId(
  investigationId: string,
): SimulatedPoolEntry | undefined {
  return getCanonicalSimulatedRunEntryByInvestigationId(investigationId);
}

// Marks a running simulation as completed. Called when the reasoning stream has
// finished so the run lasts exactly as long as the live investigation shows.
export function completeSimulatedRun(traceFileId: string): void {
  const record = simulationStore.get(traceFileId);
  if (!record || record.status === "completed") {
    return;
  }
  clearTimers(traceFileId);
  simulationStore.set(traceFileId, { ...record, status: "completed" });
  invalidateAffectedCaches();
  notifyRunCompleted(traceFileId);
}

export function startSimulatedRun(traceFileId: string): void {
  if (simulationStore.get(traceFileId)) {
    return; // already triggered once; re-running isn't part of this demo flow
  }
  if (!getPoolEntry(traceFileId)) {
    return;
  }

  const now = Date.now();
  const scheduledStartedAt = now + randomBetween(...STARTED_DELAY_RANGE_MS);
  const scheduledCompletedAt = now + randomBetween(...COMPLETED_AT_RANGE_MS);

  const record: SimulatedRunRecord = {
    status: "pending",
    triggeredAt: now,
    scheduledStartedAt,
    scheduledCompletedAt,
  };

  simulationStore.set(traceFileId, record);
  schedule(traceFileId, record);
  invalidateAffectedCaches();

  const investigation = getPoolInvestigation(traceFileId);
  if (investigation) {
    startedListeners.forEach((listener) => listener(investigation.id));
  }
}

// Reschedules any in-flight simulated runs after a page reload so progress isn't lost.
export function resumeSimulatedRuns(): void {
  const all = simulationStore.getAll();
  for (const [traceFileId, record] of Object.entries(all)) {
    if (record.status === "completed") continue;
    schedule(traceFileId, record);
  }
}
