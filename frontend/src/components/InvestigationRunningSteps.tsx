import { useCallback, useEffect, useRef, useState } from "react";
import {
  LINKED_REASONING_STEPS,
  reasoningStepMark,
  type ModelReasoningSection,
} from "../utils/modelReasoning";
import { useSimulatedReasoningProgress } from "../hooks/useSimulatedReasoningProgress";
import {
  parseEvidenceDisplay,
  type PipelineEvidence,
} from "../utils/evidencePipeline";
import { formatConfidencePercent } from "../utils/detectiveResult";

// Streaming cadence for the reasoning steps. Fixed, readable speed — the run
// stays "live" until the stream finishes rather than racing a fixed window.
const STREAM_INTERVAL_MS = 55;
const STREAM_CHUNK = 3;
const STEP_DWELL_MS = 500;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function sectionToText(section: ModelReasoningSection): string {
  return section.blocks
    .map((block) =>
      block.type === "ul"
        ? block.items.map((item) => `• ${item}`).join("\n")
        : block.text,
    )
    .join("\n\n")
    .trim();
}

function useSequentialReveal(
  total: number,
  enabled: boolean,
  intervalMs = 280,
): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!enabled || prefersReducedMotion() || total === 0) {
      setCount(total);
      return;
    }
    setCount(0);
    const id = window.setInterval(() => {
      setCount((current) => {
        const next = current + 1;
        if (next >= total) {
          window.clearInterval(id);
          return total;
        }
        return next;
      });
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [total, enabled, intervalMs]);
  return count;
}

