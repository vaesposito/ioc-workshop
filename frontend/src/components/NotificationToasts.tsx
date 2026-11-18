import { LuCheckCheck, LuCircleX, LuX } from "react-icons/lu";
import { useNotifications } from "../hooks/useNotifications";
import { formatTraceDisplayName } from "../utils/portfolio";
import {
  hideNotificationToast,
  TOAST_DURATION_MS,
  type AppNotification,
} from "../utils/notificationStore";

function isTerminalStatus(status: AppNotification["status"]): boolean {
  return status === "completed" || status === "failed";
}

function toastClass(status: AppNotification["status"]): string {
  if (status === "completed") {
    return "sev-success border";
  }
  return "sev-danger border";
}

function isTraceUploadNotification(notification: AppNotification): boolean {
  return (
    notification.investigationId.startsWith("trace-upload-") ||
    notification.investigationName.trim().toLowerCase() === "trace uploaded"
  );
}

function statusLabel(notification: AppNotification): string {
  if (isTraceUploadNotification(notification)) {
    return notification.status === "completed"
      ? "Trace uploaded"
      : "Trace upload failed";
  }
  return notification.status === "completed"
    ? "Investigation completed"
    : "Investigation failed";
}

export function NotificationToasts() {
  const { notifications } = useNotifications();
  const now = Date.now();
  const toasts = notifications
    .filter(
      (notification) =>
        isTerminalStatus(notification.status) &&
        !notification.toastHidden &&
        now - notification.createdAt < TOAST_DURATION_MS,
    )
    .slice(0, 4);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="fixed right-4 top-16 z-[70] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`ioc-toast rounded-lg border px-3 py-2 ${toastClass(toast.status)}`}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-2">
            <span className="mt-0.5 shrink-0">
              {toast.status === "completed" ? (
                <LuCheckCheck size={16} />
              ) : (
                <LuCircleX size={16} />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold">{statusLabel(toast)}</p>
              <p className="text-xs opacity-90 truncate">
                {formatTraceDisplayName(toast.investigationName)}
              </p>
              <p className="text-[11px] opacity-75 truncate">{toast.appName}</p>
            </div>
            <button
              type="button"
              onClick={() => hideNotificationToast(toast.id)}
              className="shrink-0 cursor-pointer rounded p-0.5 opacity-70 hover:opacity-100"
              aria-label="Dismiss toast"
            >
              <LuX size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
