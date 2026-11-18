import { SentenceProse, splitProseSentences } from "./SentenceProse";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { LuChevronRight, LuX } from "react-icons/lu";
import {
  evidenceElementId,
  parseEvidenceDisplay,
  type PipelineEvidence,
} from "../utils/evidencePipeline";
import { formatConfidencePercent } from "../utils/detectiveResult";
import {
  getModelReasoningView,
  splitReasoningWithEvidence,
  type ModelReasoningSection,
} from "../utils/modelReasoning";
import { getPlaybookEntry, splitPlaybookRefs } from "../utils/playbook";
import { parseObservationStepReferences } from "../utils/traceVisualizer";

interface InvestigationDetailEvidenceSectionProps {
  evidence: PipelineEvidence[];
  descriptionTitle?: string;
  verdictDescription: string;
  reasoningRaw?: string | null;
  isFailed?: boolean;
  isMalicious?: boolean;
  onFocusEvidence?: (id: string) => void;
  appId?: string;
}

function PlaybookRef({
  label,
  id,
  appId,
}: {
  label: string;
  id: string;
  appId?: string;
}) {
  const entry = getPlaybookEntry(appId, id);
  const tokenRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ left: number; top: number } | null>(
    null,
  );
  const [dragging, setDragging] = useState(false);
  // Where the pointer and the popup were when the drag began, so moves apply as
  // a delta and stay correct regardless of the centering transform in CSS.
  const dragOrigin = useRef<{
    pointerX: number;
    pointerY: number;
    left: number;
    top: number;
  } | null>(null);
  const isOpen = coords !== null;

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }
      // The token handles its own toggle, so a press on it must not also count
      // as a click-out or the popup would close and immediately reopen.
      if (popRef.current?.contains(target) || tokenRef.current?.contains(target)) {
        return;
      }
      setCoords(null);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setCoords(null);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!dragging) {
      return;
    }
    function onMove(event: PointerEvent) {
      const origin = dragOrigin.current;
      if (!origin) {
        return;
      }
      const margin = 12;
      setCoords({
        left: Math.max(
          margin,
          Math.min(
            origin.left + (event.clientX - origin.pointerX),
            window.innerWidth - margin,
          ),
        ),
        top: Math.max(
          margin,
          Math.min(
            origin.top + (event.clientY - origin.pointerY),
            window.innerHeight - margin * 2,
          ),
        ),
      });
    }
    function onUp() {
      dragOrigin.current = null;
      setDragging(false);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging]);

  if (!entry) {
    return <>{label}</>;
  }

  function toggle() {
    if (coords) {
      setCoords(null);
      return;
    }
    const el = tokenRef.current;
    if (!el) {
      return;
    }
    const rect = el.getBoundingClientRect();
    // Clamp horizontally so the (centered) popup stays within the viewport.
    const margin = 12;
    const half = Math.min(192, (window.innerWidth - margin * 2) / 2);
    const left = Math.max(
      margin + half,
      Math.min(rect.left + rect.width / 2, window.innerWidth - margin - half),
    );
    setCoords({ left, top: rect.bottom + 6 });
  }

  function startDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!coords || event.button !== 0) {
      return;
    }
    // Keeps the press from selecting text across the page while dragging.
    event.preventDefault();
    dragOrigin.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      left: coords.left,
      top: coords.top,
    };
    setDragging(true);
  }

  return (
    <span className="ioc-playbook-ref">
      <button
        type="button"
        ref={tokenRef}
        className="ioc-playbook-ref-token"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={toggle}
      >
        {label}
      </button>
      {coords
        ? createPortal(
            <div
              ref={popRef}
              role="dialog"
              aria-label={`Playbook rule ${label}`}
              className={`ioc-tooltip ioc-playbook-tip${
                dragging ? " is-dragging" : ""
              }`}
              style={{ left: coords.left, top: coords.top }}
            >
              {/* Only the bar drags, so the rule text below stays selectable. */}
              <div className="ioc-playbook-tip-head" onPointerDown={startDrag}>
                <span className="ioc-playbook-tip-id">{label}</span>
                <button
                  type="button"
                  className="ioc-playbook-tip-close"
                  aria-label="Close"
                  onClick={() => setCoords(null)}
                >
                  <LuX size={13} />
                </button>
              </div>
              {entry.text}
            </div>,
            document.body,
          )
        : null}
    </span>
  );
}

function PlaybookText({ text, appId }: { text: string; appId?: string }) {
  const parts = splitPlaybookRefs(text);
  return (
    <>
      {parts.map((part, index) =>
        part.type === "ref" ? (
          <PlaybookRef
            key={`ref-${index}`}
            label={part.text}
            id={part.id}
            appId={appId}
          />
        ) : (
          <span key={`t-${index}`}>{part.text}</span>
        ),
      )}
    </>
  );
}

