import { LuChevronRight } from "react-icons/lu";

export function ExpandMark({ open }: { open: boolean }) {
  return (
    <span className="ioc-expand-mark" aria-hidden="true">
      <LuChevronRight
        size={13}
        className={`transition-transform ${open ? "rotate-90" : ""}`}
      />
    </span>
  );
}
