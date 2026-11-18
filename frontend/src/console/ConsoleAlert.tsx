import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { LuCheck, LuTriangleAlert } from "react-icons/lu";

import { DebateSection } from "../components/DebateSection";

/** A count of one kind of problem, and where it stands against being fixed. */
export interface Guidance {
  id: string;
  label: string;
  count: number;
  /** Set where this is a fault rather than a worry. */
  grave?: boolean;
  /** Whether the step that answers this has been taken. */
  settled: boolean;
  /** How it stands, in a few words: configured, enforced, or neither yet. */
  standing: string;
  /** What taking the action does, for a reader who has not met it before. */
  hint: string;
  /** Opens what is being counted, where there is somewhere to open. */
  onOpen?: () => void;
  action: {
    label: string;
    icon: ReactNode;
    /** Where the action goes, where it goes anywhere yet. */
    to?: string;
    onAct?: () => void;
  };
}

/**
 * What the page suggests doing about itself: what is wrong with the answers,
 * what is wrong with the traffic, and the step that answers each. Folds away
 * for a reader who has already dealt with them.
 */
export function ConsoleAlert({ items }: { items: Guidance[] }) {
  if (items.length === 0) return null;

  const open = items.filter((item) => !item.settled).length;

  return (
    <DebateSection
      label="Recommendations"
      preview={open === 0 ? "all taken" : `${open} to take`}
      defaultOpen
    >
      <ul className="ioc-console-guidance">
        {items.map((item) => (
          <li
            key={item.id}
            className={`ioc-console-banner${item.grave && !item.settled ? " is-grave" : ""}${item.settled ? " is-settled" : ""}`}
          >
            {item.settled ? (
              <LuCheck size={13} aria-hidden className="shrink-0" />
            ) : (
              <LuTriangleAlert size={13} aria-hidden className="shrink-0" />
            )}
            <button
              type="button"
              onClick={item.onOpen}
              disabled={!item.onOpen}
              className="ioc-console-banner-body"
              title={item.hint}
            >
              <span className="ioc-console-banner-count">{item.count}</span>
              <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-[12px] font-light">
                {item.label}
              </span>
            </button>
            <span className="ioc-faint text-[11.5px] font-light">
              · {item.standing}
            </span>
            {item.settled ? null : item.action.to ? (
              <Link
                to={item.action.to}
                className="ioc-console-act ml-auto shrink-0"
              >
                {item.action.icon}
                {item.action.label}
              </Link>
            ) : (
              <button
                type="button"
                onClick={item.action.onAct}
                className="ioc-console-act ml-auto shrink-0"
              >
                {item.action.icon}
                {item.action.label}
              </button>
            )}
          </li>
        ))}
      </ul>
    </DebateSection>
  );
}
