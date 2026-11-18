import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LuInfo, LuPlus } from "react-icons/lu";
import { ConsoleDial } from "./ConsoleDial";
import { CONSOLE_APPS, healthOf, type ConsoleApp } from "./consoleData";
import { ConsoleShell } from "./ConsoleShell";

/** The ring's two ends, and the light behind the card, per band. */
const TONES = {
  poor: { from: "#f0652f", to: "#f6b356" },
  fair: { from: "#2f6df6", to: "#7aa7ff" },
  good: { from: "#04a4ca", to: "#7ee0f0" },
} as const;

function toneFor(app: ConsoleApp): (typeof TONES)[keyof typeof TONES] {
  const health = healthOf(app);
  if (health < 0.6) return TONES.poor;
  if (health < 0.8) return TONES.fair;
  return TONES.good;
}

/**
 * The two angles a card is read from: is it working, and is it being pushed
 * at. What is only a risk until somebody looks into it is said as a risk.
 */
function anglesOf(app: ConsoleApp) {
  const looked = app.maliciousTraces > 0;
  return [
    {
      id: "performance",
      label: "Performance",
      hint: "Sessions that stopped before answering, answered the wrong way, or broke down reasoning.",
      count: app.fatalErrors + app.minorErrors + app.cognitiveFailures,
      bad: app.fatalErrors > 0,
      unit: "issues",
      said: `${app.fatalErrors} fatal, ${app.minorErrors} minor, ${app.cognitiveFailures} cognitive, of ${app.traces} sessions`,
    },
    looked
      ? {
          id: "security",
          label: "Security issues",
          hint: "Sessions an investigation went through and came back calling malicious.",
          count: app.maliciousTraces,
          bad: true,
          unit: "confirmed",
          said: `${app.maliciousTraces} sessions investigated and came back malicious`,
        }
      : {
          id: "security",
          label: "Potential risks",
          hint: "Calls outside what the application declares. A reason to investigate, not a finding.",
          count: app.deniedCalls,
          bad: false,
          unit: "to inspect",
          said: `${app.deniedCalls} calls refused, nothing investigated yet`,
        },
  ];
}

/** What is already in place off the back of what was found. */
function appliedOf(app: ConsoleApp): { total: number; said: string } {
  const { protocols, blockedAgents, blockedCalls } = app.applied;
  const parts = [
    protocols > 0
      ? `${protocols} L9 ${protocols === 1 ? "protocol" : "protocols"}`
      : null,
    blockedAgents > 0
      ? `${blockedAgents} ${blockedAgents === 1 ? "agent" : "agents"} blocked`
      : null,
    blockedCalls > 0 ? `${blockedCalls} call routes denied` : null,
  ].filter((part): part is string => part !== null);
  return {
    total: protocols + blockedAgents + blockedCalls,
    said: parts.length > 0 ? parts.join(" · ") : "Nothing applied yet",
  };
}

/**
 * The console's entry point: every application as a card, led by how well it
 * is running, with what it is made of, what its agents were allowed to call,
 * and what that cost underneath.
 */
export function ConsoleApps() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const cards = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return CONSOLE_APPS.filter((app) =>
      needle ? app.name.toLowerCase().includes(needle) : true,
    );
  }, [search]);

  return (
    <ConsoleShell search={search} onSearch={setSearch}>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="ioc-title text-[26px] font-light">Applications</h1>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            data-tour="apps-add"
            title="Not wired yet."
            className="ioc-console-act"
          >
            <LuPlus size={13} />
            Create MAS
          </button>
        </div>
      </div>

      <div
        data-tour="apps-grid"
        className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
      >
        {cards.map((app) => {
          const tone = toneFor(app);
          return (
            <article
              key={app.id}
              role="link"
              tabIndex={0}
              onClick={() => navigate(`/console/apps/${app.id}`)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  navigate(`/console/apps/${app.id}`);
                }
              }}
              className="ioc-console-card is-link"
            >
              <span
                className="ioc-console-card-glow"
                style={{ background: tone.from }}
                aria-hidden
              />

              <h2 className="ioc-fg text-[15px] font-normal">{app.name}</h2>
              <p className="ioc-copy ioc-console-card-copy">
                {app.description}
              </p>

              <div
                data-tour={app === cards[0] ? "apps-dial" : undefined}
                className="mt-4 flex flex-col items-center"
              >
                <ConsoleDial
                  value={healthOf(app)}
                  from={tone.from}
                  to={tone.to}
                  label={`${app.name}: ${Math.round(healthOf(app) * 100)}% health, from its performance and security`}
                />
                <p className="ioc-console-dial-label">Health score</p>
              </div>

              <div
                data-tour={app === cards[0] ? "apps-stats" : undefined}
                className="ioc-console-card-grid"
              >
                {anglesOf(app).map((angle) => (
                  <div key={angle.id} className="flex min-w-0 flex-col gap-1.5">
                    <span className="ioc-console-stat-label">
                      {angle.label}
                      <LuInfo size={11} aria-hidden title={angle.hint} />
                    </span>
                    <span
                      className={`text-[18px] leading-none font-light ${
                        angle.count === 0
                          ? "ioc-fg"
                          : angle.bad
                            ? "sev-danger-text"
                            : "ioc-warn-text"
                      }`}
                    >
                      {angle.count}
                      <span className="ioc-faint ml-1 text-[11px]">
                        {angle.unit}
                      </span>
                    </span>
                    <span className="ioc-faint text-[10.5px] leading-[1.4] font-light">
                      {angle.said}
                    </span>
                  </div>
                ))}
                <div className="col-span-2 flex min-w-0 flex-col gap-1.5">
                  <span className="ioc-console-stat-label">
                    Applied solutions
                    <LuInfo
                      size={11}
                      aria-hidden
                      title="Protocols configured, agents blocked, and call routes denied off the back of what was found."
                    />
                  </span>
                  <span className="ioc-fg text-[18px] leading-none font-light">
                    {appliedOf(app).total}
                    <span className="ioc-faint ml-1 text-[11px]">in place</span>
                  </span>
                  <span className="ioc-faint text-[10.5px] leading-[1.4] font-light">
                    {appliedOf(app).said}
                  </span>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {cards.length === 0 ? (
        <p className="ioc-faint mt-6 text-[12px] font-light">
          No applications match that search.
        </p>
      ) : null}
    </ConsoleShell>
  );
}
