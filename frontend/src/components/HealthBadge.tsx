import type { AppHealth } from "../utils/portfolio";

export function HealthBadge({
  health,
}: {
  health: AppHealth;
}) {
  if (health === "suspicious") {
    return (
      <span className="sev-danger inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.12em]">
        <span className="sev-dot-danger h-1.5 w-1.5 rounded-full" />
        Suspicious
      </span>
    );
  }

  if (health === "healthy") {
    return (
      <span className="sev-success inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.12em]">
        <span className="sev-dot-success h-1.5 w-1.5 rounded-full" />
        Healthy
      </span>
    );
  }

  return (
    <span className="ioc-copy inline-flex items-center gap-1.5 rounded-full border border-[color:var(--ioc-glass-border)] px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.12em]">
      <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--ioc-faint)]" />
      Not analyzed
    </span>
  );
}