function StreamingReasoning({
  header,
  sections,
  evidence,
  onComplete,
  resumeIndex = 0,
}: {
  header: React.ReactNode;
  sections: ModelReasoningSection[];
  evidence: PipelineEvidence[];
  onComplete?: () => void;
  resumeIndex?: number;
}) {
  const reduceMotion = prefersReducedMotion();
  // Resume at the globally-tracked step (elapsed-time based) so navigating away
  // and back continues the stream instead of restarting from the first step.
  const [currentIndex, setCurrentIndex] = useState(() =>
    reduceMotion
      ? sections.length
      : Math.min(Math.max(resumeIndex, 0), sections.length),
  );
  const [wordCount, setWordCount] = useState(0);
  const activeStepRef = useRef<HTMLLIElement>(null);
  const firedCompleteRef = useRef(false);

  const complete = currentIndex >= sections.length;
  const activeFull = complete ? "" : sectionToText(sections[currentIndex]);
  const words = activeFull ? activeFull.split(/(\s+)/) : [];
  const total = words.length;

  const handleStreamComplete = useCallback(() => {
    if (firedCompleteRef.current) {
      return;
    }
    firedCompleteRef.current = true;
    onComplete?.();
  }, [onComplete]);

  // Reset the word cursor synchronously whenever we move to a new step so the
  // "done" check can never read a stale value from the previous step.
  const prevIndexRef = useRef(currentIndex);
  if (prevIndexRef.current !== currentIndex) {
    prevIndexRef.current = currentIndex;
    if (wordCount !== 0) {
      setWordCount(0);
    }
  }

  // Start at the very top of the page so the task/app/trace context is visible;
  // the per-step effect below then keeps the active step in focus as it streams.
  useEffect(() => {
    if (reduceMotion) {
      return;
    }
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [reduceMotion]);

  // Stream the current step's text word by word.
  useEffect(() => {
    if (reduceMotion || complete || total === 0) {
      return;
    }
    const id = window.setInterval(() => {
      setWordCount((count) => {
        const next = count + STREAM_CHUNK;
        if (next >= total) {
          window.clearInterval(id);
          return total;
        }
        return next;
      });
    }, STREAM_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [currentIndex, total, reduceMotion, complete]);

  const streamedDone = total === 0 || wordCount >= total;

  // Advance to the next step only once the current one has fully streamed.
  useEffect(() => {
    if (reduceMotion || complete || !streamedDone) {
      return;
    }
    const id = window.setTimeout(
      () => setCurrentIndex((index) => index + 1),
      total === 0 ? 250 : STEP_DWELL_MS,
    );
    return () => window.clearTimeout(id);
  }, [streamedDone, currentIndex, total, reduceMotion, complete]);

  // Keep the active step and its growing text in view as the flow advances.
  // The first step is left alone so the initial top-of-page view is preserved.
  useEffect(() => {
    if (reduceMotion || complete || currentIndex === 0) {
      return;
    }
    activeStepRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [currentIndex, wordCount, reduceMotion, complete]);

  const streamedText = words.slice(0, wordCount).join("");

  return (
    <div className="ioc-running-steps">
      {header}
      <ol
        className="ioc-timeline-list ioc-running-steps-list"
        aria-live="polite"
      >
        {sections.map((section, index) => {
          const revealed = reduceMotion ? true : index <= currentIndex;
          const active = !reduceMotion && index === currentIndex;
          const collapsed = !reduceMotion && index < currentIndex;
          const display = reduceMotion
            ? sectionToText(section)
            : active
              ? streamedText
              : "";
          const streaming = active && !streamedDone;
          return (
            <li
              key={section.title}
              ref={active ? activeStepRef : undefined}
              className={`ioc-timeline-item ioc-running-step ${revealed ? "is-revealed" : ""} ${active ? "is-active" : ""} ${collapsed ? "is-collapsed" : ""}`}
            >
              <div className="ioc-timeline-marker-col">
                <span
                  className={`ioc-timeline-marker ${active ? "is-active" : ""}`}
                  aria-hidden="true"
                >
                  {reasoningStepMark(section.title)}
                </span>
              </div>
              <div className="ioc-timeline-content">
                <p className="ioc-fg min-w-0 text-[14px] font-light">
                  {revealed ? section.title : "…"}
                </p>
                {revealed && display ? (
                  <p
                    className={`ioc-running-step-summary ioc-copy mt-1.5 whitespace-pre-line text-[12.5px] leading-[1.45] ${streaming ? "ioc-streaming" : ""}`}
                  >
                    {display}
                  </p>
                ) : !revealed ? (
                  <p className="ioc-running-step-placeholder" aria-hidden="true" />
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
      <StreamingEvidence
        items={evidence}
        enabled={complete}
        onDone={handleStreamComplete}
      />
    </div>
  );
}

function StreamingEvidence({
  items,
  enabled,
  onDone,
}: {
  items: PipelineEvidence[];
  enabled: boolean;
  onDone?: () => void;
}) {
  const visible = useSequentialReveal(items.length, enabled);
  const doneRef = useRef(false);

  // Signal completion once the whole animation (reasoning + evidence) settles.
  useEffect(() => {
    if (!enabled || doneRef.current) {
      return;
    }
    if (items.length === 0 || visible >= items.length) {
      doneRef.current = true;
      onDone?.();
    }
  }, [enabled, visible, items.length, onDone]);

  if (items.length === 0 || !enabled) {
    return null;
  }
  return (
    <div className="ioc-running-evidence mt-5">
      <p className="ioc-kicker">Evidence</p>
      <ul className="ioc-timeline-findings" aria-live="polite">
        {items.slice(0, visible).map((item) => {
          const { title, where } = parseEvidenceDisplay(item);
          const confidenceLabel = formatConfidencePercent(item.confidence);
          const detail =
            typeof item.relevance === "string" && item.relevance.trim()
              ? item.relevance.trim()
              : item.description?.trim();
          return (
            <li key={item.id}>
              <div className="ioc-timeline-finding ioc-stream-in">
                <div className="ioc-timeline-finding-row">
                  <span className="ioc-timeline-finding-title">
                    <span className="min-w-0 truncate">{title}</span>
                  </span>
                  {where ? (
                    <span className="ioc-timeline-finding-step">{where}</span>
                  ) : null}
                  {confidenceLabel ? (
                    <span className="ioc-confidence-tag">{confidenceLabel}</span>
                  ) : null}
                </div>
                {detail ? (
                  <p className="ioc-copy mt-1.5 text-[12.5px] leading-[1.45]">
                    {detail}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function InvestigationRunningSteps({
  traceFileId,
  showHeader = true,
  sections,
  evidence = [],
  onComplete,
}: {
  traceFileId: string;
  showHeader?: boolean;
  sections?: ModelReasoningSection[];
  evidence?: PipelineEvidence[];
  onComplete?: () => void;
}) {
  const { visibleCount, activeIndex } =
    useSimulatedReasoningProgress(traceFileId);
  const header = showHeader ? (
    <>
      <p className="ioc-kicker">Investigation</p>
      <p className="ioc-fg mt-3 text-[22px] font-light leading-snug tracking-tight">
        Investigating
      </p>
      <p className="ioc-faint mt-2 max-w-[18rem] text-[13px] leading-[1.55]">
        Agent-ToM is working through the reasoning chain.
      </p>
    </>
  ) : (
    <p className="ioc-kicker">Reasoning</p>
  );

  // Stream the actual investigation reasoning + evidence when available.
  if (sections && sections.length > 0) {
    return (
      <StreamingReasoning
        header={header}
        sections={sections}
        evidence={evidence}
        onComplete={onComplete}
        resumeIndex={Math.max(0, activeIndex)}
      />
    );
  }

  return (
    <div className="ioc-running-steps">
      {header}
      <ol className="ioc-timeline-list ioc-running-steps-list" aria-live="polite">
        {LINKED_REASONING_STEPS.map((step, index) => {
          const revealed = index < visibleCount;
          const active = index === activeIndex;
          return (
            <li
              key={step.title}
              className={`ioc-timeline-item ioc-running-step ${revealed ? "is-revealed" : ""} ${active ? "is-active" : ""}`}
            >
              <div className="ioc-timeline-marker-col">
                <span
                  className={`ioc-timeline-marker ${active ? "is-active" : ""}`}
                  aria-hidden="true"
                >
                  {step.mark}
                </span>
              </div>
              <div className="ioc-timeline-content">
                <p className="ioc-fg min-w-0 text-[14px] font-light">
                  {revealed ? step.title : "…"}
                </p>
                {revealed ? (
                  <p className="ioc-running-step-summary ioc-copy mt-1.5 text-[12.5px] leading-[1.45]">
                    {step.summary}
                  </p>
                ) : (
                  <p className="ioc-running-step-placeholder" aria-hidden="true" />
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
