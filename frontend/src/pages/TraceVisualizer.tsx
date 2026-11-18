import { useEffect, useMemo, useRef } from "react";
import { LuPlay } from "react-icons/lu";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  completeSimulatedRun,
  getPoolInvestigation,
  isPoolTrace,
  startSimulatedRun,
} from "../cms/simulatedRuns";
import { InvestigationRunningSteps } from "../components/InvestigationRunningSteps";
import { Layout } from "../components/Layout";
import { OpenTraceJsonLink } from "../components/OpenTraceJsonLink";
import { TraceChatPanel } from "../components/TraceChatPanel";
import { TraceDebatePanel } from "../components/TraceDebatePanel";
import { ViewSwitch } from "../components/ViewSwitch";
import { useApplications } from "../hooks/useApplications";
import { useSimulatedRunRecord } from "../hooks/useSimulatedReasoningProgress";
import { useStartInvestigationDrawer } from "../hooks/useStartInvestigationDrawer";
import { useTraceManager } from "../hooks/useTraceManager";
import { useTraceContentQuery } from "../query/hooks/useTraceContentQuery";
import { toUserMessage } from "../utils/api";
import { buildEvidencePipeline } from "../utils/evidencePipeline";
import { debateForTrace } from "../utils/madDebates";
import { getLinkedReasoningView } from "../utils/modelReasoning";
import {
  formatTraceDisplayName,
  investigationReportPath,
  traceHasInvestigation,
} from "../utils/portfolio";
import { getTraceNarrative } from "../utils/traceNarratives";
import { conversationToEvents } from "../utils/traceVisualizer";

/**
 * A trace before anything has been made of it: the recording as it arrived,
 * and the button that starts an investigation on it. Once a trace has a
 * report the page hands over to it, so what the detector found is read
 * there — but the debate behind the trace can still be opened here, which is
 * how this page read before the report took it over.
 */
