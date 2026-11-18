import { useNavigate } from "react-router-dom";

import { ConsoleJourney, type JourneyLeg } from "./ConsoleJourney";
import { ConsoleShell } from "./ConsoleShell";
import { CONSOLE_APPS } from "./consoleData";
import { detailFor, risksFor, type SessionRow } from "./appDetailData";
import { useConsoleStanding, type ConsoleStanding } from "./consoleStanding";

/** Everything one application brings to the journey, counted the same way
    the application's own page counts it. */
function standOf(appId: string, standing: ConsoleStanding) {
  const detail = detailFor(appId);
  if (!detail) return null;
  const mine = standing.looked.filter((entry) => entry.app === appId);
  const forced = standing.taken.filter(
    (entry) => entry.app === appId && entry.standing === "held",
  );
  const verdictOf = (run: SessionRow): SessionRow["verdict"] =>
    run.investigated
      ? run.verdict
      : mine.find((entry) => entry.session === run.id)?.verdict;

  return {
    id: appId,
    name: detail.app.name,
    detail,
    agents: detail.agents.length,
    tools: detail.tools.length,
    issues: detail.summary.cognitiveFailures + detail.summary.fatalErrors,
    risks: risksFor(detail.sessions, (run) => Boolean(verdictOf(run))),
    live: standing.protocols[appId] ?? detail.protocols.map((p) => p.code),
    sessions: detail.sessions.length,
    looked: detail.sessions.filter((run) => Boolean(verdictOf(run))).length,
    bad:
      detail.summary.maliciousTraces +
      mine.filter((entry) => entry.verdict === "malicious").length,
    denied: detail.app.applied.blockedCalls + forced.length,
    /** The worst session nobody has looked into yet. */
    next: [...detail.sessions]
      .filter((run) => !verdictOf(run))
      .sort((a, b) => b.failures - a.failures)[0],
  };
}

/** The application with most of something, which is where a step opens. */
function most<T>(list: T[], of: (entry: T) => number): T {
  return [...list].sort((a, b) => of(b) - of(a))[0];
}

/**
 * The journey as a section of the console in its own right: the work in the
 * order it happens, counted across every application on the fabric. Each
 * step opens where that work is done, on whichever application has most of
 * it to show.
 */
export function ConsoleJourneyPage() {
  const navigate = useNavigate();
  const standing = useConsoleStanding();
  const stands = CONSOLE_APPS.map((app) => standOf(app.id, standing)).filter(
    (entry): entry is NonNullable<ReturnType<typeof standOf>> => entry !== null,
  );

  const sum = (of: (entry: (typeof stands)[number]) => number) =>
    stands.reduce((total, entry) => total + of(entry), 0);
  const issues = sum((entry) => entry.issues);
  const risks = sum((entry) => entry.risks.length);
  const sessions = sum((entry) => entry.sessions);
  const looked = sum((entry) => entry.looked);
  const bad = sum((entry) => entry.bad);
  const denied = sum((entry) => entry.denied);
  const running = stands.filter((entry) => entry.live.length > 0);
  const codes = [...new Set(running.flatMap((entry) => entry.live))];

  // Where each step opens: the application with most of that work left.
  const sore = most(stands, (entry) => entry.issues + entry.risks.length);
  const loose = most(stands, (entry) => entry.risks.length - entry.live.length);
  const worst = most(
    stands.filter((entry) => entry.next),
    (entry) => entry.next.failures,
  );
  const held = most(stands, (entry) => entry.denied + entry.bad);
  const watched = most(stands, (entry) => entry.sessions);
  const at = (entry: (typeof stands)[number]) => `/console/apps/${entry.id}`;

  const legs: JourneyLeg[] = [
    {
      who: "Cognition Fabric",
      what: "Onboard the MAS",
      standing: `${stands.length} applications on the fabric, ${sum((entry) => entry.agents)} agents and ${sum((entry) => entry.tools)} tools between them`,
      onAct: () => navigate("/console"),
      done: true,
    },
    {
      who: "Scope",
      what: "Observability: performance and failures",
      standing:
        issues > 0
          ? `${issues} cognitive failures and ${risks} sessions worth exploring, most of them on ${sore.name}`
          : "Nothing standing against any of them",
      onAct: () => navigate(`${at(sore)}?view=failures`),
      done: true,
      grave: issues > 0,
    },
    {
      who: "Cognition protocols",
      what: "Improve cognition health and performance",
      standing:
        running.length > 0
          ? `${codes.join(" · ")} running on ${running.length} of ${stands.length} applications`
          : "None running anywhere",
      via: "via Agent bridge proxy",
      onAct: () => navigate(`${at(loose)}?view=protocols&picking=1`),
      done: running.length > 0,
    },
    {
      who: "Detective Active & Security Detection CEs",
      what: "Investigations, and what they leave to enforce",
      standing:
        looked === 0
          ? `Nothing investigated yet, out of ${sessions} sessions`
          : `${looked} of ${sessions} sessions investigated${
              bad > 0 ? `, ${bad} came back malicious` : ", nothing malicious"
            }`,
      onAct: () =>
        navigate(
          worst
            ? `${at(worst)}/traces/${worst.next.id}`
            : `${at(held)}?view=security`,
        ),
      done: looked > 0,
      grave: bad > 0 && denied === 0,
    },
    {
      who: "CASA CE",
      what: "Authorization denial",
      standing:
        denied > 0
          ? `${denied} ${denied === 1 ? "call" : "calls"} denied at the proxy, most of them on ${held.name}`
          : "Nothing denied yet",
      onAct: () => navigate(`${at(held)}?view=security`),
      done: denied > 0,
    },
    {
      who: "Scope",
      what: "Ongoing monitoring",
      standing: `Watching ${sessions} sessions across ${stands.length} applications`,
      onAct: () => navigate(`${at(watched)}?view=metrics`),
      done: true,
    },
  ];

  return (
    <ConsoleShell>
      <p className="ioc-kicker">Journey</p>
      <h1 className="ioc-title mt-1 text-[26px] font-light">
        From onboarding a MAS to watching it run
      </h1>
      <p className="ioc-copy mt-2 max-w-[760px] text-[12.5px] leading-[1.6] font-light">
        Every step is a piece of the fabric doing its part, in the order it
        happens, counted across every application on the console. Each step
        opens where that work is done.
      </p>

      <div className="mt-5">
        <ConsoleJourney legs={legs} />
      </div>
    </ConsoleShell>
  );
}
