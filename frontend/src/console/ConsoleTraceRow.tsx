import { Link } from "react-router-dom";

import { COST_LOOSE, type SessionRow } from "./appDetailData";

/**
 * One run in a list of runs, written the same way wherever runs are listed:
 * in the column beside an application, and inside a reading that points at
 * particular ones.
 */
export function ConsoleTraceRow({
  appId,
  session,
  usual = 0,
  lit = false,
  far = false,
}: {
  appId: string;
  session: SessionRow;
  /** What a session on this application usually costs, where the list knows. */
  usual?: number;
  /** Set where something picked on the page was part of this run. */
  lit?: boolean;
  /** Set where something is picked and this run had nothing to do with it. */
  far?: boolean;
}) {
  // A session that cost well over the rest of them: not a fault, but not
  // what this application usually spends to answer.
  const loose = usual > 0 && session.costScore >= usual * COST_LOOSE;
  const over =
    usual > 0 ? Math.round((session.costScore / usual - 1) * 100) : 0;
  return (
    <Link
      to={`/console/apps/${appId}/traces/${session.id}`}
      className={`ioc-console-session${lit ? " is-lit" : ""}${
        far ? " is-far" : ""
      }`}
    >
      <span className="flex items-center gap-2">
        <span className={`ioc-console-dot is-${session.status}`} />
        <span className="ioc-fg text-[12px]">{session.id}</span>
        <span className="ioc-faint ml-auto text-[11px]">{session.when}</span>
      </span>
      <span className="ioc-faint mt-1 block truncate text-[11px]">
        {session.topic}
      </span>
      <span className="mt-1.5 flex items-center gap-1.5">
        <span
          className={`ioc-console-pill${session.failures > 0 ? " is-danger" : ""}`}
          title="Cognitive failures the detectors found in this session."
        >
          {session.failures} cognitive
        </span>
        <span
          className={`ioc-console-pill${loose ? " is-warn" : ""}`}
          title={
            loose
              ? `Cost ${session.costScore} against the ${usual} this application usually spends, ${over}% over. Worth a look at what it spent it on.`
              : "Cost against what the answer was worth, out of ten."
          }
        >
          cost {session.costScore}
        </span>
        {session.investigated ? (
          <span
            className={`ioc-console-pill${session.verdict === "malicious" ? " is-danger" : ""}`}
            title={`An investigation on this session came back ${session.verdict}.`}
          >
            {session.verdict}
          </span>
        ) : null}
        <span className="ioc-faint ml-auto text-[10.5px]">
          {session.spans} spans
        </span>
      </span>
    </Link>
  );
}
