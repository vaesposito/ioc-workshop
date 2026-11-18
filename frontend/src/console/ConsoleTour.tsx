import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { LuX } from "react-icons/lu";

export interface TourStep {
  /** The value of the data-tour attribute on the element being explained. */
  target: string;
  /** The page the step is on, where it is not the one already open. */
  to?: string;
  title: string;
  body: string;
}

/** A session Trip Planner has already had investigated, so the steps about
    what an investigation leaves behind have something to point at. */
const LOOKED = "/console/apps/trip-planner/traces/Session-3091";

/** The walk through the console, in the order the work happens. */
export const CONSOLE_TOUR: TourStep[] = [
  {
    target: "apps-add",
    to: "/console",
    title: "Add a multi-agent system",
    body: "Pointing the console at a MAS triggers a cognition fabric flow, which is what puts everything the rest of this tour reads in place.",
  },
  {
    target: "alert-quality",
    to: "/console/apps/trip-planner",
    title: "Performance comes from observability",
    body: "Performance issues, and anything else you can read before an investigation, come from the observability scope watching the system run.",
  },
  {
    target: "trace-findings",
    to: LOOKED,
    title: "What an inspection brings back",
    body: "After an inspection, Detective security detection, CASA and the security active investigation CEs bring the security results and the enforcement propositions.",
  },
  {
    target: "act-quality",
    to: "/console/apps/trip-planner",
    title: "L9 protocols answer performance",
    body: "L9 protocols can be added to solve the performance issues the scope identified.",
  },
  {
    target: "trace-enforcement",
    to: LOOKED,
    title: "Enforcement answers security",
    body: "CASA and the security active investigation can enforce what they propose: denying authorizations and blocking agents.",
  },
];

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
  at,
  onAt,
  onClose,
}: {
  steps: TourStep[];
  /** Which step is open. Held in the page's address, so the tour survives
      walking from one page to the next. */
  at: number;
  onAt: (index: number) => void;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [box, setBox] = useState<Box | null>(null);
  const step = steps[at] ?? null;
  const setAt = onAt;

  // A step on another page takes the reader there first, keeping the step in
  // the address so the page it lands on opens the tour again.
  useEffect(() => {
    if (step?.to && location.pathname !== step.to) {
      navigate(`${step.to}?tour=${at}`, { replace: true });
    }
  }, [step, at, location.pathname, navigate]);

  // The page scrolls under the tour, so the light is measured again on every
  // paint rather than held from where the step opened.
  useLayoutEffect(() => {
    if (!step) {
      return;
    }
    const measure = () => setBox(boxOf(step.target));
    measure();
    // The page it is on may still be arriving, so the step keeps looking for
    // a while rather than giving up on the first paint.
    let tries = 0;
    const hunt = window.setInterval(() => {
      const node = document.querySelector(`[data-tour="${step.target}"]`);
      tries += 1;
      if (node) {
        node.scrollIntoView({ behavior: "smooth", block: "center" });
        measure();
      }
      if (node || tries > 40) window.clearInterval(hunt);
    }, 60);
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.clearInterval(hunt);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [step]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") setAt(Math.min(at + 1, steps.length - 1));
      if (event.key === "ArrowLeft") setAt(Math.max(at - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [at, onClose, setAt, steps.length]);

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
                className="ioc-console-act is-quiet"
              >
                Back
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => (last ? onClose() : setAt(at + 1))}
              className="ioc-console-act"
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
