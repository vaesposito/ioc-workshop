import { useEffect, useState } from "react";
import {
  simulationStore,
  type SimulatedRunRecord,
} from "../cms/simulationStore";
import { LINKED_REASONING_STEPS } from "../utils/modelReasoning";

const STEP_COUNT = LINKED_REASONING_STEPS.length;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useSimulatedRunRecord(traceFileId?: string | null) {
  const [record, setRecord] = useState<SimulatedRunRecord | undefined>(() =>
    traceFileId ? simulationStore.get(traceFileId) : undefined,
  );

  useEffect(() => {
    if (!traceFileId) {
      setRecord(undefined);
      return;
    }
    const sync = () => setRecord(simulationStore.get(traceFileId));
    sync();
    return simulationStore.subscribe(sync);
  }, [traceFileId]);

  return record;
}

export function visibleStepCountForRecord(
  record: SimulatedRunRecord | undefined,
  now: number,
  reduceMotion: boolean,
): number {
  if (!record) {
    return 0;
  }
  if (record.status === "completed" || reduceMotion) {
    return STEP_COUNT;
  }
  const total = Math.max(1, record.scheduledCompletedAt - record.triggeredAt);
  const elapsed = Math.max(0, now - record.triggeredAt);
  // Reveal the reasoning steps over the first ~55% of the run so the remaining
  // window is left for streaming the evidence findings.
  const progress = Math.min(1, elapsed / (total * 0.55));
  return Math.min(STEP_COUNT, Math.max(1, Math.ceil(progress * STEP_COUNT)));
}

export function useSimulatedReasoningProgress(traceFileId?: string | null) {
  const record = useSimulatedRunRecord(traceFileId);
  const [now, setNow] = useState(() => Date.now());
  const isRunning = record?.status === "pending" || record?.status === "started";

  useEffect(() => {
    if (!isRunning || prefersReducedMotion()) {
      return;
    }
    const id = window.setInterval(() => setNow(Date.now()), 80);
    return () => window.clearInterval(id);
  }, [isRunning, record?.scheduledCompletedAt]);

  const visibleCount = visibleStepCountForRecord(
    record,
    now,
    prefersReducedMotion(),
  );
  const activeIndex = isRunning && visibleCount > 0 ? visibleCount - 1 : -1;

  return {
    record,
    isRunning: Boolean(isRunning),
    visibleCount,
    activeIndex,
  };
}
