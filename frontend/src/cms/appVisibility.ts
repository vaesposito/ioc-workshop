import { useSyncExternalStore } from "react";
import { queryClient } from "../query/client";
import { queryKeys } from "../query/keys";

// Persisted set of application ids the user has hidden from every view.
// Storing hidden ids (rather than visible) keeps newly added apps visible by default.
const STORAGE_KEY = "detective:hidden-apps:v1";

// Until the user saves an explicit choice, every application is shown.
const DEFAULT_HIDDEN_APP_IDS: string[] = [];

type Listener = () => void;
const listeners = new Set<Listener>();

function read(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return new Set(DEFAULT_HIDDEN_APP_IDS);
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? new Set(parsed.filter((id): id is string => typeof id === "string"))
      : new Set(DEFAULT_HIDDEN_APP_IDS);
  } catch {
    return new Set(DEFAULT_HIDDEN_APP_IDS);
  }
}

// Cached snapshot so useSyncExternalStore gets a stable reference between changes.
let snapshot: ReadonlySet<string> = read();

function commit(next: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
  } catch {
    // Ignore persistence failures (e.g. storage disabled); keep the in-memory value.
  }
  snapshot = next;
  listeners.forEach((listener) => listener());
  void queryClient.invalidateQueries({ queryKey: queryKeys.applications() });
  void queryClient.invalidateQueries({ queryKey: queryKeys.investigations.all() });
  void queryClient.invalidateQueries({ queryKey: queryKeys.traces.all() });
}

export const appVisibilityStore = {
  getHiddenIds(): ReadonlySet<string> {
    return snapshot;
  },
  isVisible(appId: string): boolean {
    return !snapshot.has(appId);
  },
  setVisible(appId: string, visible: boolean): void {
    const next = new Set(snapshot);
    if (visible) {
      next.delete(appId);
    } else {
      next.add(appId);
    }
    commit(next);
  },
  setHiddenIds(ids: Iterable<string>): void {
    commit(new Set(ids));
  },
  reset(): void {
    commit(new Set());
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function useHiddenAppIds(): ReadonlySet<string> {
  return useSyncExternalStore(
    appVisibilityStore.subscribe,
    appVisibilityStore.getHiddenIds,
  );
}
