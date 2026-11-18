import {
  LuCheck,
  LuChevronLeft,
  LuChevronRight,
  LuPlay,
  LuZap,
} from "react-icons/lu";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useCreateApplicationMutation } from "../query/hooks/useApplicationsQuery";
import type { Application } from "../utils/applicationStore";
import { VeredictBadge } from "./VeredictBadge";
import { toUserMessage, type TraceManagerRow } from "../utils/api";
import {
  formatTraceDate,
  formatTraceDisplayName,
  demoShuffleSeed,
  seededShuffle,
  traceHasInvestigation,
} from "../utils/portfolio";
import { isCannedTrace } from "../utils/cannedTraceIds";
import {
  DEFAULT_TECHNIQUE_ID,
  type TechniqueId,
} from "../utils/techniques";

interface Technique {
  value: TechniqueId;
  label: string;
  subtitle: string;
  description: string;
  when: string;
  requires: string;
  Icon: React.ElementType;
}

const TECHNIQUES: Technique[] = [
  {
    value: "evoguard",
    label: "Agent-ToM",
    subtitle: "Evolving behavioral envelope",
    description:
      "Maintains a behavioral envelope for the app and flags significant deviations as suspicious.",
    when: "Best when attack patterns are novel and you want anomaly-style detection rather than strict pattern matching.",
    requires: "OpenAI endpoint credentials.",
    Icon: LuZap,
  },
];

const STEPS = [
  { n: 1, label: "Application" },
  { n: 2, label: "Trace" },
  { n: 3, label: "Investigate" },
] as const;

const MAX_NAME_LENGTH = 80;
const MAX_DESCRIPTION_LENGTH = 280;

function previousDetectionVerdict(trace: TraceManagerRow): string | null {
  if (trace.latestLabel === "malicious" || trace.latestLabel === "benign") {
    return trace.latestLabel;
  }
  if (trace.latestStatus === "failed") {
    return "failed";
  }
  if (trace.latestStatus === "pending" || trace.latestStatus === "started") {
    return "running";
  }
  return null;
}

function PreviousDetectionsMeta({ trace }: { trace: TraceManagerRow }) {
  const count = trace.investigationsCount;
  if (count === 0) {
    return (
      <span className="ioc-faint text-[11px] font-light">
        No previous investigations
      </span>
    );
  }
  const noun = count === 1 ? "previous investigation" : "previous investigations";
  const verdict = previousDetectionVerdict(trace);
  return (
    <span className="flex flex-wrap items-center gap-2">
      {verdict ? <VeredictBadge verdict={verdict} size="sm" /> : null}
      <span className="ioc-faint text-[11px] font-light">
        {count} {noun}
      </span>
    </span>
  );
}

function TraceDates({ trace }: { trace: TraceManagerRow }) {
  return (
    <>
      <span className="ioc-faint text-[11px] font-light">
        Collection {formatTraceDate(trace.submittedAtMs)}
      </span>
      <span className="ioc-faint text-[11px] font-light">
        Analysis {formatTraceDate(trace.latestAnalyzedAtMs)}
      </span>
    </>
  );
}

function ApplicationRowMeta({
  name,
  traceCount,
  createdAtMs,
}: {
  name: string;
  traceCount: number;
  createdAtMs?: number;
}) {
  return (
    <span className="flex w-full min-w-0 flex-col items-start gap-1">
      <span className="ioc-fg w-full truncate text-[13px] font-light">
        {name}
      </span>
      <span className="flex items-baseline gap-1.5">
        <span className="ioc-fg text-[13px] font-light tabular-nums">
          {traceCount}
        </span>
        <span className="ioc-copy text-[11px] font-light">
          {traceCount === 1 ? "trace" : "traces"}
        </span>
      </span>
      {createdAtMs ? (
        <span className="ioc-faint text-[11px] font-light">
          {formatTraceDate(createdAtMs)}
        </span>
      ) : null}
    </span>
  );
}

export interface StartInvestigationValues {
  applicationId: string;
  technique: TechniqueId;
  file: File | null;
  traceFileId?: string;
  traceName?: string;
}

