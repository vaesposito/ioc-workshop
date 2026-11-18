export type SimulatedRunStatus = "pending" | "started" | "completed";

export interface SimulatedRunRecord {
  status: SimulatedRunStatus;
  triggeredAt: number;
  scheduledStartedAt: number;
  scheduledCompletedAt: number;
}

const STORAGE_KEY = "detective:simulated-runs:v1";

type Listener = () => void;
const listeners = new Set<Listener>();

function readAll(): Record<string, SimulatedRunRecord> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, SimulatedRunRecord>) : {};
  } catch {
    return {};
  }
}

function writeAll(records: Record<string, SimulatedRunRecord>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  listeners.forEach((listener) => listener());
}

export const simulationStore = {
  getAll(): Record<string, SimulatedRunRecord> {
    return readAll();
  },
  get(traceFileId: string): SimulatedRunRecord | undefined {
    return readAll()[traceFileId];
  },
  set(traceFileId: string, record: SimulatedRunRecord): void {
    const all = readAll();
    all[traceFileId] = record;
    writeAll(all);
  },
  resetAll(): void {
    localStorage.removeItem(STORAGE_KEY);
    listeners.forEach((listener) => listener());
  },
  // Lets the simulation engine react to state written from another tab/reload.
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
