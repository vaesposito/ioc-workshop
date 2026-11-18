/** What an investigation does, said while it is doing it. */
export const PROBE_STEPS = [
  "Reading the session end to end",
  "Scoring each agent against what it was told",
  "Tracing the fault back to where it started",
  "Writing up what was found",
];

/** How long each step is held, in milliseconds. */
export const PROBE_BEAT = 900;

/** An investigation walking its steps, wherever it was started from. */
export function ConsoleProbe({ step, said }: { step: number; said?: string }) {
  return (
    <div>
      {said ? <p className="ioc-console-note">{said}</p> : null}
      <ol className="ioc-console-probe mt-3">
        {PROBE_STEPS.map((entry, index) => (
          <li
            key={entry}
            className={`ioc-console-probe-step${index < step ? " is-done" : ""}${
              index === step ? " is-now" : ""
            }`}
          >
            <span className="ioc-console-probe-dot" aria-hidden />
            {entry}
          </li>
        ))}
      </ol>
    </div>
  );
}