interface StartInvestigationPanelProps {
  applications: Application[];
  defaultApplicationId?: string;
  lockApplicationSelection?: boolean;
  defaultTraceFileId?: string;
  defaultTraceName?: string;
  traces?: TraceManagerRow[];
  initialStep?: 1 | 2 | 3;
  onCancel: () => void;
  onSubmit: (values: StartInvestigationValues) => Promise<void> | void;
}

export function StartInvestigationPanel({
  applications,
  defaultApplicationId,
  lockApplicationSelection,
  defaultTraceFileId,
  defaultTraceName,
  traces,
  initialStep = 1,
  onCancel,
  onSubmit,
}: StartInvestigationPanelProps) {
  const createApplicationMutation = useCreateApplicationMutation();
  const [step, setStep] = useState<1 | 2 | 3>(initialStep);
  const [appMode, setAppMode] = useState<"existing" | "create">("existing");
  const isApplicationLocked = Boolean(
    defaultApplicationId && lockApplicationSelection,
  );
  const [selectedAppId, setSelectedAppId] = useState<string>(
    defaultApplicationId ?? applications[0]?.id ?? "",
  );
  const [newAppName, setNewAppName] = useState("");
  const [newAppDescription, setNewAppDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [traceInputMode, setTraceInputMode] = useState<"upload" | "existing">(
    "existing",
  );
  const [selectedTraceFileId, setSelectedTraceFileId] = useState<string>(
    defaultTraceFileId ?? "",
  );

  const selectedApplication = useMemo(
    () => applications.find((app) => app.id === selectedAppId),
    [applications, selectedAppId],
  );

  const creatingApp = !isApplicationLocked && appMode === "create";

  const openTraces = useMemo(
    () => (traces ?? []).filter((trace) => !traceHasInvestigation(trace)),
    [traces],
  );

  const appTraces = useMemo(() => {
    if (creatingApp) return [];
    return (traces ?? []).filter((trace) => trace.appId === selectedAppId);
  }, [traces, selectedAppId, creatingApp]);

  const traceCountByAppId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const trace of openTraces) {
      if (!trace.appId) {
        continue;
      }
      counts.set(trace.appId, (counts.get(trace.appId) ?? 0) + 1);
    }
    return counts;
  }, [openTraces]);

  const rankedApplications = useMemo(() => {
    return applications.slice().sort((left, right) => {
      const countDiff =
        (traceCountByAppId.get(right.id) ?? 0) -
        (traceCountByAppId.get(left.id) ?? 0);
      if (countDiff !== 0) {
        return countDiff;
      }
      return left.name.localeCompare(right.name);
    });
  }, [applications, traceCountByAppId]);

  function traceCountFor(appId: string): number {
    return traceCountByAppId.get(appId) ?? 0;
  }

  const selectedTechnique = TECHNIQUES[0];

  const shuffleSeedRef = useRef<string>("");
  if (!shuffleSeedRef.current) {
    shuffleSeedRef.current = demoShuffleSeed();
  }

  const pickableTraces = useMemo(() => {
    const canned = appTraces
      .filter((trace) => !traceHasInvestigation(trace))
      .filter((trace) => isCannedTrace(trace.traceName));
    return seededShuffle(
      canned,
      (trace) => trace.traceFileId,
      shuffleSeedRef.current,
    );
  }, [appTraces]);

  const selectedPickableTrace = pickableTraces.find(
    (trace) => trace.traceFileId === selectedTraceFileId,
  );
  const isTraceLocked = Boolean(
    defaultTraceFileId &&
      pickableTraces.some((trace) => trace.traceFileId === defaultTraceFileId),
  );

  const hasApp = isApplicationLocked
    ? Boolean(defaultApplicationId ?? selectedAppId)
    : appMode === "existing"
      ? selectedAppId !== ""
      : newAppName.trim() !== "";
  const hasTrace =
    traceInputMode === "upload"
      ? file !== null
      : Boolean(selectedPickableTrace);

  useEffect(() => {
    if (isApplicationLocked) {
      setAppMode("existing");
      setSelectedAppId(defaultApplicationId ?? "");
      return;
    }
    if (defaultApplicationId) {
      setAppMode("existing");
      setSelectedAppId(defaultApplicationId);
      return;
    }
    if (rankedApplications.length === 0) {
      setAppMode("existing");
      setSelectedAppId("");
      return;
    }
    setSelectedAppId((current) => current || rankedApplications[0].id);
  }, [defaultApplicationId, rankedApplications, isApplicationLocked]);

  useEffect(() => {
    setStep(initialStep);
  }, [initialStep]);

  useEffect(() => {
    if (initialStep !== 3) {
      return;
    }
    const defaultIsOpen =
      Boolean(defaultTraceFileId) &&
      pickableTraces.some((trace) => trace.traceFileId === defaultTraceFileId);
    setStep(defaultIsOpen ? 3 : 2);
  }, [initialStep, defaultTraceFileId, pickableTraces]);

  useEffect(() => {
    setTraceInputMode("existing");
    setFile(null);
    setSelectedTraceFileId((current) => {
      if (
        current &&
        pickableTraces.some((trace) => trace.traceFileId === current)
      ) {
        return current;
      }
      if (
        defaultTraceFileId &&
        pickableTraces.some((trace) => trace.traceFileId === defaultTraceFileId)
      ) {
        return defaultTraceFileId;
      }
      return "";
    });
  }, [creatingApp, selectedAppId, defaultTraceFileId, pickableTraces]);

  function handleCancel() {
    onCancel();
  }

  function goNext() {
    if (step === 1 && hasApp) {
      setStep(2);
      return;
    }
    if (step === 2 && hasTrace) {
      setStep(3);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (step < 3) {
      goNext();
      return;
    }
    if (!hasApp || !hasTrace) {
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      let appId = isApplicationLocked
        ? (defaultApplicationId ?? selectedAppId)
        : selectedAppId;
      if (creatingApp) {
        const created = await createApplicationMutation.mutateAsync({
          name: newAppName.trim().slice(0, MAX_NAME_LENGTH),
          description: newAppDescription.trim().slice(0, MAX_DESCRIPTION_LENGTH),
        });
        appId = created.id;
      }
      if (!appId) {
        return;
      }
      await onSubmit({
        applicationId: appId,
        technique: DEFAULT_TECHNIQUE_ID,
        file: traceInputMode === "upload" ? file : null,
        traceFileId:
          traceInputMode === "existing"
            ? selectedPickableTrace?.traceFileId
            : undefined,
        traceName: traceSummary,
      });
    } catch (err) {
      setSubmitError(
        toUserMessage(
          err,
          creatingApp ? "applications.create" : "investigations.create",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  const continueDisabled =
    (step === 1 && !hasApp) || (step === 2 && !hasTrace) || submitting;
  const appSummary =
    creatingApp
      ? newAppName.trim() || "New application"
      : (selectedApplication?.name ?? "Application");
  const selectedTrace = selectedPickableTrace;
  const traceSummary =
    traceInputMode === "upload"
      ? (file?.name ?? "New upload")
      : (selectedTrace?.traceName ?? defaultTraceName ?? "Existing trace");

  return (
    <form
      noValidate
      onSubmit={(event) => void handleSubmit(event)}
      className="flex h-full min-h-0 flex-col"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 pt-5">
        <ol className="flex w-full items-center" aria-label="Investigation steps">
        {STEPS.map((item, index) => {
          const current = step === item.n;
          const selected =
            item.n === 1 ? hasApp : item.n === 2 ? hasTrace : current;
          const preselected =
            (item.n === 1 && isApplicationLocked) ||
            (item.n === 2 && isTraceLocked);
          const canOpen = item.n < step;
          return (
            <Fragment key={item.n}>
              <li className="flex min-w-0 shrink-0 items-center">
                <button
                  type="button"
                  disabled={!canOpen}
                  aria-current={current ? "step" : undefined}
                  aria-label={
                    preselected
                      ? `${item.label}, pre-selected`
                      : selected
                        ? `${item.label}, selected`
                        : item.label
                  }
                  onClick={() => {
                    if (canOpen) {
                      setStep(item.n);
                    }
                  }}
                  className={`flex min-w-0 items-center gap-2 ${
                    canOpen
                      ? "cursor-pointer hover:opacity-90"
                      : "cursor-default"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-medium ${
                      selected || current
                        ? "border-[#04A4CA] text-[#04A4CA]"
                        : "border-[color:var(--ioc-glass-border)] text-[color:var(--ioc-faint)]"
                    }`}
                  >
                    {selected && item.n < 3 ? (
                      <LuCheck size={13} aria-hidden="true" />
                    ) : (
                      item.n
                    )}
                  </span>
                  <span className="flex min-w-0 flex-col items-start">
                    <span
                      className={`text-[12px] font-light ${
                        current ? "ioc-fg" : "ioc-faint"
                      }`}
                    >
                      {item.label}
                    </span>
                    {preselected ? (
                      <span className="ioc-faint text-[10px] font-light tracking-[0.04em] uppercase">
                        Pre-selected
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
              {index < STEPS.length - 1 ? (
                <span
                  className="mx-3 h-px min-w-4 flex-1 bg-[color:var(--ioc-glass-border)]"
                  aria-hidden="true"
                />
              ) : null}
            </Fragment>
          );
        })}
      </ol>

      {step === 1 ? (
        <div className="flex flex-col gap-3">
          <label className="ioc-kicker">
            {isApplicationLocked ? "Pre-selected application" : "Application"}
          </label>
          {isApplicationLocked ? (
            <>
              <div className="ioc-glass rounded-lg">
                <div className="flex w-full flex-col items-start gap-1 px-3 py-2.5">
                  <ApplicationRowMeta
                    name={
                      selectedApplication?.name ?? "Selected application"
                    }
                    traceCount={
                      selectedAppId ? traceCountFor(selectedAppId) : 0
                    }
                    createdAtMs={selectedApplication?.createdAt}
                  />
                </div>
              </div>
              <p className="ioc-faint text-[11px] leading-[1.45]">
                Already chosen because you started from this application.
              </p>
            </>
          ) : (
            <>
              {appMode === "existing" ? (
                rankedApplications.length === 0 ? (
                  <p className="ioc-faint text-xs">
                    No applications yet. Create one to continue.
                  </p>
                ) : (
                  <div
                    role="listbox"
                    aria-label="Existing applications"
                    className="ioc-glass max-h-72 overflow-y-auto rounded-lg"
                  >
                    {rankedApplications.map((app) => {
                      const selected = selectedAppId === app.id;
                      return (
                        <button
                          key={app.id}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          onClick={() => setSelectedAppId(app.id)}
                          className={`ioc-click-row flex w-full flex-col items-start gap-1 border-b border-[color:var(--ioc-glass-border)] px-3 py-2.5 text-left last:border-b-0 ${
                            selected
                              ? "bg-[color:var(--ioc-row-hover)]"
                              : "hover:bg-[color:var(--ioc-row-hover)]"
                          }`}
                        >
                          <ApplicationRowMeta
                            name={app.name}
                            traceCount={traceCountFor(app.id)}
                            createdAtMs={app.createdAt}
                          />
                        </button>
                      );
                    })}
                  </div>
                )
              ) : (
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    value={newAppName}
                    maxLength={MAX_NAME_LENGTH}
                    autoFocus
                    onChange={(event) => setNewAppName(event.target.value)}
                    placeholder="Application name"
                    className="ioc-field w-full"
                  />
                  <textarea
                    value={newAppDescription}
                    maxLength={MAX_DESCRIPTION_LENGTH}
                    rows={3}
                    onChange={(event) => setNewAppDescription(event.target.value)}
                    placeholder="Description (optional)"
                    className="ioc-field w-full resize-none"
                  />
                </div>
              )}
            </>
          )}
        </div>
      ) : null}

      {step === 2 ? (
        <div className="flex flex-col gap-3">
          <label className="ioc-kicker">
            {isTraceLocked ? "Pre-selected trace" : "Trace"}
          </label>
          {isTraceLocked && selectedPickableTrace ? (
            <>
              <div className="ioc-glass rounded-lg px-3 py-2.5">
                <span className="ioc-fg block w-full truncate text-[13px] font-light">
                  {formatTraceDisplayName(selectedPickableTrace.traceName)}
                </span>
                <div className="mt-1 flex flex-col gap-0.5">
                  <TraceDates trace={selectedPickableTrace} />
                  <PreviousDetectionsMeta trace={selectedPickableTrace} />
                </div>
              </div>
              <p className="ioc-faint text-[11px] leading-[1.45]">
                Already chosen because you started from this trace.
              </p>
            </>
          ) : (
            <>
          {pickableTraces.length === 0 ? (
            <p className="ioc-faint text-xs">
              {appTraces.length === 0
                ? "This application has no traces yet."
                : "Every trace in this application already has an investigation."}
            </p>
          ) : null}

          {pickableTraces.length > 0 ? (
            <div
              role="listbox"
              aria-label="Existing traces"
              className="ioc-glass max-h-72 overflow-y-auto rounded-lg"
            >
              {pickableTraces.map((trace) => {
                const selected = selectedTraceFileId === trace.traceFileId;
                return (
                  <button
                    key={trace.traceFileId}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => setSelectedTraceFileId(trace.traceFileId)}
                    className={`ioc-click-row flex w-full flex-col items-start gap-0.5 border-b border-[color:var(--ioc-glass-border)] px-3 py-2.5 text-left last:border-b-0 ${
                      selected
                        ? "bg-[color:var(--ioc-row-hover)]"
                        : "hover:bg-[color:var(--ioc-row-hover)]"
                    }`}
                  >
                    <span className="ioc-fg w-full truncate text-[13px] font-light">
                      {formatTraceDisplayName(trace.traceName)}
                    </span>
                    <TraceDates trace={trace} />
                    <PreviousDetectionsMeta trace={trace} />
                  </button>
                );
              })}
            </div>
          ) : null}
            </>
          )}
        </div>
      ) : null}

      {step === 3 ? (
        <div className="flex flex-col gap-7">
          <section className="flex flex-col gap-3">
            <div>
              <h3 className="ioc-fg text-[15px] font-light tracking-tight">
                Ready to run
              </h3>
              <p className="ioc-faint mt-1 text-[12px] font-light leading-[1.5]">
                Application and trace chosen in the previous steps.
              </p>
            </div>
            <div className="ioc-review-card">
              <div className="ioc-review-row">
                <div className="ioc-review-row-head">
                  <p className="ioc-review-label">Application</p>
                  {isApplicationLocked ? (
                    <span className="ioc-review-chip">Pre-selected</span>
                  ) : null}
                </div>
                <p className="ioc-review-value">{appSummary}</p>
              </div>
              <div className="ioc-review-row">
                <div className="ioc-review-row-head">
                  <p className="ioc-review-label">Trace</p>
                  {isTraceLocked || defaultTraceFileId ? (
                    <span className="ioc-review-chip">Pre-selected</span>
                  ) : null}
                </div>
                <p className="ioc-review-value">
                  {traceInputMode === "upload"
                    ? traceSummary
                    : formatTraceDisplayName(traceSummary)}
                </p>
                {selectedTrace ? (
                  <div className="ioc-review-meta">
                    <TraceDates trace={selectedTrace} />
                    <PreviousDetectionsMeta trace={selectedTrace} />
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <div>
              <h3 className="ioc-fg text-[15px] font-light tracking-tight">
                Technique
              </h3>
              <p className="ioc-faint mt-1 text-[12px] font-light leading-[1.5]">
                Detector used for this investigation.
              </p>
            </div>
            <div className="ioc-review-card">
              <div className="ioc-review-row">
                <p className="ioc-review-value">{selectedTechnique.label}</p>
                <p className="ioc-copy mt-1 text-[13px] font-light">
                  {selectedTechnique.subtitle}
                </p>
                <p className="ioc-faint mt-3 text-[12px] font-light leading-[1.55]">
                  {selectedTechnique.description}
                </p>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {submitError ? (
        <p className="sev-danger-text text-xs">{submitError}</p>
      ) : null}
      </div>

      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-[color:var(--ioc-glass-border)] px-6 py-3">
        <button
          type="button"
          onClick={() => {
            if (step === 1) {
              handleCancel();
              return;
            }
            setStep((current) => (current === 3 ? 2 : 1));
          }}
          className="ioc-btn-ghost"
        >
          {step === 1 ? (
            "Cancel"
          ) : (
            <>
              <LuChevronLeft size={14} />
              Back
            </>
          )}
        </button>
        {step < 3 ? (
          <button
            type="submit"
            disabled={continueDisabled}
            className="ioc-btn-primary"
          >
            Continue
            <LuChevronRight size={14} />
          </button>
        ) : (
          <button
            type="submit"
            disabled={submitting || !hasApp || !hasTrace}
            className="ioc-btn-primary"
          >
            <LuPlay size={14} />
            {submitting ? "Starting..." : "Start investigation"}
          </button>
        )}
      </div>
    </form>
  );
}
