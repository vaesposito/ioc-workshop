import { LuExternalLink, LuPlay } from "react-icons/lu";

interface InvestigationDetailLeftSectionProps {
  isFailed?: boolean;
  isMalicious?: boolean;
  applicationName?: string;
  applicationHref?: string | null;
  traceName?: string;
  traceHref?: string | null;
  techniqueLabel?: string;
  model?: string;
  durationSeconds?: number;
  startedAt?: number;
  completedAt?: number;
  status?: "completed" | "pending" | "started" | "failed";
  userTask?: string;
  revealOnComplete?: boolean;
  /** Omitted while the run is in flight, when there is nothing to explain yet. */
  onExplain?: () => void;
  explainerOpen?: boolean;
  /** The brief behind the run — the question and the answers on the table —
      which belongs with the rest of what the report was given. */
  brief?: React.ReactNode;
}

function ContextLink({ label, href }: { label: string; href?: string | null }) {
  if (!href) {
    return (
      <p className="ioc-copy mt-1.5 text-[12.5px] font-light leading-[1.4]">
        {label}
      </p>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={`Open ${label} in a new tab`}
      className="ioc-link mt-1.5 inline-flex items-start gap-1.5 text-[12.5px] font-light leading-[1.4]"
    >
      <span className="break-all">{label}</span>
      <LuExternalLink size={12} className="mt-[3px] shrink-0" />
    </a>
  );
}

export function InvestigationDetailLeftSection({
  isFailed = false,
  isMalicious = false,
  applicationName,
  applicationHref,
  traceName,
  traceHref,
  techniqueLabel,
  model,
  durationSeconds,
  startedAt,
  completedAt,
  status,
  userTask,
  revealOnComplete = false,
  onExplain,
  explainerOpen = false,
  brief,
}: InvestigationDetailLeftSectionProps) {
  const isRunning = status === "pending" || status === "started";
  const celebrate = revealOnComplete && !isRunning;
  const verdictLabel = isRunning
    ? "Investigating"
    : isFailed
      ? "Failed"
      : isMalicious
        ? "Malicious"
        : "Benign";
  const verdictTone = isRunning
    ? "ioc-fg"
    : isFailed
      ? "sev-warning-text"
      : isMalicious
        ? "sev-danger-text"
        : "sev-success-text";
  const verdictPanel = isRunning
    ? "ioc-glass rounded-lg"
    : isFailed
      ? "ioc-glass ioc-class-panel is-warning rounded-lg"
      : isMalicious
        ? "ioc-glass ioc-class-panel is-danger rounded-lg"
        : "ioc-glass ioc-class-panel is-success rounded-lg";

  const durationLabel = (() => {
    if (isRunning) return "Running";
    if (
      typeof durationSeconds === "number" &&
      Number.isFinite(durationSeconds)
    ) {
      const seconds = Math.max(0, Math.floor(durationSeconds));
      if (seconds < 60) return `${seconds}s`;
      const minutes = Math.floor(seconds / 60);
      const rem = seconds % 60;
      return `${minutes}m ${rem.toString().padStart(2, "0")}s`;
    }
    if (typeof startedAt === "number" && typeof completedAt === "number") {
      const seconds = Math.max(0, Math.floor((completedAt - startedAt) / 1000));
      if (seconds < 60) return `${seconds}s`;
      const minutes = Math.floor(seconds / 60);
      const rem = seconds % 60;
      return `${minutes}m ${rem.toString().padStart(2, "0")}s`;
    }
    return "-";
  })();

  return (
    <aside className="ioc-hairline border-b lg:col-span-3 lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:border-b-0 lg:border-r">
      {/* Grow 0 so the metadata keeps its natural height and the CTA follows
          straight after it, but shrink 1 so a short viewport scrolls this block
          instead of pushing the CTA out of view. */}
      <div className="ioc-scroll ioc-copy space-y-3 px-4 py-3 text-[12.5px] lg:min-h-0 lg:flex-[0_1_auto] lg:overflow-y-auto">
        {applicationName || traceName ? (
          <div className="space-y-2.5">
            {applicationName ? (
              <div>
                <p className="ioc-kicker">Application</p>
                <ContextLink label={applicationName} href={applicationHref} />
              </div>
            ) : null}
            {traceName ? (
              <div>
                <p className="ioc-kicker">Trace</p>
                <ContextLink label={traceName} href={traceHref} />
              </div>
            ) : null}
          </div>
        ) : null}

        {userTask ? (
          <div>
            <p className="ioc-kicker">User task</p>
            <p className="ioc-copy mt-1.5 text-[12.5px] font-light leading-[1.45]">
              {userTask}
            </p>
          </div>
        ) : null}

        <div className={`space-y-2.5 ${celebrate ? "ioc-reveal-meta" : ""}`}>
          <div>
            <p className="ioc-kicker">Model</p>
            <p className="ioc-copy mt-1.5 text-[12.5px] font-light leading-[1.4]">
              {model ?? "—"}
            </p>
          </div>
          <div>
            <p className="ioc-kicker">Duration</p>
            <p className="ioc-copy mt-1.5 text-[12.5px] font-light leading-[1.4]">
              {durationLabel}
            </p>
          </div>
        </div>

        <div
          className={`${verdictPanel} px-3.5 py-3.5 ${celebrate ? "ioc-reveal-verdict" : ""}`}
        >
          <p className="ioc-kicker">Classification</p>
          <p
            className={`mt-2 text-[34px] font-light leading-[0.95] ${verdictTone}`}
          >
            {verdictLabel}
          </p>
        </div>

        <div className={celebrate ? "ioc-reveal-meta" : undefined}>
          <p className="ioc-kicker">Method</p>
          <p className="ioc-copy mt-1.5 text-[12.5px] font-light leading-[1.4]">
            {techniqueLabel}
          </p>
        </div>

        {brief}
      </div>

      {/* Kept outside the scroll container above: scrolling clips on both axes,
          which would shave the glow off the CTA sitting against its edge. */}
      {onExplain ? (
        <div className="shrink-0 px-4 pb-5 pt-4">
          <button
            type="button"
            className="ioc-cta ioc-cta-side"
            aria-haspopup="dialog"
            aria-expanded={explainerOpen}
            onClick={onExplain}
          >
            Explain this to me
            <LuPlay size={16} />
          </button>
        </div>
      ) : null}
    </aside>
  );
}
