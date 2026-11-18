import { LuBell, LuCheckCheck, LuTrash2, LuX } from "react-icons/lu";
import { useEffect, useRef, useState } from "react";
import { useNotifications } from "../hooks/useNotifications";
import { formatTraceDisplayName } from "../utils/portfolio";

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function statusLabel(status: "pending" | "started" | "completed" | "failed"): string {
  if (status === "pending" || status === "started") {
    return "Running";
  }
  if (status === "completed") {
    return "Completed";
  }
  return "Failed";
}

function statusDotClass(status: "pending" | "started" | "completed" | "failed"): string {
  if (status === "pending" || status === "started") {
    return "sev-dot-warning";
  }
  if (status === "completed") {
    return "sev-dot-success";
  }
  return "sev-dot-danger";
}

function statusBadgeClass(status: "pending" | "started" | "completed" | "failed"): string {
  if (status === "pending" || status === "started") {
    return "sev-warning border";
  }
  if (status === "completed") {
    return "sev-success border";
  }
  return "sev-danger border";
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const { notifications, dismiss, dismissAll, markAllRead } =
    useNotifications();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Mark all read when panel opens
  useEffect(() => {
    if (open) markAllRead();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on click-outside
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        ref={buttonRef}
        onClick={() => setOpen((o) => !o)}
        className="ioc-icon-btn relative"
        aria-label="Notifications"
      >
        <LuBell size={18} />
        {unreadCount > 0 && (
          <span className="sev-danger absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full border px-1 text-[10px] font-bold leading-none">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          ref={panelRef}
          className="ioc-menu absolute right-0 top-full z-50 mt-2 flex w-80 flex-col overflow-hidden rounded-xl shadow-xl backdrop-blur-[20px]"
        >
          {/* Panel header */}
          <div className="ioc-hairline flex items-center justify-between border-b px-4 py-3">
            <span className="ioc-fg text-sm font-light">
              Notifications
            </span>
            {notifications.length > 0 && (
              <button
                onClick={dismissAll}
                className="ioc-faint flex items-center gap-1 text-xs font-light transition-colors hover:text-[color:var(--sev-danger)]"
              >
                <LuTrash2 size={12} />
                Clear all
              </button>
            )}
          </div>

          {/* Notification list */}
          {notifications.length === 0 ? (
            <div className="ioc-faint flex flex-col items-center justify-center gap-2 py-10">
              <LuCheckCheck size={28} />
              <p className="text-sm">All caught up</p>
            </div>
          ) : (
            <ul className="max-h-96 divide-y divide-[color:var(--ioc-glass-border)] overflow-y-auto">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-[color:var(--ioc-row-hover)]"
                >
                  {/* Status dot */}
                  <span
                    className={`mt-1 w-2 h-2 rounded-full shrink-0 ${statusDotClass(n.status)}`}
                  />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="ioc-fg truncate text-xs font-light">
                      {n.appName}
                    </p>
                    <p className="ioc-faint truncate text-xs font-light">
                      {formatTraceDisplayName(n.investigationName)}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span
                        className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${statusBadgeClass(n.status)} ${
                          n.status === "pending" || n.status === "started"
                            ? "animate-pulse"
                            : ""
                        }`}
                      >
                        {statusLabel(n.status)}
                      </span>
                      <span className="ioc-faint text-[10px] font-light">
                        {relativeTime(n.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Dismiss single */}
                  <button
                    onClick={() => dismiss(n.id)}
                    className="ioc-faint mt-0.5 shrink-0 transition-colors hover:text-[color:var(--ioc-text)]"
                    aria-label="Dismiss notification"
                  >
                    <LuX size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
