import { useEffect, useRef, useState } from "react";
import { LuArrowRight, LuArrowUpRight, LuChevronDown } from "react-icons/lu";
import { useNavigate } from "react-router-dom";
import { AgentTomShowcase } from "../components/AgentTomShowcase";
import { Layout } from "../components/Layout";
// import { AGENT_TOM_BLOG_URL, AGENT_TOM_PAPER_URL } from "../content/agentTom";
import { AGENT_TOM_PAPER_URL } from "../content/agentTom";

function LandingConstellation() {
  return (
    <div className="ioc-landing-constellation" aria-hidden="true">
      <svg viewBox="0 0 420 280" className="ioc-landing-constellation-svg">
        <defs>
          <linearGradient id="ioc-landing-beam" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#04a4ca" stopOpacity="0.15" />
            <stop offset="50%" stopColor="#7ddcf0" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#04a4ca" stopOpacity="0.15" />
          </linearGradient>
          <filter id="ioc-landing-soft">
            <feGaussianBlur stdDeviation="6" />
          </filter>
          <mask id="ioc-landing-beam-mask">
            <rect width="420" height="280" fill="white" />
            <circle cx="70" cy="150" r="14" fill="black" />
            <circle cx="210" cy="88" r="17" fill="black" />
            <circle cx="350" cy="150" r="14" fill="black" />
          </mask>
        </defs>
        <g mask="url(#ioc-landing-beam-mask)">
          <path
            d="M70 150 C 140 70, 280 70, 350 150"
            fill="none"
            stroke="url(#ioc-landing-beam)"
            strokeWidth="2"
          />
          <path
            d="M70 150 C 140 230, 280 230, 350 150"
            fill="none"
            stroke="url(#ioc-landing-beam)"
            strokeWidth="1.5"
            opacity="0.55"
          />
        </g>
        <circle
          className="ioc-landing-constellation-glow"
          cx="70"
          cy="150"
          r="22"
          fill="rgba(4,164,202,0.18)"
          filter="url(#ioc-landing-soft)"
        />
        <circle
          className="ioc-landing-constellation-glow"
          cx="210"
          cy="88"
          r="28"
          fill="rgba(125,220,240,0.22)"
          filter="url(#ioc-landing-soft)"
        />
        <circle
          className="ioc-landing-constellation-glow"
          cx="350"
          cy="150"
          r="22"
          fill="rgba(4,164,202,0.18)"
          filter="url(#ioc-landing-soft)"
        />
        <circle cx="70" cy="150" r="8" fill="#e8fbff" />
        <circle cx="210" cy="88" r="11" fill="#7ddcf0" />
        <circle cx="350" cy="150" r="8" fill="#e8fbff" />
      </svg>
      <p className="ioc-landing-constellation-tag ioc-landing-constellation-tag-trace">
        Trace
      </p>
      <p className="ioc-landing-constellation-tag ioc-landing-constellation-tag-reason">
        Reasoning
      </p>
      <p className="ioc-landing-constellation-tag ioc-landing-constellation-tag-verdict">
        Verdict
      </p>
    </div>
  );
}

