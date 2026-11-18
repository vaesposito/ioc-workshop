import { useEffect, useMemo, useState } from "react";
import { LuArrowLeft, LuPlay, LuRotateCcw } from "react-icons/lu";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { SentenceProse } from "../components/SentenceProse";
import { Layout } from "../components/Layout";
import { DemoLocked } from "../components/DemoLocked";
import { TraceChatPanel } from "../components/TraceChatPanel";
import { VeredictBadge } from "../components/VeredictBadge";
import { useApplications } from "../hooks/useApplications";
import { useInvestigations } from "../hooks/useInvestigations";
import { useTraceManager } from "../hooks/useTraceManager";
import { useTraceContentQuery } from "../query/hooks/useTraceContentQuery";
import { OpenTraceJsonLink } from "../components/OpenTraceJsonLink";
import { toUserMessage } from "../utils/api";
import {
  formatTraceDate,
  getLatestCompletedInvestigation,
} from "../utils/portfolio";
import { getTechniqueLabel } from "../utils/techniques";
import { conversationToEvents } from "../utils/traceVisualizer";
import { buildEvidencePipeline, parseEvidenceDisplay } from "../utils/evidencePipeline";

const THEORY_OF_MIND = `Detective Agent applies Theory-of-Mind reasoning to a completed trace. From the observable messages, reasoning, and tool calls, it builds an evidence-based interpretation of how the agent appears to understand its task, constraints, and intended outcome, in other words its inferred beliefs. It then compares those beliefs with the agent's observed actions to surface meaningful contradictions. Every verdict connects that behavioral gap to a clear rationale and directly traceable evidence.`;

