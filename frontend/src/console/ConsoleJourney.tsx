import { LuChevronRight } from "react-icons/lu";

export interface JourneyLeg {
  /** What does it: the component of the fabric this step belongs to. */
  who: string;
  what: string;
  /** Where the console stands on this step, read from the same data the
      applications are read from. */
  standing: string;
  act: string;
  onAct: () => void;
  /** Whether this step has happened anywhere yet. */
  done: boolean;
  /** Set where what is standing is a fault rather than a count. */
  grave?: boolean;
}

/**
 * The console read as the work happens rather than as a set of applications:
 * the fabric takes a MAS on, the scope watches it, protocols tighten it, an
 * investigation says what is wrong, authorization is denied where it has to
 * be, and the scope keeps watching. The middle three are where something is
 * enforced, which the band above them says.
 */
export function ConsoleJourney({ legs }: { legs: JourneyLeg[] }) {
  return (
    <div className="ioc-journey ioc-no-scrollbar">
      <div className="ioc-journey-grid">
        {/* What the middle three have in common, said once over them. */}
        <p className="ioc-journey-band">Enforcement</p>
        {legs.map((leg, index) => (
          <button
            key={leg.who + leg.what}
            type="button"
            onClick={leg.onAct}
            className={`ioc-journey-leg${leg.done ? " is-done" : ""}${
              leg.grave ? " is-grave" : ""
            }`}
          >
            <span className="ioc-journey-mark">{index + 1}</span>
            <span className="ioc-kicker">{leg.who}</span>
            <span className="ioc-journey-what ioc-fg mt-1 block text-[12.5px] leading-[1.4]">
              {leg.what}
            </span>
            <span className="ioc-faint mt-1 block text-[11px] leading-[1.45] font-light">
              {leg.standing}
            </span>
            <span className="ioc-journey-act">
              {leg.act}
              <LuChevronRight size={12} aria-hidden />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
