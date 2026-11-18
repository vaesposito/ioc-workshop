import { useEffect, useMemo, useState } from "react";
import { ComponentBubbleGraph } from "./ComponentBubbleGraph";
import { ExpandMark } from "./ExpandCue";
import {
  TraceChatPanel,
  evidenceCiteTones,
  type CiteTone,
} from "./TraceChatPanel";
import { OpenTraceJsonLink } from "./OpenTraceJsonLink";
import { InvestigationRunningSteps } from "./InvestigationRunningSteps";
import type { TraceContent } from "../utils/api";
import {
  evidenceElementId,
  parseEvidenceDisplay,
  type PipelineEvidence,
} from "../utils/evidencePipeline";
import { formatConfidencePercent } from "../utils/detectiveResult";
import {
  getLinkedReasoningView,
  reasoningStepMark,
  reasoningStepSummary,
  type ModelReasoningSection,
} from "../utils/modelReasoning";
import { buildTraceComponentGraph } from "../utils/componentGraph";
import type { VisualizerEvent } from "../utils/traceVisualizer";
import {
  EvidenceDetails,
  ReasoningBlocks,
} from "./InvestigationDetailEvidenceSection";

interface InvestigationDetailLinkedSectionProps {
  evidence: PipelineEvidence[];
  verdictDescription: string;
  reasoningSteps?: string[] | null;
  reasoningRaw?: string | null;
  events: VisualizerEvent[];
  isLoading?: boolean;
  error?: string | null;
  focusedEvidenceId?: string | null;
  traceRevealId?: string | null;
  traceRevealEventId?: string | null;
  focusNonce?: number;
  onFocusEvidence?: (id: string | null) => void;
  onRevealTrace?: (id: string) => void;
  onRevealTraceStep?: (stepIndex: number) => void;
  citeTone?: CiteTone;
  showCited?: boolean;
  runningTraceFileId?: string | null;
  revealOnComplete?: boolean;
  appId?: string;
  traceContent?: TraceContent | null;
  traceName?: string | null;
}

export function assignReasoningEvidence(
  sections: ModelReasoningSection[],
  evidence: PipelineEvidence[],
): Array<{ section: ModelReasoningSection; items: PipelineEvidence[] }> {
  const assigned = sections.map((section) => ({
    section,
    items:
      section.title === "Evidence Collection" || section.title === "Evidence"
        ? [...evidence]
        : [],
  }));
  if (
    assigned.some(
      (row) =>
        row.section.title === "Evidence Collection" ||
        row.section.title === "Evidence",
    )
  ) {
    return assigned;
  }
  assigned.push({
    section: {
      title: "Evidence Collection",
      blocks: [
        {
          type: "p",
          text: "Cited steps from the report that support the verdict.",
        },
      ],
    },
    items: [...evidence],
  });
  return assigned;
}

