import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { LuX } from "react-icons/lu";

/**
 * A reading opened over the whole window, with the other readings along the
 * top so they can be walked without going back. The page stays where it was
 * underneath, so closing it puts you back.
 */
export function ConsoleDrawer({
  title,
  blurb,
  tabs,
  active,
  onPick,
  onClose,
  children,
}: {
  title: string;
  blurb?: string;
  tabs?: readonly { id: string; label: string }[];
  active?: string;
  onPick?: (id: string) => void;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="ioc-console-drawer-stage">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="ioc-console-drawer-back"
      />
      <aside
        className="ioc-console-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="ioc-console-drawer-head">
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="ioc-fg text-[20px] font-light">{title}</h2>
              {blurb ? <p className="ioc-console-note">{blurb}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="ioc-icon-btn shrink-0"
              aria-label="Close"
            >
              <LuX size={15} />
            </button>
          </div>

          {tabs && tabs.length > 0 ? (
            <nav className="ioc-console-tabs mt-4" aria-label="Observability">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onPick?.(tab.id)}
                  aria-pressed={tab.id === active}
                  className={`ioc-console-tab${tab.id === active ? " is-active" : ""}`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          ) : null}
        </header>
        <div className="ioc-console-drawer-body ioc-no-scrollbar">
          {children}
        </div>
      </aside>
    </div>,
    document.body,
  );
}
