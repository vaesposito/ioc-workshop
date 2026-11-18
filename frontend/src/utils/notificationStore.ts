export interface AppNotification {
  id: string;
  appName: string;
  investigationName: string;
  investigationId: string;
  status: "pending" | "started" | "completed" | "failed";
  createdAt: number;
  read: boolean;
  dedupeKey?: string;
  toastHidden?: boolean;
}

export const TOAST_DURATION_MS = 4000;

const notifications: AppNotification[] = [];
type Listener = (notifications: AppNotification[]) => void;
const listeners: Set<Listener> = new Set();
const hideTimers = new Map<string, ReturnType<typeof setTimeout>>();

function notifyListeners(): void {
  listeners.forEach((listener) => listener([...notifications]));
}

function scheduleToastHide(id: string): void {
  const existing = hideTimers.get(id);
  if (existing) {
    clearTimeout(existing);
  }
  hideTimers.set(
    id,
    setTimeout(() => {
      hideTimers.delete(id);
      hideNotificationToast(id);
    }, TOAST_DURATION_MS),
  );
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getNotifications(): AppNotification[] {
  return [...notifications];
}

export function addNotification(
  notification: Omit<AppNotification, "id" | "read">,
): AppNotification {
  if (notification.dedupeKey) {
    const existing = notifications.find(
      (entry) => entry.dedupeKey === notification.dedupeKey,
    );
    if (existing) {
      return existing;
    }
  }

  const entry: AppNotification = {
    ...notification,
    id: crypto.randomUUID(),
    read: false,
    toastHidden: false,
  };
  notifications.unshift(entry);
  notifyListeners();
  if (entry.status === "completed" || entry.status === "failed") {
    scheduleToastHide(entry.id);
  }
  return entry;
}

export function addInvestigationTerminalNotification(params: {
  investigationId: string;
  status: "completed" | "failed";
  createdAt: number;
  appName?: string;
  investigationName?: string;
  eventId?: string;
}): AppNotification {
  const createdAt = Number.isFinite(params.createdAt)
    ? params.createdAt
    : Date.now();
  const dedupeKey =
    params.eventId?.trim() ||
    `${params.investigationId}:${params.status}:${createdAt}`;

  return addNotification({
    appName: params.appName?.trim() || "Unknown app",
    investigationName: params.investigationName?.trim() || "Investigation",
    investigationId: params.investigationId,
    status: params.status,
    createdAt,
    dedupeKey,
  });
}

export function dismissNotification(id: string): void {
  const timer = hideTimers.get(id);
  if (timer) {
    clearTimeout(timer);
    hideTimers.delete(id);
  }
  const index = notifications.findIndex((n) => n.id === id);
  if (index !== -1) notifications.splice(index, 1);
  notifyListeners();
}

export function hideNotificationToast(id: string): void {
  const timer = hideTimers.get(id);
  if (timer) {
    clearTimeout(timer);
    hideTimers.delete(id);
  }
  const entry = notifications.find((n) => n.id === id);
  if (!entry || entry.toastHidden) {
    return;
  }

  entry.toastHidden = true;
  notifyListeners();
}

export function dismissAll(): void {
  hideTimers.forEach((timer) => clearTimeout(timer));
  hideTimers.clear();
  notifications.splice(0, notifications.length);
  notifyListeners();
}

export function markAllRead(): void {
  notifications.forEach((n) => {
    n.read = true;
  });
  notifyListeners();
}
