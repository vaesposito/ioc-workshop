import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { LuCheck, LuTriangleAlert } from "react-icons/lu";

import { DebateSection } from "../components/DebateSection";

/** A count of one kind of problem, and where it stands against being fixed. */
export interface Guidance {
  id: string;
  /** Whether this is something wrong, or something proposed about it.
      Issues are read first; what an investigation recommends follows. */
  kind?: "issue" | "offer";
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

/** One banner: what it counts, where it stands, and the step it offers. */
function Banner({ item }: { item: Guidance }) {
  return (
    <li
      data-tour={`alert-${item.id}`}
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
          data-tour={`act-${item.id}`}
          className="ioc-console-act ml-auto shrink-0"
        >
          {item.action.icon}
          {item.action.label}
        </Link>
      ) : (
        <button
          type="button"
          data-tour={`act-${item.id}`}
          onClick={item.action.onAct}
          className="ioc-console-act ml-auto shrink-0"
        >
          {item.action.icon}
          {item.action.label}
        </button>
      )}
    </li>
  );
}

/**
 * What is wrong with the page, and what is proposed about it: two blocks,
 * since a count of what is standing is read differently from a step waiting
 * to be taken. Either folds away for a reader who has dealt with it.
 */
export function ConsoleAlert({ items }: { items: Guidance[] }) {
  if (items.length === 0) return null;

  const wrong = items.filter((item) => (item.kind ?? "issue") === "issue");
  const offered = items.filter((item) => item.kind === "offer");
  const standing = wrong.filter((item) => !item.settled).length;
  const toTake = offered.filter((item) => !item.settled).length;

  return (
    <div data-tour="alerts">
      {wrong.length === 0 ? null : (
        <DebateSection
          label="Issues"
          preview={standing === 0 ? "none standing" : `${standing} standing`}
          defaultOpen
        >
          <ul className="ioc-console-guidance">
            {wrong.map((item) => (
              <Banner key={item.id} item={item} />
            ))}
          </ul>
        </DebateSection>
      )}
      {offered.length === 0 ? null : (
        <div data-tour="offers">
          <DebateSection
            label="Recommendations"
            preview={toTake === 0 ? "all taken" : `${toTake} to take`}
            defaultOpen
          >
            <ul className="ioc-console-guidance">
              {offered.map((item) => (
                <Banner key={item.id} item={item} />
              ))}
            </ul>
          </DebateSection>
        </div>
      )}
    </div>
  );
}
