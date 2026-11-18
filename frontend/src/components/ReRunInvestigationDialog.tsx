import {
  LuRefreshCw,
  LuX,
} from "react-icons/lu";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApplications } from "../hooks/useApplications";
import { useInvestigations } from "../hooks/useInvestigations";
import type { Investigation } from "../utils/investigationStore";
import { getDisplayTechnique, getTechniqueLabel } from "../utils/techniques";

export interface ReRunInvestigationDialogProps {
  isOpen: boolean;
  investigation: Investigation;
  onClose: () => void;
}

export function ReRunInvestigationDialog({
  isOpen,
  investigation,
  onClose,
}: ReRunInvestigationDialogProps) {
  const navigate = useNavigate();
  const { applications } = useApplications();
  const { rerunInvestigation } = useInvestigations(undefined, {
    enableStream: false,
  });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSubmitError(null);
      setSubmitting(false);
    }
  }, [isOpen]);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const appName =
    applications.find(
      (application) => application.id === investigation.applicationId,
    )?.name ?? investigation.applicationId;

  if (!isOpen) return null;

  const missingRequiredData =
    !investigation.applicationId ||
    !investigation.traceFileId ||
    !investigation.technique;

  async function handleConfirm() {
    const { applicationId, traceFileId, technique } = investigation;
    if (!applicationId || !traceFileId || !technique) {
      setSubmitError(
        "Re-run unavailable because the original trace reference could not be found.",
      );
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError(null);
      const created = await rerunInvestigation({
        appId: applicationId,
        technique,
        traceFileId,
        namePrefix: `Re-run: ${investigation.name}`,
      });
      onClose();
      if (created[0]) {
        navigate(`/investigations/${created[0]}`);
      }
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Failed to re-run this investigation with the same parameters.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div
        className="relative z-10 bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-md mx-4 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div className="flex flex-col gap-1">
            <h3 className="text-base font-semibold text-gray-900">
              Re-run Investigation
            </h3>
            <p className="font-mono text-xs text-gray-400">
              {investigation.trace_id}
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

        {/* Form body */}
        <div className="px-6 py-5 flex flex-col gap-5">
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.16em] text-gray-500 font-semibold">
              Application
            </p>
            <p className="mt-1 text-sm text-gray-900">{appName}</p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.16em] text-gray-500 font-semibold">
              Technique
            </p>
            <p className="mt-1 text-sm text-gray-900">
              {getTechniqueLabel(
                getDisplayTechnique(
                  investigation.technique,
                  investigation.effectiveTechnique,
                ),
              )}
            </p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.16em] text-gray-500 font-semibold">
              Trace ID
            </p>
            <p className="mt-1 font-mono text-xs text-gray-700 break-all">
              {investigation.trace_id}
            </p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.16em] text-gray-500 font-semibold">
              Trace File ID
            </p>
            <p className="mt-1 font-mono text-xs text-gray-700 break-all">
              {investigation.traceFileId ?? "Unavailable"}
            </p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <p className="text-xs text-gray-600">
              Re-run uses the exact same application, technique, and persisted
              trace file as the original investigation.
            </p>
          </div>

          {submitError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {submitError}
            </div>
          ) : null}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 px-6 pb-5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 rounded-md border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting || missingRequiredData}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-md bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LuRefreshCw size={14} />
            {submitting ? "Re-running..." : "Confirm Re-run"}
          </button>
        </div>
      </div>
    </div>
  );
}