export function TraceVisualizer() {
  const { id, traceFileId } = useParams<{
    id: string;
    traceFileId: string;
  }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get("view") === "debate" ? "debate" : "recording";

  function showView(next: "recording" | "debate") {
    const params = new URLSearchParams(searchParams);
    if (next === "recording") {
      params.delete("view");
    } else {
      params.set("view", next);
    }
    setSearchParams(params, { replace: true });
  }

  const { openStartInvestigationDrawer } = useStartInvestigationDrawer();
  const { applications } = useApplications();
  const { traces } = useTraceManager();

  const application = applications.find((app) => app.id === id);
  const trace = traces.find((row) => row.traceFileId === traceFileId);
  const contentQuery = useTraceContentQuery(traceFileId);

  const narrative = getTraceNarrative({
    filenames: [trace?.traceName, contentQuery.data?.originalFilename],
    appId: application?.id ?? id,
    appName: application?.name,
  });
  const poolInvestigation = traceFileId
    ? getPoolInvestigation(traceFileId)
    : undefined;
  const runningReasoning = useMemo(
    () =>
      getLinkedReasoningView(
        narrative?.reasoningSteps,
        poolInvestigation?.modelReasoning ?? null,
      ) ?? undefined,
    [narrative?.reasoningSteps, poolInvestigation?.modelReasoning],
  );
  const runningEvidence = useMemo(
    () => buildEvidencePipeline({ evidence: poolInvestigation?.results ?? [] }),
    [poolInvestigation?.results],
  );
  const events = useMemo(
    () => conversationToEvents(contentQuery.data?.conversation ?? [], []),
    [contentQuery.data?.conversation],
  );
  // The trace decides which debate it shows: the verdict picks the scenario
  // and the trace id picks the question.
  const debate = useMemo(
    () => debateForTrace(traceFileId, trace?.latestLabel),
    [traceFileId, trace?.latestLabel],
  );
  const contentError = contentQuery.error
    ? toUserMessage(contentQuery.error, "traces.content")
    : null;
  const traceLabel =
    formatTraceDisplayName(trace?.traceName ?? "Trace") || "Trace";

  const simulatedRun = useSimulatedRunRecord(traceFileId);
  const isRunning =
    simulatedRun?.status === "pending" ||
    simulatedRun?.status === "started" ||
    trace?.latestStatus === "pending" ||
    trace?.latestStatus === "started";
  const canStart = Boolean(
    id && !isRunning && (!trace || !traceHasInvestigation(trace)),
  );
  const poolReportId =
    !isRunning && simulatedRun?.status === "completed"
      ? getPoolInvestigation(traceFileId ?? "")?.id
      : undefined;
  const reportPath =
    (trace ? investigationReportPath(trace) : null) ??
    (poolReportId ? `/investigations/${poolReportId}` : null);

  // Remember whether this page actually watched the run so the report knows to
  // play the completion reveal (verdict + metadata, then expand components).
  const wasRunningRef = useRef(false);
  useEffect(() => {
    if (isRunning) {
      wasRunningRef.current = true;
    }
  }, [isRunning]);

  useEffect(() => {
    if (isRunning || !reportPath) {
      return;
    }
    navigate(reportPath, {
      replace: true,
      state: wasRunningRef.current ? { justCompleted: true } : undefined,
    });
  }, [isRunning, reportPath, navigate]);

  function openStart() {
    if (!canStart || !id) {
      return;
    }
    // Already on this trace: start it immediately instead of re-prompting for a file.
    if (traceFileId && isPoolTrace(traceFileId)) {
      startSimulatedRun(traceFileId);
      return;
    }
    openStartInvestigationDrawer({
      mode: "start-investigation",
      defaultApplicationId: id,
      lockApplicationSelection: true,
      traceFileId,
      traceName: trace?.traceName,
      initialStep: traceFileId ? 3 : 2,
    });
  }

  return (
    <Layout
      pageActions={
        isRunning ? undefined : (
          <ViewSwitch
            value={view}
            options={[
              { value: "recording", label: "Recording" },
              { value: "debate", label: "Debate" },
            ]}
            onChange={showView}
          />
        )
      }
      breadcrumbs={[
        { label: "Applications", to: "/applications" },
        {
          label: application?.name ?? "Application",
          to: id ? `/applications/${id}` : "/applications",
        },
        { label: traceLabel },
      ]}
    >
      {/* Fixed to the viewport from lg up, so the trace scrolls inside the
          page rather than the page scrolling as one. Narrower than that it
          stacks, and the page itself takes the scrolling again. */}
      <div className="flex min-h-[calc(100dvh-8.5rem)] flex-col lg:h-[calc(100dvh-8.5rem)] lg:min-h-0">
        <div className="ioc-hairline flex shrink-0 flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b px-4 pb-4">
          <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
            <div>
              <p className="ioc-kicker">Application</p>
              <p className="ioc-fg mt-1.5 text-[19px] font-light leading-tight tracking-tight">
                {application?.name ?? "Application"}
              </p>
            </div>
            <div className="min-w-0">
              <p className="ioc-kicker">Trace</p>
              <p className="ioc-fg mt-1.5 break-all text-[19px] font-light leading-tight tracking-tight">
                {traceLabel}
              </p>
            </div>
            {narrative?.userTask ? (
              <div className="min-w-0 max-w-xl">
                <p className="ioc-kicker">User task</p>
                <p className="ioc-copy mt-1.5 text-[13px] font-light leading-[1.45]">
                  {narrative.userTask}
                </p>
              </div>
            ) : null}
          </div>

          <div className="flex-1" />
          {canStart ? (
            <button
              type="button"
              onClick={openStart}
              className="ioc-cta ioc-cta-compact"
            >
              Start investigation
              <LuPlay size={14} />
            </button>
          ) : isRunning ? (
            <p className="ioc-faint text-[13px] font-light">
              Agent-ToM is working through the reasoning chain.
            </p>
          ) : null}
        </div>

        {isRunning && traceFileId ? (
          <div className="min-h-0 flex-1 p-4">
            <div className="ioc-scroll mx-auto h-full max-w-3xl lg:overflow-y-auto">
              <InvestigationRunningSteps
                traceFileId={traceFileId}
                showHeader={false}
                sections={runningReasoning}
                evidence={runningEvidence}
                onComplete={() => completeSimulatedRun(traceFileId)}
              />
            </div>
          </div>
        ) : view === "debate" ? (
          <TraceDebatePanel task={debate.task} scenario={debate.scenario} />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col p-4">
            <div className="flex shrink-0 items-center justify-between gap-3">
              <p className="ioc-kicker">Trace</p>
              <OpenTraceJsonLink
                content={contentQuery.data}
                traceName={trace?.traceName ?? contentQuery.data?.originalFilename}
              />
            </div>
            <div className="ioc-scroll mt-3 min-h-0 flex-1 lg:overflow-y-auto">
              <TraceChatPanel
                events={events}
                isLoading={contentQuery.isLoading}
                error={contentError}
                showToolbar={false}
                showCited={false}
              />
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
