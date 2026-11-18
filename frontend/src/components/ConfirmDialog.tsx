import { LuTrash2, LuX } from "react-icons/lu";
import { useEffect, useRef, useState } from "react";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = "Delete",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [visible, setVisible] = useState(false);
  const [entering, setEntering] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      const id = requestAnimationFrame(() => setEntering(true));
      return () => cancelAnimationFrame(id);
    } else {
      setEntering(false);
      const panel = panelRef.current;
      if (!panel) {
        setVisible(false);
        return;
      }
      function handleEnd() {
        setVisible(false);
        panel!.removeEventListener("transitionend", handleEnd);
      }
      panel.addEventListener("transitionend", handleEnd);
      return () => panel.removeEventListener("transitionend", handleEnd);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onCancel]);

  if (!visible) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onCancel}
        className={`fixed inset-0 z-50 bg-black/40 transition-opacity duration-200 ease-out ${
          entering ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          ref={panelRef}
          className={`pointer-events-auto w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 flex flex-col gap-4 transition-all duration-200 ease-out ${
            entering ? "opacity-100 scale-100" : "opacity-0 scale-95"
          }`}
        >
          {/* Close button */}
          <button
            onClick={onCancel}
            className="absolute top-4 right-4 p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <LuX size={15} />
          </button>

          {/* Icon + text */}
          <div className="flex flex-col items-center gap-3 pt-2 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center shrink-0">
              <LuTrash2 size={22} className="text-red-600" />
            </div>
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-semibold text-gray-900">{title}</h2>
              <p className="text-sm text-gray-500 leading-relaxed">{message}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-4 py-2 text-sm font-medium text-white rounded-lg bg-red-600 hover:bg-red-700 transition-colors"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
