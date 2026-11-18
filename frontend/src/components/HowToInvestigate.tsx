const STEPS = [
  {
    n: "1",
    title: "Application",
    body: "Select an existing application or create a new one.",
  },
  {
    n: "2",
    title: "Trace",
    body: "Reuse a trace already on that application, or upload a new one.",
  },
  {
    n: "3",
    title: "Investigate",
    body: "Start Detective Agent from the same sidebar.",
  },
];

export function HowToInvestigate() {
  return (
    <section className="ioc-glass rounded-xl px-5 py-4">
      <p className="ioc-kicker">How to investigate</p>
      <ol className="mt-4 grid gap-4 sm:grid-cols-3">
        {STEPS.map((step) => (
          <li key={step.n} className="flex gap-3">
            <span className="ioc-faint flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[color:var(--ioc-glass-border)] text-[11px] font-medium">
              {step.n}
            </span>
            <div>
              <p className="ioc-fg text-[13px] font-light">{step.title}</p>
              <p className="ioc-faint mt-1 text-[12px] font-light leading-5">
                {step.body}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
