import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface Point {
  x: number;
  y: number;
}

/**
 * A card pinned to a point on screen and draggable clear of whatever it
 * covers. It renders into the body because the columns scroll, and a scrolling
 * column clips anything that reaches past its edge. Mount it with a key per
 * subject so a new one starts on its anchor rather than where the last one was
 * left.
 */
export function FloatingTip({
  anchor,
  side,
  children,
}: {
  /** Viewport coordinates of the thing described, read again on every move. */
  anchor: () => Point | null;
  side: "above" | "below";
  children: ReactNode;
}) {
  const [point, setPoint] = useState<Point | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const from = useRef({ x: 0, y: 0, ox: 0, oy: 0 });

  // The closure is rebuilt on every render, so the listeners follow it by ref
  // rather than being torn down and re-added each time.
  const read = useRef(anchor);
  read.current = anchor;

  const measure = () =>
    setPoint((current) => {
      const next = read.current();
      if (!next || !current) {
        return next;
      }
      return current.x === next.x && current.y === next.y ? current : next;
    });

  // Fixed coordinates go stale whenever anything between the anchor and the
  // viewport moves, which includes a column scrolling under the tip.
  useLayoutEffect(measure);
  useLayoutEffect(() => {
    const update = () => measure();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!point || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className={`ioc-orb-tip${dragging ? " is-dragging" : ""}`}
      data-side={side}
      style={{ left: point.x + offset.x, top: point.y + offset.y }}
      onPointerDown={(event) => {
        if ((event.target as HTMLElement).closest("button")) {
          return;
        }
        from.current = {
          x: event.clientX,
          y: event.clientY,
          ox: offset.x,
          oy: offset.y,
        };
        setDragging(true);
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!dragging) {
          return;
        }
        setOffset({
          x: from.current.ox + event.clientX - from.current.x,
          y: from.current.oy + event.clientY - from.current.y,
        });
      }}
      onPointerUp={(event) => {
        if (!dragging) {
          return;
        }
        setDragging(false);
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

/** Anchors a tip to a point given in percentages of an element's own box. */
export function pointInBox(
  box: { current: HTMLElement | null },
  xPercent: number,
  yPercent: number,
): () => Point | null {
  return () => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect) {
      return null;
    }
    return {
      x: rect.left + (xPercent / 100) * rect.width,
      y: rect.top + (yPercent / 100) * rect.height,
    };
  };
}
