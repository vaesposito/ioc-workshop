import { useState, type ReactNode } from "react";
import { LuChevronDown } from "react-icons/lu";

/**
 * A labelled block in the right column, collapsible from its own heading. The
 * column stacks several of these, so folding the ones you are done with keeps
 * the rest on screen without scrolling.
 */
export function DebateSection({
  label,
  preview,
  defaultOpen = true,
  open: openProp,
  onOpenChange,
  children,
}: {
  label: string;
  /** Stands in for the body while folded, so the heading is not a bare line. */
  preview?: ReactNode;
  defaultOpen?: boolean;
  /** Set to have the caller hold the state, where something outside the
      section needs to open it. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}) {
  const [selfOpen, setSelfOpen] = useState(defaultOpen);
  const open = openProp ?? selfOpen;
  const toggle = () => {
    if (onOpenChange) {
      onOpenChange(!open);
      return;
    }
    setSelfOpen(!open);
  };

  return (
    <div className={`ioc-debate-section${open ? " is-open" : ""}`}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="ioc-debate-section-head"
      >
        <span className="ioc-debate-section-label">
          <span className="ioc-kicker">{label}</span>
          {!open && preview ? (
            <span className="ioc-debate-section-preview">{preview}</span>
          ) : null}
        </span>
        <span className="ioc-debate-section-toggle" aria-hidden>
          <LuChevronDown
            size={13}
            className={`ioc-chat-chevron ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>
      {open ? <div className="ioc-debate-section-body">{children}</div> : null}
    </div>
  );
}
