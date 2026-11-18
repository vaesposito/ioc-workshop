import { LuChevronRight } from "react-icons/lu";

import type { AppDetail, RiskSign } from "./appDetailData";
import type { TakenMove } from "./consoleStanding";

interface Leg {
  /** What does it: the component of the fabric this step belongs to. */
  who: string;
  what: string;
  /** Where it stands on this application, read from the same data the
      columns are read from. */
  standing: string;
  act: string;
  onAct: () => void;
  /** Whether this step has happened on this application. */
  done: boolean;
  /** Set where what is standing is a fault rather than a count. */
  grave?: boolean;
}

/**
 * The application read as the work happens rather than as a set of
 * readings: the fabric takes the MAS on, the scope watches it, protocols
 * tighten it, an investigation says what is wrong, authorization is denied
 * where it has to be, and the scope keeps watching. The middle three are
 * where something is enforced, which the band above them says.
 */
export function ConsoleJourney({
  detail,
  risks,
  live,
  forced,
  looked,
  bad,
  canInvestigate,
  onOverview,
  onView,
  onProtocols,
  onInvestigate,
}: {
  detail: AppDetail;
  /** What the observability scope has against the sessions nobody has
      looked into yet. */
  risks: RiskSign[];
  /** The protocols running on the application. */
  live: string[];
  /** The controls an investigation left in force. */
  forced: TakenMove[];
  looked: number;
  bad: number;
  canInvestigate: boolean;
  onOverview: () => void;
  onView: (view: string) => void;
  onProtocols: () => void;
  onInvestigate: () => void;
}) {
  const issues = detail.summary.cognitiveFailures + detail.summary.fatalErrors;
  const denied = detail.app.applied.blockedCalls + forced.length;

  const legs: Leg[] = [
    {
      who: "Cognition Fabric",
      what: "Create the MAS",
      standing: `${detail.agents.length} agents and ${detail.tools.length} tools on the fabric`,
      act: "See the topology",
      onAct: onOverview,
      done: true,
    },
    {
      who: "Scope",
      what: "Observability: performance and failures",
      standing:
        issues > 0
          ? `${issues} cognitive failures, ${risks.length} worth exploring`
          : "Nothing standing against it",
      act: "Read the failures",
      onAct: () => onView("failures"),
      done: true,
      grave: issues > 0,
    },
    {
      who: "Cognition protocols",
      what: "Improve performance",
      standing:
        live.length > 0 ? `${live.join(" · ")} running` : "None running",
      act: live.length > 0 ? "Tighten the protocols" : "Put one on",
      onAct: onProtocols,
      done: live.length > 0,
    },
    {
      who: "Detective Active & Security Detection CEs",
      what: "Investigations, and what they leave to enforce",
      standing:
        looked === 0
          ? "Nothing investigated yet"
          : `${looked} of ${detail.sessions.length} investigated${
              bad > 0 ? `, ${bad} came back malicious` : ", nothing malicious"
            }`,
      act: canInvestigate ? "Start an investigation" : "See what was found",
      onAct: onInvestigate,
      done: looked > 0,
      grave: bad > 0 && forced.length === 0,
    },
    {
      who: "CASA CE",
      what: "Authorization denial",
      standing:
        denied > 0
          ? `${denied} ${denied === 1 ? "call" : "calls"} denied at the proxy`
          : "Nothing denied yet",
      act: "Read the security",
      onAct: () => onView("security"),
      done: denied > 0,
    },
    {
      who: "Scope",
      what: "Ongoing monitoring",
      standing: `Watching ${detail.sessions.length} sessions on this application`,
      act: "Read the metrics",
      onAct: () => onView("metrics"),
      done: true,
    },
  ];

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
            <span className="ioc-fg mt-1 block text-[12.5px] leading-[1.4]">
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
