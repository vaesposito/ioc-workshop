import { useCallback } from "react";
import { LuExternalLink } from "react-icons/lu";

export function TraceJsonLink({ content }: { content?: unknown }) {
  const open = useCallback(() => {
    if (!content) return;
    const blob = new Blob([JSON.stringify(content, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    // The new tab still needs the object URL while it loads, so release it late.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }, [content]);

  if (!content) return null;

  return (
    <button
      type="button"
      onClick={open}
      title="Open the trace JSON in a new tab"
      className="ioc-link inline-flex cursor-pointer items-center gap-1.5 text-[12px]"
    >
      Open trace
      <LuExternalLink size={12} />
    </button>
  );
}
