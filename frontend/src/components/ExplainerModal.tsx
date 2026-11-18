import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { LuX } from "react-icons/lu";

export function ExplainerModal({
  isOpen,
  onClose,
  title = "Explain this to me",
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => closeRef.current?.focus());
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="ioc-explainer-modal">
      <button
        type="button"
        className="ioc-explainer-modal-backdrop"
        aria-label="Close explainer"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="ioc-explainer-modal-panel"
      >
        <header className="ioc-explainer-modal-header">
          <h2 id={titleId} className="ioc-fg text-[15px] font-light tracking-wide">
            {title}
          </h2>
          <button
            ref={closeRef}
            type="button"
            className="ioc-icon-btn"
            aria-label="Close explainer"
            onClick={onClose}
          >
            <LuX size={16} />
          </button>
        </header>
        <div className="ioc-explainer-modal-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
