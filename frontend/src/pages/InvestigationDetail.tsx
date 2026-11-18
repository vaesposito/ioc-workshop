import { useCallback, useEffect, useMemo, useState } from "react";
import { LuArrowLeft, LuPlay, LuShieldOff } from "react-icons/lu";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { ExplainerModal } from "../components/ExplainerModal";
import { InvestigationDetailLeftSection } from "../components/InvestigationDetailLeftSection";
import { InvestigationDetailLinkedSection } from "../components/InvestigationDetailLinkedSection";
import { InvestigationDebateView } from "../components/InvestigationDebateView";
import { InvestigationResultSlideshow } from "../components/InvestigationResultSlideshow";
import { Layout } from "../components/Layout";
import { useApplications } from "../hooks/useApplications";
import { useInvestigations } from "../hooks/useInvestigations";
import { useSimulatedRunRecord } from "../hooks/useSimulatedReasoningProgress";
import { useTraceManager } from "../hooks/useTraceManager";
import { useTraceContentQuery } from "../query/hooks/useTraceContentQuery";
import { sanitizeInvestigationError, toUserMessage } from "../utils/api";
import { formatTraceDisplayName } from "../utils/portfolio";
import { getDisplayTechnique, getTechniqueLabel } from "../utils/techniques";
import { getTraceNarrative } from "../utils/traceNarratives";
import { buildEvidencePipeline } from "../utils/evidencePipeline";
import {
  DebateAnswersBlock,
  DebateQuestionBlock,
} from "../components/DebateExplanation";
import { debateForTrace } from "../utils/madDebates";
import { getLinkedReasoningView } from "../utils/modelReasoning";
import { conversationToEvents } from "../utils/traceVisualizer";

