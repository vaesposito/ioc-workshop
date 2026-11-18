import { LuRefreshCw, LuX } from "react-icons/lu";
import { useEffect } from "react";

export interface RerunConfirmDialogProps {
  isOpen: boolean;
  technique: string;
  techniqueLabel: string;
  traceId: string;
  memoryLabel: string;
  memoryIsCustom: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function RerunConfirmDialog({
  isOpen,
  technique: _technique,
  techniqueLabel,
  traceId,
  memoryLabel,
  memoryIsCustom,
  onConfirm,
  onClose,
}: RerunConfirmDialogProps) {
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div
        className="relative z-10 bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-md mx-4 p-6 flex flex-col gap-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <h3 className="text-base font-semibold text-gray-900">
              Confirm Re-run
            </h3>
            <p className="text-sm text-gray-500">
              Review the settings before starting a new investigation run.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <LuX size={15} />
          </button>
        </div>

        {/* Details */}
        <div className="flex flex-col divide-y divide-gray-100 rounded-xl border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Technique
            </p>
            <span className="text-sm font-medium text-gray-800">
              {techniqueLabel}
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Trace ID
            </p>
            <span className="font-mono text-sm text-indigo-600">{traceId}</span>
          </div>
          <div className="flex items-start justify-between px-4 py-3 gap-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide shrink-0">
              Memory
            </p>
            <span
              className={`text-sm text-right ${
                memoryIsCustom
                  ? "text-indigo-700 font-medium"
                  : memoryLabel === "None (memoryless run)"
                    ? "text-gray-400"
                    : "text-gray-800"
              }`}
            >
              {memoryLabel}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 rounded-md border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-md bg-indigo-600 hover:bg-indigo-700 transition-colors"
          >
            <LuRefreshCw size={14} />
            Confirm Re-run
          </button>
        </div>
      </div>
    </div>
  );
}
