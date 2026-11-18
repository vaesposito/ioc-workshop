import { useEffect, useRef, useState } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  title: string;
  children?: React.ReactNode;
  minWidth?: number;
  minHeight?: number;
  anchorAlign?: "start" | "end";
}

interface Position {
  top: number;
  left?: number;
  right?: number;
}

export function Modal({
  isOpen,
  onClose,
  anchorRef,
  title,
  children,
  minWidth = 320,
  minHeight = 160,
  anchorAlign = "end",
}: ModalProps) {
  const [position, setPosition] = useState<Position | null>(null);
  const [visible, setVisible] = useState(false);
  const [entering, setEntering] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Compute anchor position when opening
  useEffect(() => {
    if (!isOpen || !anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    setPosition(
      anchorAlign === "start"
        ? { top: rect.bottom + 8, left: rect.left }
        : { top: rect.bottom + 8, right: window.innerWidth - rect.right },
    );
  }, [isOpen, anchorRef, anchorAlign]);

  // Drive enter / exit animation
  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      // Defer so the browser paints the "hidden" state first
      const id = requestAnimationFrame(() => setEntering(true));
      return () => cancelAnimationFrame(id);
    } else {
      setEntering(false);
      // Unmount after the transition completes
      const panel = panelRef.current;
      if (!panel) {
        setVisible(false);
        return;
      }
      function handleEnd() {
        setVisible(false);
        panel!.removeEventListener("transitionend", handleEnd);
      }
      panel.addEventListener("transitionend", handleEnd);
      return () => panel.removeEventListener("transitionend", handleEnd);
    }
  }, [isOpen]);

  // Click-outside to close
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose, anchorRef]);

  if (!visible || !position) return null;

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 ease-out ${
          entering ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        ref={panelRef}
        style={{
          top: position.top,
          ...(position.left !== undefined
            ? { left: position.left }
            : { right: position.right }),
          minWidth,
          minHeight,
        }}
        className={`fixed z-50 flex flex-col bg-white rounded-lg shadow-xl p-6 transition-opacity duration-200 ease-out ${
          entering ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="h-full w-full flex flex-1 items-start justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="ml-4 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        {children && <div className="w-full h-full">{children}</div>}
      </div>
    </>
  );
}
