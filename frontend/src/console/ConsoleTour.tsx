import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { LuX } from "react-icons/lu";

export interface TourStep {
  /** The value of the data-tour attribute on the element being explained. */
  target: string;
  title: string;
  body: string;
}

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

function boxOf(target: string): Box | null {
  const node = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
  if (!node) {
    return null;
  }
  const rect = node.getBoundingClientRect();
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

/**
 * A walk through the page: one step at a time, each lighting the thing it is
 * about and dimming the rest. The steps are content, so they are passed in
 * rather than written here.
 */
export function ConsoleTour({
  steps,
  onClose,
}: {
  steps: TourStep[];
  onClose: () => void;
}) {
  const [at, setAt] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const step = steps[at] ?? null;

  // The page scrolls under the tour, so the light is measured again on every
  // paint rather than held from where the step opened.
  useLayoutEffect(() => {
    if (!step) {
      return;
    }
    const measure = () => setBox(boxOf(step.target));
    measure();
    document
      .querySelector(`[data-tour="${step.target}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [step]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight")
        setAt((index) => Math.min(index + 1, steps.length - 1));
      if (event.key === "ArrowLeft") setAt((index) => Math.max(index - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, steps.length]);

  if (!step || typeof document === "undefined") {
    return null;
  }

  const last = at === steps.length - 1;
  // Below what it explains where there is room, above it where there is not.
  const below = box ? box.top + box.height + 240 < window.innerHeight : true;
  const top = box
    ? below
      ? box.top + box.height + 12
      : Math.max(box.top - 12, 12)
    : window.innerHeight / 2;
  const left = box
    ? Math.min(Math.max(box.left, 16), window.innerWidth - 336)
    : window.innerWidth / 2 - 160;

  return createPortal(
    <div className="ioc-tour">
      {/* One element both dims the page and cuts the light out of it. */}
      <div
        className="ioc-tour-light"
        style={
          box
            ? {
                top: box.top - 6,
                left: box.left - 6,
                width: box.width + 12,
                height: box.height + 12,
              }
            : { top: "50%", left: "50%", width: 0, height: 0 }
        }
        onClick={onClose}
      />

      <aside
        className="ioc-tour-card"
        style={{
          top,
          left,
          transform: below ? undefined : "translateY(-100%)",
        }}
        role="dialog"
        aria-label={step.title}
      >
        <div className="ioc-tour-card-head">
          <span className="ioc-kicker">
            {at + 1} of {steps.length}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="End the tour"
            className="ioc-icon-btn"
          >
            <LuX size={14} />
          </button>
        </div>
        <h3 className="ioc-fg text-[14px] font-normal">{step.title}</h3>
        <p className="ioc-copy mt-1.5 text-[12.5px] font-light leading-[1.5]">
          {step.body}
        </p>
        <div className="ioc-tour-card-foot">
          <button type="button" onClick={onClose} className="ioc-link">
            Skip
          </button>
          <div className="ml-auto flex items-center gap-2">
            {at > 0 ? (
              <button
                type="button"
                onClick={() => setAt(at - 1)}
                className="ioc-btn-ghost"
              >
                Back
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => (last ? onClose() : setAt(at + 1))}
              className="ioc-btn-primary"
            >
              {last ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </aside>
    </div>,
    document.body,
  );
}
