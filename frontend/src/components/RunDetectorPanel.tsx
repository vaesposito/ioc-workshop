import { useEffect, useState } from "react";
import { LuPlay } from "react-icons/lu";
import { useInvestigations } from "../hooks/useInvestigations";
import { formatTraceDisplayName } from "../utils/portfolio";
import { DEFAULT_TECHNIQUE_ID } from "../utils/techniques";

interface RunDetectorPanelProps {
  appId: string;
  traceFileId: string;
  traceName: string;
  defaultTechnique?: string;
  onCancel: () => void;
  onStarted?: (investigationId: string) => void;
}

export function RunDetectorPanel({
  appId,
  traceFileId,
  traceName,
  defaultTechnique,
  onCancel,
  onStarted,
}: RunDetectorPanelProps) {
  const { rerunInvestigation } = useInvestigations(appId, {
    enableStream: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSubmitting(false);
    setError(null);
  }, [defaultTechnique, appId, traceFileId]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    try {
      setSubmitting(true);
      setError(null);
      const created = await rerunInvestigation({
        appId,
        technique: DEFAULT_TECHNIQUE_ID,
        traceFileId,
        namePrefix: `Detective: ${traceName}`,
      });
      if (created[0]) {
        onStarted?.(created[0]);
      }
      onCancel();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Detective Agent could not start on this trace.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      noValidate
      onSubmit={(event) => void handleSubmit(event)}
      className="flex h-full flex-col gap-5 px-6 pt-6 pb-0"
    >
      <p className="ioc-faint text-xs font-light">
        Detective Agent will replace the previous result for this trace when the
        run completes.
      </p>

      <div>
        <p className="ioc-kicker">Trace</p>
        <p className="ioc-fg mt-1 truncate text-sm font-light">{formatTraceDisplayName(traceName)}</p>
      </div>

      <div>
        <p className="ioc-kicker">Technique</p>
        <p className="ioc-fg mt-1 text-sm font-light">Agent-ToM</p>
      </div>

      {error ? (
        <div className="sev-danger rounded-lg border px-3 py-2 text-sm font-light">
          {error}
        </div>
      ) : null}

      <div className="sticky bottom-0 -mx-6 mt-auto flex items-center justify-end gap-2 border-t border-[color:var(--ioc-glass-border)] bg-[color:var(--ioc-menu-bg)] px-6 py-4">
        <button type="button" onClick={onCancel} className="ioc-btn-ghost">
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="ioc-btn-primary"
        >
          <LuPlay size={14} />
          {submitting ? "Starting..." : "Run Detective Agent"}
        </button>
      </div>
    </form>
  );
}
