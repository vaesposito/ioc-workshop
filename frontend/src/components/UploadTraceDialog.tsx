import { useEffect, useMemo, useRef, useState } from "react";
import { LuUpload, LuX } from "react-icons/lu";
import { useUploadTraceOnlyMutation } from "../query/hooks/useTraceUploadsQuery";
import type { Application } from "../utils/applicationStore";
import { toUserMessage } from "../utils/api";

const MAX_FILE_BYTES = 2 * 1024 * 1024;

interface UploadTraceDialogProps {
  isOpen: boolean;
  applications: Application[];
  onClose: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadTraceDialog({
  isOpen,
  applications,
  onClose,
}: UploadTraceDialogProps) {
  const [appId, setAppId] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useUploadTraceOnlyMutation();

  const sortedApps = useMemo(
    () => [...applications].sort((a, b) => a.name.localeCompare(b.name)),
    [applications],
  );

  useEffect(() => {
    if (!isOpen) {
      setAppId("");
      setSelectedFile(null);
      setError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  function handleSelectFile(file: File | null) {
    if (!file) {
      return;
    }

    if (file.size > MAX_FILE_BYTES) {
      setSelectedFile(null);
      setError(`File too large: max 2 MB (got ${formatBytes(file.size)})`);
      return;
    }

    setSelectedFile(file);
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!selectedFile) {
      setError("Choose a trace file to upload.");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      if (appId.trim().length > 0) {
        formData.append("app_id", appId);
      }

      await uploadMutation.mutateAsync(formData);
      onClose();
    } catch (uploadError) {
      setError(toUserMessage(uploadError, "traces.upload"));
    }
  }

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/40"
        aria-hidden="true"
      />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Upload trace</h2>
              <p className="mt-1 text-sm text-gray-500">
                Upload a trace with an app association, or leave app blank to keep it unassigned.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Close upload trace dialog"
            >
              <LuX size={16} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                App (optional)
              </label>
              <select
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">No app</option>
                {sortedApps.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                Trace file
              </label>
              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
                <input
                  ref={inputRef}
                  type="file"
                  accept=".json,.txt,.log,.trace,.ndjson,.jsonl"
                  className="hidden"
                  onChange={(event) => handleSelectFile(event.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <LuUpload size={14} />
                  Browse files
                </button>
                <p className="mt-2 text-xs text-gray-500">
                  Accepts .json, .txt, .log, .trace, .ndjson, .jsonl up to 2 MB.
                </p>
                {selectedFile && (
                  <p className="mt-2 text-xs text-gray-700">
                    Selected: {selectedFile.name} ({formatBytes(selectedFile.size)})
                  </p>
                )}
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                disabled={uploadMutation.isPending}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={uploadMutation.isPending}
              >
                {uploadMutation.isPending ? "Uploading..." : "Upload trace"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
