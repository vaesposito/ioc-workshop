import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function ToolTagList({
  tools,
  limit,
  tooltip = false,
}: {
  tools: string[];
  limit?: number;
  tooltip?: boolean;
}) {
  const moreRef = useRef<HTMLLIElement>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({
    top: 0,
    left: 0,
    width: 340,
    maxHeight: 320,
    place: "below" as "above" | "below",
  });

  function updatePosition() {
    const el = moreRef.current;
    if (!el) {
      return;
    }
    const rect = el.getBoundingClientRect();
    const width = Math.min(340, window.innerWidth - 24);
    const left = Math.min(
      Math.max(12, rect.left),
      window.innerWidth - width - 12,
    );
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    const place =
      spaceBelow < 160 && spaceAbove > spaceBelow ? "above" : "below";
    const maxHeight = Math.max(
      140,
      Math.min(360, place === "below" ? spaceBelow : spaceAbove),
    );
    setCoords({
      top: place === "below" ? rect.bottom + 8 : rect.top - 8,
      left,
      width,
      maxHeight,
      place,
    });
  }

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    updatePosition();
    const onMove = () => updatePosition();
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open]);

  if (tools.length === 0) {
    return <span className="ioc-faint text-[12px]">None</span>;
  }
  const visible = limit != null ? tools.slice(0, limit) : tools;
  const extraTools = limit != null ? tools.slice(limit) : [];
  const extra = extraTools.length;

  function showMore() {
    setOpen(true);
  }

  function hideMore() {
    setOpen(false);
  }

  return (
    <ul className={`ioc-tool-tags ${limit != null ? "is-compact" : ""}`}>
      {visible.map((tool) => (
        <li key={tool} className="ioc-tool-tag">
          {tool}
        </li>
      ))}
      {extra > 0 ? (
        <li
          ref={moreRef}
          className="ioc-tool-tag is-more"
          onMouseEnter={() => {
            if (!tooltip) {
              return;
            }
            updatePosition();
            showMore();
          }}
          onMouseLeave={() => {
            if (!tooltip) {
              return;
            }
            hideMore();
          }}
          onClick={(event) => event.stopPropagation()}
        >
          +{extra}
        </li>
      ) : null}
      {tooltip && open && extra > 0
        ? createPortal(
            <div
              role="tooltip"
              className="ioc-tooltip ioc-tool-pop pointer-events-none"
              style={{
                position: "fixed",
                top: coords.place === "below" ? coords.top : undefined,
                bottom:
                  coords.place === "above"
                    ? window.innerHeight - coords.top
                    : undefined,
                left: coords.left,
                width: coords.width,
                maxHeight: coords.maxHeight,
                zIndex: 80,
              }}
            >
              <p className="ioc-kicker">More tools</p>
              <ul className="ioc-tool-tags ioc-tool-pop-tags">
                {extraTools.map((tool) => (
                  <li key={tool} className="ioc-tool-tag">
                    {tool}
                  </li>
                ))}
              </ul>
            </div>,
            document.body,
          )
        : null}
    </ul>
  );
}
