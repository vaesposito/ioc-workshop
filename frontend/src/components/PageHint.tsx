import { useState } from "react";
import { LuInfo, LuX } from "react-icons/lu";

// A light, dismissible "how this works" callout; dismissal is remembered per session.
export function PageHint({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  const storageKey = `hint:${id}`;
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  const dismiss = () => {
    try {
      sessionStorage.setItem(storageKey, "1");
    } catch {
      // ignore storage failures
    }
    setDismissed(true);
  };

  return (
    <div className="ioc-glass ioc-enter relative rounded-xl border border-[color:var(--ioc-kicker)] px-4 py-3 shadow-[0_0_24px_rgba(4,164,202,0.14)]">
      <div className="flex items-start gap-2.5">
        <LuInfo
          size={16}
          className="mt-0.5 shrink-0 text-[color:var(--ioc-kicker)]"
        />
        <div className="min-w-0">
          <p className="ioc-fg text-[13px] font-medium">{title}</p>
          <p className="ioc-copy mt-1 text-[12px] leading-[1.5]">{children}</p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss tip"
          className="ioc-icon-btn -mt-1 -mr-1 shrink-0"
        >
          <LuX size={14} />
        </button>
      </div>
    </div>
  );
}