function ReasoningLinkedText({
  text,
  evidence,
  onOpenEvidence,
  showEvidenceLinks = true,
  appId,
}: {
  text: string;
  evidence: PipelineEvidence[];
  onOpenEvidence: (id: string) => void;
  showEvidenceLinks?: boolean;
  appId?: string;
}) {
  const parts = showEvidenceLinks
    ? splitReasoningWithEvidence(text, evidence)
    : [{ type: "text" as const, text }];
  return (
    <>
      {parts.map((part, index) =>
        part.type === "link" && part.evidenceId ? (
          <a
            key={`${part.evidenceId}-${index}`}
            href={`#${evidenceElementId(part.evidenceId)}`}
            className="ioc-link cursor-pointer"
            onClick={(event) => {
              event.preventDefault();
              onOpenEvidence(part.evidenceId!);
            }}
          >
            {part.text}
          </a>
        ) : (
          <PlaybookText key={`text-${index}`} text={part.text} appId={appId} />
        ),
      )}
    </>
  );
}

function ObservationText({
  observation,
  availableStepIndexes,
  onRevealTraceStep,
}: {
  observation: string;
  availableStepIndexes: ReadonlySet<number>;
  onRevealTraceStep?: (stepIndex: number) => void;
}) {
  const references = parseObservationStepReferences(observation);
  if (references.length === 0) {
    return <>{observation}</>;
  }

  const parts: ReactNode[] = [];
  let cursor = 0;
  references.forEach((reference, index) => {
    if (reference.start > cursor) {
      parts.push(observation.slice(cursor, reference.start));
    }
    const label = observation.slice(reference.start, reference.end);
    // Observations use the same 0-based conversation index as the evidence step.
    const stepIndex = reference.step;
    if (availableStepIndexes.has(stepIndex)) {
      parts.push(
        <button
          key={`step-${reference.start}-${index}`}
          type="button"
          className="ioc-link cursor-pointer"
          title={`Show step ${reference.step} in the trace`}
          aria-label={`Show trace step ${reference.step}`}
          onClick={() => onRevealTraceStep?.(stepIndex)}
        >
          <mark className="ioc-chat-mark">{label}</mark>
        </button>,
      );
    } else {
      parts.push(
        <mark key={`step-${reference.start}-${index}`} className="ioc-chat-mark">
          {label}
        </mark>,
      );
    }
    cursor = reference.end;
  });
  parts.push(observation.slice(cursor));
  return <>{parts}</>;
}