export function InvestigationDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { applications } = useApplications();
  const [focusEvidenceId, setFocusEvidenceId] = useState<string | null>(null);
  const [traceRevealId, setTraceRevealId] = useState<string | null>(null);
  const [traceRevealEventId, setTraceRevealEventId] = useState<string | null>(
    null,
  );
  const [focusNonce, setFocusNonce] = useState(0);
  const [explainerOpen, setExplainerOpen] = useState(false);
  // Which slide the deck should open on, for a reader who came from a
  // particular part of the report.
  const [explainerStart, setExplainerStart] = useState<{
    label: string;
    nonce: number;
  } | null>(null);

  const { investigations, loading } = useInvestigations(undefined, {
    enableStream: false,
  });
  const { traces } = useTraceManager();
  const investigation = investigations.find((inv) => inv.id === id);
  const application = applications.find(
    (app) => app.id === investigation?.applicationId,
  );
  const trace = traces.find(
    (row) => row.traceFileId === investigation?.traceFileId,
  );
  const contentQuery = useTraceContentQuery(investigation?.traceFileId);
  const simulatedRun = useSimulatedRunRecord(investigation?.traceFileId);
  const conversation = useMemo(() => {
    if (contentQuery.data?.conversation?.length) {
      return contentQuery.data.conversation;
    }
    return investigation?.memory?.raw_conversation_payload ?? [];
  }, [contentQuery.data, investigation]);
  const narrative = useMemo(
    () =>
      getTraceNarrative({
        filenames: [
          trace?.traceName,
          contentQuery.data?.originalFilename,
          investigation?.traceFileId,
          investigation?.trace_id,
          investigation?.name,
        ],
        appId: application?.id ?? investigation?.applicationId,
        appName: application?.name,
      }),
    [
      application?.id,
      application?.name,
      contentQuery.data?.originalFilename,
      investigation?.applicationId,
      investigation?.name,
      investigation?.traceFileId,
      investigation?.trace_id,
      trace?.traceName,
    ],
  );
  const pipeline = useMemo(
    () =>
      buildEvidencePipeline({
        evidence: investigation?.results ?? [],
      }),
    [investigation?.results],
  );
  const events = useMemo(
    () => conversationToEvents(conversation, pipeline),
    [conversation, pipeline],
  );
  // The report reads the debate behind the run: the verdict picks the
  // scenario and the trace id picks the question, the same pairing the trace
  // page used before the run.
  const debate = useMemo(
    () => debateForTrace(investigation?.traceFileId, trace?.latestLabel),
    [investigation?.traceFileId, trace?.latestLabel],
  );
  const contentError = contentQuery.error
    ? toUserMessage(contentQuery.error, "traces.content")
    : null;
  const applicationPath = investigation?.applicationId
    ? `/applications/${investigation.applicationId}`
    : null;
  const focusEvidence = useCallback((id: string | null) => {
    setFocusEvidenceId(id);
  }, []);

  const revealTraceForEvidence = useCallback((id: string) => {
    setTraceRevealEventId(null);
    setFocusEvidenceId(id);
    setTraceRevealId(id);
    setFocusNonce((value) => value + 1);
  }, []);

  const revealTraceForStep = useCallback(
    (sourceIndex: number) => {
      const event = events.find((row) => row.sourceIndex === sourceIndex);
      if (!event) {
        return;
      }
      setTraceRevealId(null);
      setTraceRevealEventId(event.id);
      setFocusNonce((value) => value + 1);
    },
    [events],
  );

  useEffect(() => {
    const evidence = searchParams.get("evidence");
    if (!evidence) {
      return;
    }
    setFocusEvidenceId(evidence);
    setTraceRevealId(evidence);
    setTraceRevealEventId(null);
    setFocusNonce((value) => value + 1);
  }, [id, searchParams]);

  // Start at the top; navigation (e.g. from the running view) keeps the prior
  // scroll position, which otherwise lands this report at the bottom.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [id]);

  const isFailed = investigation?.status === "failed";
  const isMalicious = investigation?.verdict === "malicious";
  const isRunning = simulatedRun
    ? simulatedRun.status === "pending" || simulatedRun.status === "started"
    : investigation?.status === "pending" ||
      investigation?.status === "started";

  // True when we arrived here straight from a run that just finished, so the
  // report plays a completion reveal (verdict + metadata, then components).
  const [revealComplete] = useState(() =>
    Boolean(
      (location.state as { justCompleted?: boolean } | null)?.justCompleted,
    ),
  );

  if (!loading && !investigation) {
    return (
      <Layout pageTitle="Investigation">
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-16">
          <LuShieldOff size={36} className="ioc-faint" />
          <p className="ioc-copy text-sm">Investigation not found</p>
          <button
            onClick={() => navigate("/investigations")}
            className="ioc-link mt-2 inline-flex items-center gap-1.5 text-sm"
          >
            <LuArrowLeft size={14} />
            Back to Investigations
          </button>
        </div>
      </Layout>
    );
  }

  if (!investigation) {
    return (
      <Layout pageTitle="Investigation">
        <p className="ioc-faint py-10 text-center text-sm font-light">
          Loading report...
        </p>
      </Layout>
    );
  }

  const evidence = pipeline;
  const selectedTechniqueLabel = getTechniqueLabel(
    getDisplayTechnique(
      investigation.technique,
      investigation.effectiveTechnique,
    ),
  );
  const verdictDescription = (() => {
    if (isFailed) {
      return sanitizeInvestigationError(investigation.error);
    }
    if (investigation.description && investigation.description.length > 0) {
      return investigation.description;
    }
    if (narrative?.modelPrediction) {
      return narrative.modelPrediction;
    }
    const explanation =
      investigation.memory?.annotation.misbehaviour_explanation;
    if (explanation && explanation.length > 0) return explanation.join(" ");
    if (isMalicious) {
      const severities = [
        ...new Set(investigation.results.map((r) => r.severity)),
      ]
        .filter((s) => s === "critical" || s === "high")
        .join(" and ");
      if (severities.length > 0) {
        return `This investigation identified ${investigation.results.length} finding${investigation.results.length !== 1 ? "s" : ""} including ${severities}-severity issues that indicate potentially malicious behaviour.`;
      }
      return "This investigation was classified as malicious by the technique output.";
    }
    return "No critical or high-severity issues were detected during this investigation. The application behaved within expected boundaries.";
  })();
  const verdictLabel = isFailed
    ? "Failed"
    : isMalicious
      ? "Malicious"
      : "Benign";
  const verdictTone: "danger" | "success" | "warning" = isFailed
    ? "warning"
    : isMalicious
      ? "danger"
      : "success";
  // A finished report is the debate; the linked trace below is what a run
  // that is still going or has failed has to show instead.
  const debateView = !(isRunning || isFailed);
  const reasoningSections = getLinkedReasoningView(
    narrative?.reasoningSteps,
    investigation.modelReasoning,
  );

  // The CTA rides in the page bar rather than under the metadata: it is about
  // the whole report, not about the column it used to sit in.
  const explainAction =
    isRunning || isFailed ? undefined : (
      <button
        type="button"
        className="ioc-cta ioc-cta-compact"
        aria-haspopup="dialog"
        aria-expanded={explainerOpen}
        onClick={() => {
          setExplainerStart(null);
          setExplainerOpen(true);
        }}
      >
        Explain this to me
        <LuPlay size={15} />
      </button>
    );

  return (
    <Layout
      pageActions={explainAction}
      breadcrumbs={[
        { label: "Applications", to: "/applications" },
        {
          label: application?.name ?? "Application",
          to: investigation.applicationId
            ? `/applications/${investigation.applicationId}`
            : "/applications",
        },
        {
          label: formatTraceDisplayName(trace?.traceName ?? investigation.name),
        },
      ]}
    >
      {/* The debate holds its rail against the top and scrolls each column
          under it, so from lg up the page is fixed to the viewport. The
          reasoning view keeps the page scroll it was built around. */}
      <div
        className={`flex min-h-[calc(100dvh-8.5rem)] flex-col${
          debateView ? " lg:h-[calc(100dvh-8.5rem)] lg:min-h-0" : ""
        }`}
      >
        <div
          className={
            debateView
              ? "grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-12 lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden"
              : "ioc-investigation-reasoning grid min-h-[calc(100dvh-8.5rem)] grid-cols-1 lg:grid-cols-12"
          }
        >
          <InvestigationDetailLeftSection
            isFailed={isFailed}
            isMalicious={isMalicious}
            applicationName={application?.name}
            applicationHref={applicationPath}
            traceName={formatTraceDisplayName(
              trace?.traceName ?? contentQuery.data?.originalFilename,
            )}
            techniqueLabel={selectedTechniqueLabel}
            status={isRunning ? "started" : investigation.status}
            model={isRunning ? undefined : investigation.model}
            durationSeconds={
              isRunning ? undefined : investigation.durationSeconds
            }
            startedAt={investigation.startedAt}
            completedAt={isRunning ? undefined : investigation.completedAt}
            userTask={narrative?.userTask}
            revealOnComplete={revealComplete}
            brief={
              debateView ? (
                <div className="ioc-debate-stack">
                  <DebateQuestionBlock
                    task={debate.task}
                    scenario={debate.scenario}
                    defaultOpen={false}
                  />
                  <DebateAnswersBlock
                    task={debate.task}
                    scenario={debate.scenario}
                  />
                </div>
              ) : null
            }
          />

          {!debateView ? (
            <InvestigationDetailLinkedSection
              evidence={evidence}
              verdictDescription={verdictDescription}
              reasoningRaw={investigation.modelReasoning}
              reasoningSteps={narrative?.reasoningSteps}
              events={events}
              isLoading={contentQuery.isLoading}
              error={contentError}
              onFocusEvidence={focusEvidence}
              onRevealTrace={revealTraceForEvidence}
              onRevealTraceStep={revealTraceForStep}
              focusedEvidenceId={focusEvidenceId}
              traceRevealId={traceRevealId}
              traceRevealEventId={traceRevealEventId}
              focusNonce={focusNonce}
              citeTone={verdictTone}
              runningTraceFileId={
                isRunning ? (investigation.traceFileId ?? null) : null
              }
              revealOnComplete={revealComplete}
              appId={investigation.applicationId}
              traceContent={contentQuery.data}
              traceName={
                trace?.traceName ?? contentQuery.data?.originalFilename
              }
            />
          ) : (
            <InvestigationDebateView
              task={debate.task}
              scenario={debate.scenario}
              citeTone={verdictTone}
              onExplain={() => {
                setExplainerStart((current) => ({
                  label: "Debate",
                  nonce: (current?.nonce ?? 0) + 1,
                }));
                setExplainerOpen(true);
              }}
            />
          )}
        </div>

        <ExplainerModal
          isOpen={!isRunning && explainerOpen}
          onClose={() => setExplainerOpen(false)}
        >
          <InvestigationResultSlideshow
            applicationName={application?.name}
            applicationHref={applicationPath}
            traceName={formatTraceDisplayName(
              trace?.traceName ?? contentQuery.data?.originalFilename,
            )}
            verdictLabel={verdictLabel}
            verdictTone={verdictTone}
            techniqueLabel={selectedTechniqueLabel}
            description={verdictDescription}
            model={investigation.model}
            durationSeconds={investigation.durationSeconds}
            confidence={investigation.confidence}
            reasoningSections={reasoningSections}
            evidence={evidence}
            appId={investigation.applicationId}
            scenario={debate.scenario}
            task={debate.task}
            startSlide={explainerStart}
          />
        </ExplainerModal>
      </div>
    </Layout>
  );
}
