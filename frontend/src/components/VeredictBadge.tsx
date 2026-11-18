interface VeredictBadgeProps {
  verdict: string;
  size?: "md" | "sm";
}

export function VeredictBadge({ verdict, size = "md" }: VeredictBadgeProps) {
  const isMalicious = verdict === "malicious";
  const isBenign = verdict === "benign";
  const isFailed = verdict === "error" || verdict === "failed";
  const compact = size === "sm";
  const shell = `inline-flex w-fit max-w-full items-center rounded-md border ${
    compact ? "gap-1.5 px-2 py-0.5" : "gap-2 px-3 py-1"
  }`;
  const label = `font-light uppercase tracking-[0.12em] leading-none ${
    compact ? "text-[10px]" : "text-xs"
  }`;
  const dot = compact ? "h-1.5 w-1.5 rounded-full" : "h-2 w-2 rounded-full";

  if (isMalicious) {
    return (
      <span className={`sev-danger ${shell}`}>
        <span className={`sev-dot-danger ${dot}`} />
        <span className={label}>Malicious</span>
      </span>
    );
  }

  if (isBenign) {
    return (
      <span className={`sev-success ${shell}`}>
        <span className={`sev-dot-success ${dot}`} />
        <span className={label}>Benign</span>
      </span>
    );
  }

  if (isFailed) {
    return (
      <span className={`sev-warning ${shell}`}>
        <span className={`sev-dot-warning ${dot}`} />
        <span className={label}>Failed</span>
      </span>
    );
  }

  return (
    <span
      className={`ioc-faint ${shell} border-[color:var(--ioc-glass-border)] bg-[color:var(--ioc-row-hover)]`}
    >
      <span className={`${dot} bg-[color:var(--ioc-faint)]`} />
      <span className={`${label} capitalize`}>{verdict}</span>
    </span>
  );
}
