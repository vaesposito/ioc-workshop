import { LuClipboardCheck, LuScanLine, LuZap } from "react-icons/lu";
import { getTechniqueLabel } from "../utils/techniques";

const TECHNIQUE_META: Record<
  string,
  { className: string; Icon: typeof LuScanLine }
> = {
  "baseline-detector": {
    className:
      "border-[color:var(--ioc-glass-border)] bg-[color:var(--ioc-row-hover)] text-[color:var(--ioc-text)]",
    Icon: LuScanLine,
  },
  "agent-auditor": {
    className:
      "border-[color:var(--ioc-glass-border)] bg-[color:var(--ioc-row-hover)] text-[color:var(--ioc-text)]",
    Icon: LuClipboardCheck,
  },
  evoguard: {
    className:
      "border-[color:var(--ioc-glass-border)] bg-[color:var(--ioc-row-hover)] text-[color:var(--ioc-text)]",
    Icon: LuZap,
  },
};

export function TechniqueBadge({ technique }: { technique: string }) {
  const label = getTechniqueLabel(technique);
  const meta = TECHNIQUE_META[technique] ?? {
    className:
      "border-[color:var(--ioc-glass-border)] bg-[color:var(--ioc-row-hover)] text-[color:var(--ioc-muted)]",
    Icon: LuScanLine,
  };
  const Icon = meta.Icon;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-light whitespace-nowrap ${meta.className}`}
    >
      <Icon size={11} />
      {label}
    </span>
  );
}