export function EvidenceDetails({
  item,
  where,
  onRevealTrace,
  onRevealTraceStep,
  availableStepIndexes,
}: {
  item: PipelineEvidence;
  where?: string | null;
  onRevealTrace?: (id: string) => void;
  onRevealTraceStep?: (stepIndex: number) => void;
  availableStepIndexes: ReadonlySet<number>;
}) {
  const anomalies = (item.anomalies ?? []).filter((entry) => entry.trim());
  const excerptText = item.excerpt?.trim();
  const relevanceText = String(item.relevance ?? item.description ?? "").trim();
  const confidenceLabel = formatConfidencePercent(item.confidence);

  return (
    <div className="ioc-evidence-details space-y-3">
      {relevanceText ? (
        <div>
          <p className="ioc-fg text-[13px] font-light">Relevance</p>
          <p className="ioc-copy mt-1 text-[12.5px] leading-[1.45]">
            {relevanceText}
          </p>
        </div>
      ) : null}
      <div>
        <p className="ioc-fg text-[13px] font-light">Observations</p>
        {anomalies.length === 0 ? (
          <p className="ioc-copy mt-1 text-[12.5px] leading-[1.45]">None</p>
        ) : anomalies.length === 1 ? (
          <p className="ioc-copy mt-1 text-[12.5px] leading-[1.45]">
            <ObservationText
              observation={anomalies[0]}
              availableStepIndexes={availableStepIndexes}
              onRevealTraceStep={onRevealTraceStep}
            />
          </p>
        ) : (
          <ul className="ioc-copy mt-1 list-disc space-y-1 pl-5 text-[12.5px] leading-[1.45]">
            {anomalies.map((anomaly, anomalyIndex) => (
              <li key={`${item.id}-anomaly-${anomalyIndex}`}>
                <ObservationText
                  observation={anomaly}
                  availableStepIndexes={availableStepIndexes}
                  onRevealTraceStep={onRevealTraceStep}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
      {where ? (
        <div>
          <p className="ioc-fg text-[13px] font-light">Where</p>
          <button
            type="button"
            title="Scroll to this step in the trace"
            className="ioc-link mt-1 cursor-pointer text-left text-[12.5px] leading-[1.45]"
            onClick={() => onRevealTrace?.(item.id)}
          >
            {where}
          </button>
        </div>
      ) : null}
      {confidenceLabel ? (
        <div
          className="flex items-center gap-2"
          title="Model confidence for this finding"
        >
          <p className="ioc-fg text-[13px] font-light">Confidence</p>
          <span className="ioc-confidence-tag">{confidenceLabel}</span>
        </div>
      ) : null}
      {excerptText ? (
        <div>
          <p className="ioc-fg text-[13px] font-light">Excerpt</p>
          <p className="ioc-copy mt-1 whitespace-pre-wrap font-mono text-[12px] leading-[1.45]">
            {excerptText}
          </p>
        </div>
      ) : null}
    </div>
  );
}

// Reasoning copy often opens with a short "Supporting MALICIOUS: ..." style lead.
// Only treat it as a title when it is short enough to read as a label rather than
// a clause that happens to end in a colon.
const REASONING_LEAD_RE = /^([A-Z(][^:.!?\n]{1,47}):\s+(?=\S)/;

function splitReasoningLead(text: string): { lead: string | null; body: string } {
  const match = text.match(REASONING_LEAD_RE);
  if (!match || match[1].trim().split(/\s+/).length > 6) {
    return { lead: null, body: text };
  }
  return { lead: match[1], body: text.slice(match[0].length) };
}

export function ReasoningBlocks({
  section,
  evidence,
  onOpenEvidence,
  showEvidenceLinks = true,
  showTitle = true,
  emphasizeLeads = false,
  className,
  appId,
}: {
  section: ModelReasoningSection;
  evidence: PipelineEvidence[];
  onOpenEvidence: (id: string) => void;
  showEvidenceLinks?: boolean;
  showTitle?: boolean;
  emphasizeLeads?: boolean;
  className?: string;
  appId?: string;
}) {
  function renderText(text: string) {
    const { lead, body } = emphasizeLeads
      ? splitReasoningLead(text)
      : { lead: null, body: text };
    return (
      <>
        {lead ? <span className="ioc-fg font-normal">{lead}: </span> : null}
        <ReasoningLinkedText
          text={body}
          evidence={evidence}
          onOpenEvidence={onOpenEvidence}
          showEvidenceLinks={showEvidenceLinks}
          appId={appId}
        />
      </>
    );
  }

  return (
    <div className={className ?? "space-y-2"}>
      {showTitle ? (
        <p className="ioc-fg text-[13px] font-light leading-[1.35]">
          {section.title}
        </p>
      ) : null}
      {section.blocks.map((block, index) =>
        block.type === "ul" ? (
          <ul
            key={`${section.title}-ul-${index}`}
            className="ioc-copy list-disc space-y-1.5 pl-5 text-[12.5px] leading-[1.45]"
          >
            {block.items.map((item) => (
              <li key={item}>{renderText(item)}</li>
            ))}
          </ul>
        ) : (
          <div
            key={`${section.title}-p-${index}`}
            className="ioc-copy text-[12.5px] leading-[1.45]"
          >
            {splitProseSentences(block.text).map((sentence, sentenceIndex) => (
              <p
                key={`${section.title}-p-${index}-${sentenceIndex}`}
                className={sentenceIndex === 0 ? undefined : "mt-3"}
              >
                {renderText(sentence)}
              </p>
            ))}
          </div>
        ),
      )}
    </div>
  );
}

export function InvestigationDetailEvidenceSection({
  evidence,
  descriptionTitle = "Description",
  verdictDescription,
  reasoningRaw,
  isFailed = false,
  isMalicious = false,
  onFocusEvidence,
  appId,
}: InvestigationDetailEvidenceSectionProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const [anomaliesOpen, setAnomaliesOpen] = useState(false);
  const firstEvidenceId = evidence[0]?.id ?? null;
  const reasoningView = useMemo(
    () => getModelReasoningView(reasoningRaw),
    [reasoningRaw],
  );

  useEffect(() => {
    setOpenId(null);
    setReasoningOpen(false);
  }, [firstEvidenceId]);

  useEffect(() => {
    setAnomaliesOpen(false);
  }, [openId]);

  useEffect(() => {
    if (!openId) {
      return;
    }
    onFocusEvidence?.(openId);
  }, [openId, onFocusEvidence]);

  const matchedCount = evidence.length;
  const citeTone = isFailed ? "warning" : isMalicious ? "danger" : "success";
  const verdictBorder = isFailed
    ? "sev-border-warning"
    : isMalicious
      ? "sev-border-danger"
      : "sev-border-success";

  function toggleEvidence(id: string) {
    setOpenId((current) => (current === id ? null : id));
  }

  function openEvidenceFromReasoning(id: string) {
    setOpenId(id);
    onFocusEvidence?.(id);
    window.setTimeout(() => {
      document.getElementById(evidenceElementId(id))?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }, 0);
  }

  return (
    <section className="ioc-hairline ioc-scroll space-y-3 border-b p-4 lg:col-span-5 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:border-b-0 lg:border-r">
      <div>
        <h2 className="ioc-kicker">{descriptionTitle}</h2>
        <SentenceProse
          text={verdictDescription}
          className="ioc-copy mt-2 text-[14px] leading-[1.5]"
        />
      </div>

      {reasoningView ? (
        <article className="ioc-glass overflow-hidden rounded-lg">
          <button
            type="button"
            onClick={() => setReasoningOpen((open) => !open)}
            aria-expanded={reasoningOpen}
            className="ioc-accordion-toggle group w-full cursor-pointer px-3 py-2.5 text-left"
          >
            <span className="ioc-fg inline-flex min-w-0 items-center gap-2 text-[13px] font-light leading-[1.35]">
              <LuChevronRight
                size={14}
                className={`shrink-0 transition-transform ${reasoningOpen ? "rotate-90" : ""}`}
              />
              <span>Model reasoning</span>
            </span>
          </button>
          {reasoningOpen ? (
            <div className="ioc-evidence-hairline space-y-4 border-t px-3 py-3">
              {reasoningView.map((section) => (
                <ReasoningBlocks
                  key={section.title}
                  section={section}
                  evidence={evidence}
                  onOpenEvidence={openEvidenceFromReasoning}
                  appId={appId}
                />
              ))}
            </div>
          ) : null}
        </article>
      ) : null}

      <div className="flex items-end justify-between">
        <h2 className="ioc-kicker">Evidence</h2>
        <span className="ioc-faint text-[12px]">{matchedCount}</span>
      </div>

      {matchedCount === 0 ? (
        <article className={`ioc-glass rounded-lg px-4 py-4 ${verdictBorder}`}>
          <p className="ioc-copy text-[13px] leading-[1.45]">
            No evidence entries were returned by the API for this investigation.
          </p>
        </article>
      ) : (
        <div className="ioc-cite-panel space-y-2" data-cite-tone={citeTone}>
          {evidence.map((item) => {
            const { title, where } = parseEvidenceDisplay(item);
            const description =
              item.description?.trim() ||
              `${item.type} pattern detected in this trace.`;
            const excerptText = item.excerpt;
            const isOpen = openId === item.id;

            return (
              <article
                key={item.id}
                id={evidenceElementId(item.id)}
                data-benign={item.benign}
                className={`ioc-glass ioc-evidence-cite scroll-mt-2 overflow-hidden rounded-lg ${isOpen ? "is-active" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => toggleEvidence(item.id)}
                  className="ioc-accordion-toggle group w-full cursor-pointer px-3 py-2.5 text-left"
                >
                  <span className="flex w-full min-w-0 items-center justify-between gap-3">
                    <span className="ioc-fg inline-flex min-w-0 items-center gap-2 text-[13px] font-light leading-[1.35]">
                      <LuChevronRight
                        size={14}
                        className={`shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`}
                      />
                      <span className="min-w-0 truncate">{title}</span>
                    </span>
                  </span>
                </button>

                {isOpen ? (
                  <div className="ioc-evidence-hairline space-y-3 border-t px-3 py-3">
                    <p className="ioc-copy text-[12.5px] leading-[1.45]">
                      {description}
                    </p>
                    {where ? (
                      <p
                        className="ioc-faint text-[12px] leading-[1.45]"
                        title="0-based conversation-message indexes in the trace"
                      >
                        Where · {where}
                      </p>
                    ) : null}

                    {item.anomalies && item.anomalies.length > 0 ? (
                      <div>
                        <button
                          type="button"
                          onClick={() => setAnomaliesOpen((open) => !open)}
                          aria-expanded={anomaliesOpen}
                          className="ioc-accordion-toggle group flex w-full cursor-pointer items-center gap-2 text-left"
                        >
                          <LuChevronRight
                            size={14}
                            className={`shrink-0 transition-transform ${anomaliesOpen ? "rotate-90" : ""}`}
                          />
                          <span className="ioc-fg text-[13px] font-light">
                            Observations ({item.anomalies.length})
                          </span>
                        </button>
                        {anomaliesOpen ? (
                          <ul className="ioc-copy mt-2 list-disc space-y-1.5 pl-6 text-[12.5px] leading-[1.45]">
                            {item.anomalies.map((anomaly, index) => (
                              <li key={`${item.id}-anomaly-${index}`}>
                                {anomaly}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ) : null}

                    {excerptText ? (
                      <div>
                        <p className="ioc-fg text-[13px] font-light">Excerpt</p>
                        <p className="ioc-copy mt-1 whitespace-pre-wrap font-mono text-[12px] leading-[1.45]">
                          {excerptText}
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
