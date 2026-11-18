import type { ReactNode } from "react";

export const DEMO_LOCK_MESSAGE = "This is a demo version";

export function DemoLocked({
  children,
  className,
  align = "end",
  side = "bottom",
}: {
  children: ReactNode;
  className?: string;
  align?: "start" | "end";
  side?: "top" | "bottom";
}) {
  return (
    <span
      className={`group relative z-0 inline-flex cursor-not-allowed overflow-visible hover:z-50 focus-within:z-50 ${className ?? ""}`}
      tabIndex={0}
      aria-label={DEMO_LOCK_MESSAGE}
    >
      <span className="pointer-events-none inline-flex w-full">{children}</span>
      <span
        role="tooltip"
        className={`ioc-tooltip ioc-tooltip-compact pointer-events-none invisible absolute z-50 opacity-0 transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 ${
          side === "top" ? "bottom-full mb-2" : "top-full mt-2"
        } ${align === "end" ? "right-0" : "left-0"}`}
      >
        {DEMO_LOCK_MESSAGE}
      </span>
    </span>
  );
}