export function DetectiveResult() {
  const { id, traceFileId } = useParams<{
    id: string;
    traceFileId: string;
  }>();
  const navigate = useNavigate();
  const { applications } = useApplications();
  const { traces } = useTraceManager();
  const { investigations, loading: investigationsLoading } = useInvestigations(
    id,
    { enableStream: false },
  );
  const contentQuery = useTraceContentQuery(traceFileId);
  const [focusEvidenceId, setFocusEvidenceId] = useState<string | null>(null);

  const application = applications.find((app) => app.id === id);
  const trace = traces.find((row) => row.traceFileId === traceFileId);
  const completed = traceFileId
    ? getLatestCompletedInvestigation(investigations, traceFileId)
    : undefined;
  const running = investigations.some(
    (investigation) =>
      investigation.traceFileId === traceFileId &&
      (investigation.status === "pending" || investigation.status === "started"),
  );

  const conversation = useMemo(() => {
    if (contentQuery.data?.conversation?.length) {
      return contentQuery.data.conversation;
    }
    return completed?.memory?.raw_conversation_payload ?? [];
  }, [contentQuery.data, completed]);

  const events = useMemo(
    () => conversationToEvents(conversation, completed?.results ?? []),
    [conversation, completed],
  );

  const pipelineEvidence = useMemo(
    () => buildEvidencePipeline({ evidence: completed?.results ?? [] }),
    [completed],
  );

  useEffect(() => {
    if (focusEvidenceId) {
      return;
    }
    const firstLocated = (completed?.results ?? []).find((item) =>
      events.some((event) => event.matchedEvidenceIds.includes(item.id)),
    );
    if (firstLocated) {
      setFocusEvidenceId(firstLocated.id);
    }
  }, [completed, events, focusEvidenceId]);

  const contentError = contentQuery.error
    ? toUserMessage(contentQuery.error, "traces.content")
    : null;

  const timestamp = completed
    ? formatTraceDate(completed.completedAt ?? completed.createdAt)
    : "—";

  const citeTone =
    completed?.status === "failed"
      ? "warning"
      : completed?.verdict === "malicious"
        ? "danger"
        : completed
          ? "success"
          : "danger";

  if (!investigationsLoading && completed) {
    return <Navigate to={`/investigations/${completed.id}`} replace />;
  }

  return (
    <Layout pageTitle="Detective Result">
      <div className="flex flex-col gap-8 py-2">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-3xl">
            <button
              type="button"
              onClick={() => navigate(`/applications/${id}`)}
              className="ioc-back mb-3"
            >
              <LuArrowLeft size={14} />
              {application?.name ?? "Application"}
            </button>
            <h1 className="ioc-title text-3xl">Detective Result</h1>
            <p className="ioc-copy mt-3 text-[15px]">
              Output of Detective Agent for one trace. Re-running investigation
              replaces the previous result.
            </p>
            <p className="ioc-faint mt-2 truncate text-[12px] font-light">
              {trace?.traceName ?? "Trace"}
            </p>
          </div>
          <DemoLocked>
            <button type="button" disabled className="ioc-btn-primary">
              {completed ? <LuRotateCcw size={14} /> : <LuPlay size={14} />}
              {completed ? "Re-run investigation" : "Start investigation"}
            </button>
          </DemoLocked>
        </div>

        <div className="ioc-glass ioc-copy rounded-xl px-4 py-4 text-[13px] font-light leading-6">
          {THEORY_OF_MIND}
        </div>

        {running ? (
          <div className="sev-warning rounded-lg border px-4 py-3 text-[13px] font-light">
            An investigation run is in progress. The previous result stays visible
            until the new run completes and replaces it.
          </div>
        ) : null}

        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
          {!completed ? (
            <div className="ioc-glass rounded-xl px-6 py-12 text-center lg:col-span-2">
              <p className="ioc-copy">
                No Detective Agent result is available for this trace yet.
              </p>
            </div>
          ) : (
            <>
              <section className="ioc-glass min-w-0 space-y-4 rounded-xl p-4">
                <div>
                  <p className="ioc-kicker">Execution timestamp</p>
                  <p className="ioc-copy mt-2 text-sm font-light">{timestamp}</p>
                </div>
                <div>
                  <p className="ioc-kicker">Verdict</p>
                  <div className="mt-2">
                    <VeredictBadge
                      verdict={
                        completed.verdict === "malicious"
                          ? "malicious"
                          : "benign"
                      }
                    />
                  </div>
                </div>
                <div>
                  <p className="ioc-kicker">Technique</p>
                  <p className="ioc-copy mt-2 text-sm font-light">
                    {getTechniqueLabel(completed.technique)}
                  </p>
                </div>
              </section>

              <section className="ioc-glass min-w-0 space-y-4 rounded-xl p-4 lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto">
                <div>
                  <p className="ioc-kicker">Rationale</p>
                  <SentenceProse
                    text={
                      completed.description?.trim() ||
                      "Detective Agent did not return a rationale for this run."
                    }
                    className="ioc-copy mt-2 text-[14px] font-light leading-6"
                  />
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="ioc-kicker">Supporting evidence</p>
                    <span className="ioc-faint text-[12px] font-light">
                      {completed.results.length}
                    </span>
                  </div>
                  {completed.results.length === 0 ? (
                    <p className="ioc-copy text-[13px] font-light">
                      No evidence items were returned.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {pipelineEvidence.map((item, index) => {
                        const located = events.some((event) =>
                          event.matchedEvidenceIds.includes(item.id),
                        );
                        return (
                          <li key={item.id}>
                            <button
                              type="button"
                              disabled={!located}
                              onClick={() => setFocusEvidenceId(item.id)}
                              className={`ioc-chat-issue${
                                focusEvidenceId === item.id ? " is-active" : ""
                              }`}
                            >
                              <p className="ioc-fg text-[12px] font-light">
                                {index + 1}. {parseEvidenceDisplay(item).title}
                                {located ? "" : " · not located in trace"}
                              </p>
                              <p className="ioc-copy mt-1 text-[12.5px] font-light leading-5">
                                {item.description}
                              </p>
                              {item.excerpt ? (
                                <p className="ioc-faint mt-2 font-mono text-[11.5px] leading-5">
                                  {item.excerpt}
                                </p>
                              ) : null}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </section>
            </>
          )}

          <section className="ioc-glass flex min-h-[24rem] min-w-0 flex-col rounded-xl p-4 lg:max-h-[calc(100vh-12rem)]">
            <div className="flex shrink-0 items-center justify-between gap-3">
              <p className="ioc-kicker">Trace</p>
              <OpenTraceJsonLink
                content={contentQuery.data}
                traceName={trace?.traceName ?? contentQuery.data?.originalFilename}
              />
            </div>
            <div className="ioc-chat-scroll mt-3 min-h-0 flex-1">
              <TraceChatPanel
                events={events}
                focusEvidenceId={focusEvidenceId}
                isLoading={contentQuery.isLoading}
                error={contentError}
                showToolbar={false}
                citeTone={citeTone}
              />
            </div>
          </section>
        </div>
      </div>
    </Layout>
  );
}