export function EvidenceFindingsList({
  items,
  focusedEvidenceId,
  onToggleEvidence,
  onRevealTrace,
  onRevealTraceStep,
  availableStepIndexes = new Set<number>(),
}: {
  items: PipelineEvidence[];
  focusedEvidenceId?: string | null;
  onToggleEvidence: (id: string) => void;
  onRevealTrace?: (id: string) => void;
  onRevealTraceStep?: (stepIndex: number) => void;
  availableStepIndexes?: ReadonlySet<number>;
}) {
  return (
    <ul className="ioc-timeline-findings">
      {items.map((item) => {
        const { title, where } = parseEvidenceDisplay(item);
        const on = focusedEvidenceId === item.id;
        const confidenceLabel = formatConfidencePercent(item.confidence);
        return (
          <li key={item.id}>
            <div
              id={evidenceElementId(item.id)}
              data-benign={item.benign}
              className={`ioc-timeline-finding ${on ? "is-active" : ""}`}
            >
              <div className="ioc-timeline-finding-row">
                <button
                  type="button"
                  aria-expanded={on}
                  aria-pressed={on}
                  className="ioc-timeline-finding-title"
                  onClick={() => onToggleEvidence(item.id)}
                >
                  <ExpandMark open={on} />
                  <span className="min-w-0 truncate">{title}</span>
                </button>
                {where ? (
                  <button
                    type="button"
                    title="Scroll to this step in the trace"
                    className="ioc-link ioc-timeline-finding-step"
                    onClick={() => onRevealTrace?.(item.id)}
                  >
                    {where}
                  </button>
                ) : null}
                {!on && confidenceLabel ? (
                  <span
                    className="ioc-confidence-tag"
                    title="Model confidence for this finding"
                  >
                    {confidenceLabel}
                  </span>
                ) : null}
              </div>
              {on ? (
                <div className="ioc-timeline-finding-body">
                  <EvidenceDetails
                    item={item}
                    where={where}
                    onRevealTrace={onRevealTrace}
                    onRevealTraceStep={onRevealTraceStep}
                    availableStepIndexes={availableStepIndexes}
                  />
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function ReasoningTimelineList({
  rows,
  evidence,
  openReason,
  focusedEvidenceId,
  onToggleReason,
  onSelectEvidence,
  onToggleEvidence,
  onRevealTrace,
  appId,
}: {
  rows: Array<{ section: ModelReasoningSection; items: PipelineEvidence[] }>;
  evidence: PipelineEvidence[];
  openReason: string | null;
  focusedEvidenceId?: string | null;
  onToggleReason: (title: string) => void;
  onSelectEvidence: (id: string) => void;
  onToggleEvidence: (id: string) => void;
  onRevealTrace?: (id: string) => void;
  appId?: string;
}) {
  return (
    <ol className="ioc-timeline-list">
      {rows.map((row) => {
        const open = openReason === row.section.title;
        const rowLit = row.items.some((item) => item.id === focusedEvidenceId);
        const mark = reasoningStepMark(row.section.title);
        return (
          <li
            key={row.section.title}
            className={`ioc-timeline-item ${rowLit ? "is-lit" : ""} ${open ? "is-open" : ""}`}
          >
            <div className="ioc-timeline-marker-col">
              <button
                type="button"
                title={row.section.title}
                aria-pressed={open}
                className={`ioc-timeline-marker ${open ? "is-active" : ""}`}
                onClick={() => onToggleReason(row.section.title)}
              >
                {mark}
              </button>
            </div>
            <div className="ioc-timeline-content">
              <button
                type="button"
                className="ioc-timeline-title"
                aria-expanded={open}
                onClick={() => onToggleReason(row.section.title)}
              >
                <span className="ioc-timeline-title-cluster">
                  <span className="ioc-fg min-w-0 truncate text-[14px] font-light">
                    {row.section.title}
                  </span>
                  <ExpandMark open={open} />
                </span>
              </button>

              {open ? (
                <div className="ioc-timeline-body">
                  {reasoningStepSummary(row.section.title) ? (
                    <p className="ioc-copy mb-3 text-[12.5px] leading-[1.45]">
                      {reasoningStepSummary(row.section.title)}
                    </p>
                  ) : null}
                  <ReasoningBlocks
                    section={row.section}
                    evidence={evidence}
                    onOpenEvidence={onSelectEvidence}
                    showEvidenceLinks={false}
                    showTitle={false}
                    appId={appId}
                  />
                </div>
              ) : null}
            </div>

            {row.items.length > 0 ? (
              <EvidenceFindingsList
                items={row.items}
                focusedEvidenceId={focusedEvidenceId}
                onToggleEvidence={onToggleEvidence}
                onRevealTrace={onRevealTrace}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

export function InvestigationDetailLinkedSection({
  evidence,
  verdictDescription,
  reasoningSteps,
  reasoningRaw,
  events,
  isLoading = false,
  error = null,
  focusedEvidenceId = null,
  traceRevealId = null,
  traceRevealEventId = null,
  focusNonce = 0,
  onFocusEvidence,
  onRevealTrace,
  onRevealTraceStep,
  citeTone = "danger",
  showCited = true,
  runningTraceFileId = null,
  revealOnComplete = false,
  appId,
  traceContent = null,
  traceName = null,
}: InvestigationDetailLinkedSectionProps) {
  const [openReason, setOpenReason] = useState<string | null>(null);
  const [reasoningOpen, setReasoningOpen] = useState(true);
  const [evidenceOpen, setEvidenceOpen] = useState(true);
  const [componentsExpandSignal, setComponentsExpandSignal] = useState(0);

  // After the verdict + metadata have animated in, expand the components panel
  // to round out the sense of completion.
  useEffect(() => {
    if (!revealOnComplete || runningTraceFileId) {
      return;
    }
    const id = window.setTimeout(() => setComponentsExpandSignal((n) => n + 1), 1400);
    return () => window.clearTimeout(id);
  }, [revealOnComplete, runningTraceFileId]);

  const reasoningView = useMemo(
    () => getLinkedReasoningView(reasoningSteps, reasoningRaw),
    [reasoningRaw, reasoningSteps],
  );

  useEffect(() => {
    setOpenReason(null);
  }, [reasoningRaw, reasoningSteps, evidence[0]?.id, evidence.length]);

  // The findings render under their own heading, so the timeline carries the
  // reasoning steps only.
  const rows = useMemo(
    () => assignReasoningEvidence(reasoningView ?? [], []),
    [reasoningView],
  );

  const componentGraph = useMemo(
    () => buildTraceComponentGraph(events, [], "vertical", { app: { id: appId ?? "" } }),
    [events, appId],
  );

  const evidenceTones = useMemo(() => evidenceCiteTones(evidence), [evidence]);
  const availableStepIndexes = useMemo(
    () => new Set(events.map((event) => event.sourceIndex)),
    [events],
  );

  function toggleReason(title: string) {
    setOpenReason((current) => (current === title ? null : title));
  }

  function selectEvidence(id: string) {
    onFocusEvidence?.(id);
  }

  function toggleEvidence(id: string) {
    onFocusEvidence?.(focusedEvidenceId === id ? null : id);
  }

  function revealStep(id: string) {
    onRevealTrace?.(id);
  }

  return (
    <section className="ioc-hairline flex min-w-0 flex-col border-b p-4 lg:col-span-9 lg:min-h-full lg:border-b-0">
      <div
        className="ioc-timeline ioc-cite-panel min-h-0 flex-1"
        data-cite-tone={citeTone}
      >
        <div className="ioc-timeline-main ioc-scroll">
          {runningTraceFileId ? (
            <InvestigationRunningSteps
              traceFileId={runningTraceFileId}
              showHeader={false}
              sections={reasoningView ?? undefined}
              evidence={evidence}
            />
          ) : (
            <>
              <button
                type="button"
                className="ioc-collapse-head"
                aria-expanded={reasoningOpen}
                onClick={() => setReasoningOpen((open) => !open)}
              >
                <span className="ioc-kicker">Reasoning</span>
                <ExpandMark open={reasoningOpen} />
              </button>

              {rows.length === 0 ? (
                <p className="ioc-copy mt-4 text-[13px] leading-[1.45]">
                  {verdictDescription || "No reasoning steps to show."}
                </p>
              ) : reasoningOpen ? (
                <ReasoningTimelineList
                  rows={rows}
                  evidence={evidence}
                  openReason={openReason}
                  focusedEvidenceId={focusedEvidenceId}
                  onToggleReason={toggleReason}
                  onSelectEvidence={selectEvidence}
                  onToggleEvidence={toggleEvidence}
                  onRevealTrace={revealStep}
                  appId={appId}
                />
              ) : null}

              {evidence.length > 0 ? (
                <div className={reasoningOpen ? "mt-2" : "mt-5"}>
                  <button
                    type="button"
                    className="ioc-collapse-head"
                    aria-expanded={evidenceOpen}
                    onClick={() => setEvidenceOpen((open) => !open)}
                  >
                    <span className="ioc-kicker">Evidence</span>
                    <ExpandMark open={evidenceOpen} />
                  </button>
                  {evidenceOpen ? (
                    <EvidenceFindingsList
                      items={evidence}
                      focusedEvidenceId={focusedEvidenceId}
                      onToggleEvidence={toggleEvidence}
                      onRevealTrace={revealStep}
                      onRevealTraceStep={onRevealTraceStep}
                      availableStepIndexes={availableStepIndexes}
                    />
                  ) : null}
                </div>
              ) : null}

              {componentGraph.nodes.length > 0 ? (
                // An expanded section above already ends with its own trailing
                // space; a collapsed one leaves the two headings touching.
                <div
                  className={
                    (evidence.length > 0 ? evidenceOpen : reasoningOpen)
                      ? "mt-2"
                      : "mt-5"
                  }
                >
                  <ComponentBubbleGraph
                    graph={componentGraph}
                    framed={false}
                    showNodeCount={false}
                    collapsible
                    expandSignal={componentsExpandSignal}
                    caption="Components in this trace."
                  />
                </div>
              ) : null}
            </>
          )}
        </div>

        <aside className="ioc-timeline-trace">
          <div className="flex shrink-0 items-center justify-between gap-3">
            <p className="ioc-kicker">Trace</p>
            <OpenTraceJsonLink content={traceContent} traceName={traceName} />
          </div>
          <div className="ioc-chat-scroll mt-3 min-h-0 flex-1">
            <TraceChatPanel
              events={events}
              focusEvidenceId={traceRevealId}
              focusEventId={traceRevealEventId}
              focusNonce={focusNonce}
              isLoading={isLoading}
              error={error}
              showToolbar={false}
              showCited={showCited}
              citeTone={citeTone}
              evidenceTones={evidenceTones}
            />
          </div>
        </aside>
      </div>
    </section>
  );
}
