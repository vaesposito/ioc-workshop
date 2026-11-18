import { useState } from "react";
import { LuCheck, LuCopy, LuDownload } from "react-icons/lu";

/**
 * A submitted program, as the coding runs record them. They run to a hundred
 * lines and the same one is shown in three places, so the block keeps its own
 * scroll rather than pushing the column, and the program can be taken away
 * whole instead of read through a window.
 */
export function DebateCode({ code, name }: { code: string; name: string }) {
  const [copied, setCopied] = useState(false);
  const file = `${name}.py`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard permission can be refused; the block stays selectable.
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([code], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = file;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="ioc-debate-code-block">
      <div className="ioc-debate-code-bar">
        <span className="ioc-debate-code-name">{file}</span>
        <button
          type="button"
          onClick={copy}
          aria-label={`Copy ${file}`}
          className="ioc-debate-code-action"
        >
          {copied ? <LuCheck size={12} /> : <LuCopy size={12} />}
          {copied ? "Copied" : "Copy"}
        </button>
        <button
          type="button"
          onClick={download}
          aria-label={`Download ${file}`}
          className="ioc-debate-code-action"
        >
          <LuDownload size={12} />
          Download
        </button>
      </div>
      <pre className="ioc-debate-code is-capped">{code}</pre>
    </div>
  );
}
