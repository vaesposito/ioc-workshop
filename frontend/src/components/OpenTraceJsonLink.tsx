import { LuExternalLink } from "react-icons/lu";
import type { TraceContent } from "../utils/api";

// Trace files are bundled into the demo rather than served over HTTP, so the raw
// JSON is handed to the new tab as an object URL built from the loaded content.
function openJsonTab(content: TraceContent): void {
  const blob = new Blob([JSON.stringify(content, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const tab = window.open(url, "_blank", "noopener,noreferrer");
  if (!tab) {
    URL.revokeObjectURL(url);
    return;
  }
  // Revoking immediately would blank the tab before it has read the blob.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function OpenTraceJsonLink({
  content,
  traceName,
}: {
  content?: TraceContent | null;
  traceName?: string | null;
}) {
  if (!content) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => openJsonTab(content)}
      title={
        traceName
          ? `Open ${traceName} as JSON in a new tab`
          : "Open the raw trace JSON in a new tab"
      }
      className="ioc-link inline-flex shrink-0 items-center gap-1.5 text-[11px] font-light"
    >
      Open trace JSON
      <LuExternalLink size={11} />
    </button>
  );
}