export function Overview() {
  const navigate = useNavigate();
  const [leaving, setLeaving] = useState(false);
  const deckRef = useRef<HTMLDivElement | null>(null);
  const pagesRef = useRef<HTMLElement[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const deck = deckRef.current;
    if (!deck) return;
    const els = Array.from(deck.querySelectorAll<HTMLElement>("[data-page]"));
    pagesRef.current = els;
    setPageCount(els.length);

    const ratios = new Map<Element, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          ratios.set(entry.target, entry.intersectionRatio);
        }
        let best = 0;
        let bestRatio = -1;
        els.forEach((el, index) => {
          const ratio = ratios.get(el) ?? 0;
          if (ratio > bestRatio) {
            bestRatio = ratio;
            best = index;
          }
        });
        setActive(best);
      },
      { root: deck, threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const goToPage = (index: number) => {
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    pagesRef.current[index]?.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "start",
    });
  };

  function goToApplications() {
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduce) {
      navigate("/applications");
      return;
    }
    setLeaving(true);
    window.setTimeout(() => navigate("/applications"), 220);
  }

  return (
    <Layout
      wideContent
      headerAction={
        <button
          type="button"
          onClick={goToApplications}
          className="ioc-btn-primary ioc-btn-glow"
        >
          See demo
          <LuArrowRight size={14} />
        </button>
      }
    >
      {pageCount > 1 ? (
        <nav
          aria-label="Sections"
          className="fixed top-1/2 left-6 z-20 hidden -translate-y-1/2 flex-col gap-2.5 md:flex"
        >
          {Array.from({ length: pageCount }).map((_, index) => {
            const current = index === active;
            return (
              <button
                key={index}
                type="button"
                onClick={() => goToPage(index)}
                aria-label={`Go to section ${index + 1}`}
                aria-current={current ? "true" : undefined}
                className={`w-1 rounded-full transition-all duration-200 ${
                  current
                    ? "h-7 bg-[color:var(--ioc-kicker)]"
                    : "h-3 bg-[color:var(--ioc-glass-border)] hover:bg-[color:var(--ioc-muted)]"
                }`}
              />
            );
          })}
        </nav>
      ) : null}

      {/* One fixed cue rather than one per section: every page fills the
          viewport, so a single element reads as sitting at the bottom of
          whichever page is showing. Dropped on the last one, with nothing
          left to scroll to. */}
      {pageCount > 1 && active < pageCount - 1 ? (
        <button
          type="button"
          onClick={() => goToPage(active + 1)}
          aria-label="Scroll to next section"
          className="ioc-scroll-cue"
        >
          <LuChevronDown size={22} />
        </button>
      ) : null}

      <div
        data-deck
        ref={deckRef}
        className="ioc-no-scrollbar h-[calc(100dvh-96px)] snap-y snap-mandatory overflow-y-auto md:pl-10"
      >
        <div
          className={`flex flex-col transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none ${
            leaving ? "translate-y-2 opacity-0" : "opacity-100"
          }`}
        >
          <AgentTomShowcase />

          <div
            data-page
            className="flex h-[calc(100dvh-96px)] snap-start snap-always items-center"
          >
            <div className="grid w-full grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(16rem,0.95fr)] lg:gap-16">
              <div className="max-w-xl">
                <span className="ioc-faint block text-[12px] font-medium tabular-nums">
                  05 — See demo
                </span>
                <span className="ioc-kicker mt-5 block text-[color:var(--ioc-kicker)]">
                  See the demo
                </span>
                <h3 className="ioc-title ioc-overview-title mt-4">
                  The rest is a live workspace.
                </h3>
                <p className="ioc-copy mt-5 text-[17px] md:text-[18px]">
                  Open a sample application, read a trace, then follow Agent-ToM
                  from the verdict back to the step that mattered.
                </p>
                <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
                  {/* <a
                    href={AGENT_TOM_BLOG_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ioc-link inline-flex items-center gap-1 text-[15px]"
                  >
                    Read the blog
                    <LuArrowUpRight size={14} />
                  </a> */}
                  <span
                    className="ioc-wip inline-flex cursor-default items-center gap-1 text-[15px]"
                    data-wip="Work in progress"
                  >
                    Read the blog
                    <LuArrowUpRight size={14} />
                  </span>
                  <a
                    href={AGENT_TOM_PAPER_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ioc-link inline-flex items-center gap-1 text-[15px]"
                  >
                    Read the paper
                    <LuArrowUpRight size={14} />
                  </a>
                  <button
                    type="button"
                    onClick={goToApplications}
                    className="ioc-cta"
                  >
                    See demo
                    <LuArrowRight size={18} />
                  </button>
                </div>
              </div>
              <LandingConstellation />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
