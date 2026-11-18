import { useEffect, useRef, useState } from "react";
import { AGENT_TOM_PAGES, type AgentTomPage } from "../content/agentTom";

function PageContent({ page }: { page: AgentTomPage }) {
  return (
    <>
      <span className="ioc-kicker text-[color:var(--ioc-kicker)]">
        {page.kicker}
      </span>
      <h3 className="ioc-title ioc-overview-title mt-4">{page.title}</h3>
      <p className="ioc-copy mt-5 text-[17px] md:text-[18px]">{page.body}</p>
      {page.points ? (
        <ul className="mt-5 flex flex-col gap-2">
          {page.points.map((point) => (
            <li
              key={point}
              className="ioc-copy flex gap-2.5 text-[15px] md:text-[16px]"
            >
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--ioc-kicker)] shadow-[0_0_10px_rgba(4,164,202,0.7)]" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

function PipelineInteractive({
  steps,
}: {
  steps: NonNullable<AgentTomPage["pipeline"]>;
}) {
  const [index, setIndex] = useState(0);
  const step = steps[index];

  return (
    <div className="ioc-landing-reason-split">
      <ol className="ioc-landing-reason-nav">
        {steps.map((row, rowIndex) => {
          const active = rowIndex === index;
          return (
            <li key={row.name}>
              <button
                type="button"
                className={`ioc-landing-reason-nav-item ${active ? "is-active" : ""}`}
                aria-current={active ? "step" : undefined}
                onClick={() => setIndex(rowIndex)}
              >
                <span className="ioc-landing-reason-mark">{rowIndex + 1}</span>
                <span className="ioc-fg text-[15px] font-light leading-snug">
                  {row.name}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="ioc-overview-reason-detail ioc-glass">
        <div key={step.name} className="ioc-overview-reason-copy">
          <p className="ioc-kicker">Step {index + 1}</p>
          <p className="ioc-fg mt-2 text-[24px] font-light leading-[1.15] tracking-[-0.03em]">
            {step.name}
          </p>
          <p className="ioc-copy mt-3 text-[15px] leading-[1.55]">
            {step.detail}
          </p>
        </div>
      </div>
    </div>
  );
}

function GlowDefs({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={`${id}-beam`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#04a4ca" stopOpacity="0.2" />
        <stop offset="50%" stopColor="#7ddcf0" stopOpacity="0.95" />
        <stop offset="100%" stopColor="#04a4ca" stopOpacity="0.2" />
      </linearGradient>
      <filter id={`${id}-soft`} x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur stdDeviation="6" />
      </filter>
    </defs>
  );
}

function AgentTomArt({ id }: { id: string }) {
  const common = {
    viewBox: "0 0 240 240",
    fill: "none",
    className: "h-auto w-full max-w-[360px]",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (id === "learns") {
    return (
      <svg {...common} aria-hidden="true">
        <GlowDefs id="tom-learns" />
        <circle
          className="ioc-landing-constellation-glow"
          cx="120"
          cy="91"
          r="42"
          fill="rgba(4,164,202,0.22)"
          filter="url(#tom-learns-soft)"
        />
        <rect
          x="46"
          y="150"
          width="148"
          height="34"
          rx="9"
          fill="rgba(154,216,234,0.08)"
          stroke="rgba(154,216,234,0.45)"
          strokeWidth="1.5"
        />
        <rect
          x="46"
          y="112"
          width="148"
          height="34"
          rx="9"
          fill="rgba(4,164,202,0.1)"
          stroke="rgba(125,220,240,0.5)"
          strokeWidth="1.5"
        />
        <rect
          x="46"
          y="74"
          width="148"
          height="34"
          rx="9"
          fill="rgba(4,164,202,0.22)"
          stroke="#04A4CA"
          strokeWidth="1.8"
        />
        <path
          d="M60 91 h16 l7 -11 l9 20 l7 -9 h62"
          stroke="url(#tom-learns-beam)"
          strokeWidth="2.2"
        />
        <circle cx="60" cy="129" r="3.5" fill="#9ad8ea" />
        <circle cx="60" cy="167" r="3.5" fill="rgba(154,216,234,0.55)" />
        <path
          d="M150 129 h28 M150 167 h28"
          stroke="rgba(154,216,234,0.45)"
          strokeWidth="1.5"
        />
      </svg>
    );
  }

  if (id === "reasons") {
    const ys = [56, 104, 152, 200];
    return (
      <svg {...common} aria-hidden="true">
        <GlowDefs id="tom-reasons" />
        <circle
          className="ioc-landing-constellation-glow"
          cx="78"
          cy="152"
          r="28"
          fill="rgba(4,164,202,0.22)"
          filter="url(#tom-reasons-soft)"
        />
        <line
          x1="78"
          y1="56"
          x2="78"
          y2="200"
          stroke="rgba(125,220,240,0.35)"
          strokeWidth="1.5"
        />
        {ys.map((y, i) => (
          <g key={y}>
            <line
              x1="98"
              y1={y}
              x2={i === 2 ? 184 : 168}
              y2={y}
              stroke={i === 2 ? "#04A4CA" : "rgba(154,216,234,0.35)"}
              strokeWidth="1.5"
            />
            <rect
              x="102"
              y={y - 7}
              width={i === 2 ? 78 : 58}
              height="14"
              rx="7"
              fill={
                i === 2 ? "rgba(4,164,202,0.22)" : "rgba(154,216,234,0.1)"
              }
              stroke={i === 2 ? "#04A4CA" : "rgba(154,216,234,0.4)"}
              strokeWidth="1.2"
            />
            <circle
              cx="78"
              cy={y}
              r="13"
              strokeWidth={i === 2 ? 2.2 : 1.5}
              fill={i === 2 ? "rgba(4,164,202,0.28)" : "rgba(4,12,20,0.85)"}
              stroke={i === 2 ? "#7ddcf0" : "rgba(154,216,234,0.45)"}
            />
          </g>
        ))}
        <path
          d="M72 152 l4 5 l9 -11"
          stroke="#7ddcf0"
          strokeWidth="2.4"
        />
      </svg>
    );
  }

  const nodes = [
    [190, 70],
    [64, 70],
    [70, 180],
    [186, 176],
  ];
  return (
    <svg {...common} aria-hidden="true">
      <GlowDefs id="tom-what" />
      <circle
        className="ioc-landing-constellation-glow"
        cx="120"
        cy="120"
        r="36"
        fill="rgba(125,220,240,0.22)"
        filter="url(#tom-what-soft)"
      />
      <circle
        cx="120"
        cy="120"
        r="86"
        stroke="rgba(154,216,234,0.28)"
        strokeWidth="1.5"
      />
      <circle
        cx="120"
        cy="120"
        r="56"
        fill="rgba(4,164,202,0.06)"
        stroke="rgba(125,220,240,0.35)"
        strokeWidth="1.5"
      />
      <circle
        cx="120"
        cy="120"
        r="28"
        fill="rgba(4,164,202,0.12)"
        stroke="rgba(4,164,202,0.55)"
        strokeWidth="1.5"
      />
      {nodes.map(([x, y]) => (
        <line
          key={`${x}-${y}`}
          x1="120"
          y1="120"
          x2={x}
          y2={y}
          stroke="url(#tom-what-beam)"
          strokeWidth="1.6"
        />
      ))}
      {nodes.map(([x, y], i) => (
        <g key={`n-${x}-${y}`}>
          <circle
            className="ioc-landing-constellation-glow"
            cx={x}
            cy={y}
            r="16"
            fill="rgba(4,164,202,0.18)"
            filter="url(#tom-what-soft)"
            style={{ animationDelay: `${i * 0.7}s` }}
          />
          <circle cx={x} cy={y} r="8" fill="#e8fbff" />
        </g>
      ))}
      <path
        d="M120 34 A86 86 0 0 1 206 120"
        stroke="url(#tom-what-beam)"
        strokeWidth="2.6"
      />
      <circle cx="120" cy="120" r="11" fill="#7ddcf0" />
    </svg>
  );
}

export function AgentTomShowcase() {
  const contentRefs = useRef<(HTMLDivElement | null)[]>([]);
  const labelRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const artRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const reveal = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
          }
        }
      },
      { threshold: 0.2 },
    );
    for (const el of contentRefs.current) {
      if (el) reveal.observe(el);
    }

    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduce) {
      return () => reveal.disconnect();
    }

    let frame = 0;
    const update = () => {
      frame = 0;
      const vh = window.innerHeight;
      contentRefs.current.forEach((el, index) => {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const progress = (rect.top + rect.height / 2 - vh / 2) / vh;
        el.style.transform = `translate3d(0, ${(progress * 44).toFixed(2)}px, 0)`;
        const label = labelRefs.current[index];
        if (label) {
          label.style.transform = `translate3d(0, ${(progress * 88).toFixed(2)}px, 0)`;
        }
        const art = artRefs.current[index];
        if (art) {
          art.style.transform = `translate3d(0, ${(progress * -30).toFixed(2)}px, 0)`;
        }
      });
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const scroller =
      (contentRefs.current[0]?.closest("[data-deck]") as HTMLElement | null) ??
      null;
    update();
    (scroller ?? window).addEventListener("scroll", onScroll, {
      passive: true,
    });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      (scroller ?? window).removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      reveal.disconnect();
    };
  }, []);

  return (
    <section aria-label="How Agent-ToM works" className="flex flex-col">
      {AGENT_TOM_PAGES.map((page, index) => {
        const isPipeline = page.id === "pipeline" && page.pipeline;
        return (
          <div
            key={page.id}
            data-page
            className="flex h-[calc(100dvh-96px)] snap-start snap-always items-center"
          >
            <div
              className={
                isPipeline
                  ? "grid w-full grid-cols-1 items-center"
                  : "grid w-full grid-cols-1 items-center gap-10 lg:grid-cols-[1fr_minmax(0,380px)] lg:gap-16"
              }
            >
              <div
                ref={(el) => {
                  contentRefs.current[index] = el;
                }}
                className={`ioc-reveal will-change-transform ${isPipeline ? "max-w-none" : "max-w-3xl"}`}
              >
                <span
                  ref={(el) => {
                    labelRefs.current[index] = el;
                  }}
                  className="ioc-faint block text-[12px] font-medium tabular-nums will-change-transform"
                >
                  {String(index + 1).padStart(2, "0")} — {page.step}
                </span>
                <div className="mt-5">
                  <PageContent page={page} />
                  {page.pipeline ? (
                    <div className="mt-6">
                      <PipelineInteractive steps={page.pipeline} />
                    </div>
                  ) : null}
                </div>
              </div>
              {isPipeline ? null : (
                <div
                  ref={(el) => {
                    artRefs.current[index] = el;
                  }}
                  className="hidden justify-center will-change-transform lg:flex"
                >
                  <div className="ioc-overview-art">
                    <AgentTomArt id={page.id} />
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}
