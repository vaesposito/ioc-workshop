import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { ConsoleJourney } from "./ConsoleJourney";
import { ConsoleShell } from "./ConsoleShell";
import { CONSOLE_APPS } from "./consoleData";
import { detailFor, risksFor, type SessionRow } from "./appDetailData";
import { useConsoleStanding } from "./consoleStanding";

/**
 * The journey as a section of the console in its own right: the work in the
 * order it happens, from the fabric taking a MAS on to the scope watching it
 * afterwards. An application is picked at the top, since every step is read
 * against one.
 */
export function ConsoleJourneyPage() {
  const navigate = useNavigate();
  const [appId, setAppId] = useState(CONSOLE_APPS[0]?.id ?? "");
  const detail = detailFor(appId);
  const standing = useConsoleStanding();

  if (!detail) {
    return (
      <ConsoleShell>
        <p className="ioc-copy">No application to walk.</p>
      </ConsoleShell>
    );
  }

  const mine = standing.looked.filter((entry) => entry.app === detail.app.id);
  const forced = standing.taken.filter(
    (entry) => entry.app === detail.app.id && entry.standing === "held",
  );
  const verdictOf = (run: SessionRow): SessionRow["verdict"] =>
    run.investigated
      ? run.verdict
      : mine.find((entry) => entry.session === run.id)?.verdict;

  const looked = detail.sessions.filter((run) =>
    Boolean(verdictOf(run)),
  ).length;
  const live =
    standing.protocols[detail.app.id] ??
    detail.protocols.map((entry) => entry.code);
  const bad =
    detail.summary.maliciousTraces +
    mine.filter((entry) => entry.verdict === "malicious").length;
  const risks = risksFor(detail.sessions, (run) => Boolean(verdictOf(run)));
  // The session an investigation would be spent on first: the worst of the
  // ones nobody has looked into.
  const next = [...detail.sessions]
    .filter((run) => !verdictOf(run))
    .sort((a, b) => b.failures - a.failures)[0];

  const at = `/console/apps/${detail.app.id}`;

  return (
    <ConsoleShell>
      <p className="ioc-kicker">Journey</p>
      <h1 className="ioc-title mt-1 text-[26px] font-light">
        From creating a MAS to watching it run
      </h1>
      <p className="ioc-copy mt-2 max-w-[760px] text-[12.5px] leading-[1.6] font-light">
        Every step is a piece of the fabric doing its part, in the order it
        happens. Pick an application to read the steps against, and each one
        opens where that work is done.
      </p>

      <ul className="mt-4 flex flex-wrap gap-1.5">
        {CONSOLE_APPS.map((app) => (
          <li key={app.id}>
            <button
              type="button"
              onClick={() => setAppId(app.id)}
              aria-pressed={app.id === appId}
              className={`ioc-console-tag is-link${
                app.id === appId ? " is-picked" : ""
              }`}
            >
              {app.name}
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-5">
        <ConsoleJourney
          detail={detail}
          risks={risks}
          live={live}
          forced={forced}
          looked={looked}
          bad={bad}
          canInvestigate={Boolean(next)}
          onOverview={() => navigate(at)}
          onView={(view) => navigate(`${at}?view=${view}`)}
          onProtocols={() => navigate(`${at}?view=protocols&picking=1`)}
          onInvestigate={() =>
            navigate(next ? `${at}/traces/${next.id}` : `${at}?view=security`)
          }
        />
      </div>
    </ConsoleShell>
  );
}
