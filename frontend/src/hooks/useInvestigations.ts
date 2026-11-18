import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  adaptInvestigationResultFromStream,
  buildInvestigationsStreamUrl,
  parseInvestigationStreamMessage,
  toUserMessage,
} from "../utils/api";
import { addInvestigationTerminalNotification } from "../utils/notificationStore";
import {
  useCancelUserInitiatedInvestigationsMutation,
  useInvestigationsQuery,
  useOverrideInvestigationVerdictMutation,
  useRerunInvestigationMutation,
  useSubmitInvestigationMutation,
} from "../query/hooks/useInvestigationsQuery";
import { queryKeys } from "../query/keys";
import type { Investigation } from "../utils/investigationStore";
import { getAuthAccessToken } from "../utils/authToken";
import {
  getUserInitiatedInvestigationIds,
  rememberDemoBaseline,
} from "../utils/demoSession";

interface UseInvestigationsOptions {
  enableStream?: boolean;
}

export function useInvestigations(
  appId?: string,
  options?: UseInvestigationsOptions,
) {
  const enableStream = options?.enableStream ?? false;
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const reconnectTimeoutRef = useRef<number | null>(null);
  const retriesRef = useRef<number>(0);

  const investigationsQuery = useInvestigationsQuery(appId);

  const investigations = investigationsQuery.data ?? [];

  useEffect(() => {
    if (appId || investigationsQuery.isLoading || investigationsQuery.isError) {
      return;
    }
    rememberDemoBaseline(investigations.map((investigation) => investigation.id));
  }, [
    appId,
    investigations,
    investigationsQuery.isError,
    investigationsQuery.isLoading,
  ]);

  const addInvestigationMutation = useSubmitInvestigationMutation(appId);
  const rerunInvestigationMutation = useRerunInvestigationMutation(appId);
  const overrideVerdictMutation = useOverrideInvestigationVerdictMutation(appId);
  const cancelUserInitiatedMutation =
    useCancelUserInitiatedInvestigationsMutation();

  async function addInvestigation(formData: FormData): Promise<string> {
    try {
      const created = await addInvestigationMutation.mutateAsync(formData);
      setError(null);
      return created.id;
    } catch (err) {
      setError(toUserMessage(err, "investigations.create"));
      const message = toUserMessage(err, "investigations.create");
      throw new Error(message);
    }
  }

  async function overrideVerdict(
    investigationId: string,
    verdict: "malicious" | "benign",
    reason?: string,
  ): Promise<void> {
    try {
      await overrideVerdictMutation.mutateAsync({
        investigationId,
        verdict,
        reason,
      });
      setError(null);
    } catch (err) {
      setError(toUserMessage(err, "investigations.override"));
      const message = toUserMessage(err, "investigations.override");
      throw new Error(message);
    }
  }

  async function rerunInvestigation(params: {
    appId: string;
    technique: string;
    traceFileId: string;
    namePrefix?: string;
  }): Promise<string[]> {
    try {
      const created = await rerunInvestigationMutation.mutateAsync(params);
      setError(null);
      return created.map((row) => row.id);
    } catch (err) {
      setError(toUserMessage(err, "investigations.rerun"));
      const message = toUserMessage(err, "investigations.rerun");
      throw new Error(message);
    }
  }

  async function cancelUserInitiatedInvestigations(): Promise<string[]> {
    const extras = getUserInitiatedInvestigationIds(
      investigations.map((investigation) => investigation.id),
    );
    if (extras.length === 0) {
      return [];
    }
    try {
      const deleted = await cancelUserInitiatedMutation.mutateAsync(extras);
      setError(null);
      return deleted;
    } catch (err) {
      setError(toUserMessage(err, "investigations.cancel"));
      const message = toUserMessage(err, "investigations.cancel");
      throw new Error(message);
    }
  }

  const queryError = investigationsQuery.error
    ? toUserMessage(investigationsQuery.error, "investigations.load")
    : null;

  const queryKey = useMemo(
    () => queryKeys.investigations.list(appId),
    [appId],
  );

  const wsDebugEnabled = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }

    if (import.meta.env.DEV) {
      return true;
    }

    try {
      return window.localStorage.getItem("detective:ws-debug") === "1";
    } catch {
      return false;
    }
  }, []);

  const wsConnectionSequenceRef = useRef<number>(0);

  useEffect(() => {
    if (!enableStream || typeof window === "undefined") {
      return;
    }

    let closedByEffect = false;
    let socket: WebSocket | null = null;

    function logWs(
      level: "debug" | "info" | "warn" | "error",
      message: string,
      details?: Record<string, unknown>,
    ) {
      if (!wsDebugEnabled) {
        return;
      }

      const payload = details ? { ...details } : undefined;
      const logger =
        level === "error"
          ? console.error
          : level === "warn"
            ? console.warn
            : level === "info"
              ? console.info
              : console.debug;

      logger(`[investigations.ws] ${message}`, payload ?? "");
    }

    function summarizeStreamUrl(streamUrl: string): Record<string, unknown> {
      try {
        const parsed = new URL(streamUrl);
        const queryKeys = Array.from(parsed.searchParams.keys()).sort();
        return {
          protocol: parsed.protocol,
          host: parsed.host,
          path: parsed.pathname,
          queryKeys,
          hasAccessToken: parsed.searchParams.has("access_token"),
          hasAppId: parsed.searchParams.has("app_id"),
        };
      } catch {
        return { malformedUrl: true };
      }
    }

    function clearReconnectTimer() {
      if (reconnectTimeoutRef.current !== null) {
        window.clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    }

    function scheduleReconnect() {
      if (closedByEffect) {
        return;
      }
      clearReconnectTimer();
      retriesRef.current += 1;
      const delayMs = Math.min(1000 * 2 ** (retriesRef.current - 1), 10000);
      logWs("warn", "Scheduling websocket reconnect", {
        appId: appId ?? null,
        retryAttempt: retriesRef.current,
        delayMs,
      });
      reconnectTimeoutRef.current = window.setTimeout(() => {
        connect();
      }, delayMs);
    }

    function patchCaches(event: {
      event_id: string;
      app_id: string;
      investigation_id: string;
      status: "pending" | "started" | "completed" | "failed";
      timestamp: string;
      result?: unknown;
    }) {
      const completedAt = new Date(event.timestamp).getTime();
      let investigationName: string | undefined;
      const allKeys = [
        queryKeys.investigations.list(undefined),
        queryKeys.investigations.list(event.app_id),
      ];

      for (const key of allKeys) {
        queryClient.setQueryData<Investigation[]>(key, (prev) => {
          if (!prev) {
            return prev;
          }
          return prev.map((inv) => {
            if (inv.id !== event.investigation_id) {
              return inv;
            }

            investigationName = investigationName || inv.name;

            const streamResult = adaptInvestigationResultFromStream(
              event.result,
              event.status,
            );

            const next: Investigation = {
              ...inv,
              ...streamResult,
              status: event.status,
            };

            if (event.status === "started") {
              next.startedAt = inv.startedAt ?? completedAt;
            }
            if (event.status === "completed" || event.status === "failed") {
              next.completedAt = Number.isFinite(completedAt)
                ? completedAt
                : inv.completedAt;
            }

            return next;
          });
        });
      }

      if (event.status === "completed" || event.status === "failed") {
        addInvestigationTerminalNotification({
          investigationId: event.investigation_id,
          status: event.status,
          createdAt: Number.isFinite(completedAt) ? completedAt : Date.now(),
          appName: event.app_id,
          investigationName,
          eventId: event.event_id,
        });

        void queryClient.invalidateQueries({
          queryKey: queryKeys.investigations.all(),
        });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.traces.all(),
        });
      }
    }

    function connect() {
      const accessToken = getAuthAccessToken();
      if (!accessToken) {
        logWs("warn", "Skipping websocket connect because token is missing", {
          appId: appId ?? null,
        });
        return;
      }

      const connectionId = `${Date.now()}-${++wsConnectionSequenceRef.current}`;
      const startedAtMs = Date.now();
      let streamUrl: string;
      try {
        streamUrl = buildInvestigationsStreamUrl({ accessToken, appId });
      } catch (err) {
        console.log("Failed to build websocket stream URL", { err});
        logWs("error", "Failed to build websocket stream URL", {
          appId: appId ?? null,
          connectionId,
          error:
            err instanceof Error
              ? { name: err.name, message: err.message }
              : String(err),
        });
        setError(toUserMessage(new Error("stream_url"), "investigations.stream"));
        return;
      }

      logWs("info", "Opening websocket connection", {
        appId: appId ?? null,
        connectionId,
        retryAttempt: retriesRef.current,
        ...summarizeStreamUrl(streamUrl),
      });

      socket = new WebSocket(streamUrl);

      socket.onopen = () => {
        const connectMs = Math.max(Date.now() - startedAtMs, 0);
        logWs("info", "Websocket connection opened", {
          appId: appId ?? null,
          connectionId,
          connectMs,
        });
        retriesRef.current = 0;
      };

      socket.onmessage = (messageEvent) => {
        const parsed = parseInvestigationStreamMessage(messageEvent.data);
        if (!parsed || parsed.type === "heartbeat") {
          return;
        }

        logWs("debug", "Received websocket event", {
          appId: parsed.app_id,
          connectionId,
          eventId: parsed.event_id,
          status: parsed.status,
        });
        patchCaches(parsed);
      };

      socket.onerror = (e) => {
        console.log("Websocket error event", e);
        logWs("error", "Websocket error event", {
          appId: appId ?? null,
          connectionId,
          readyState: socket?.readyState,
          eventType: e.type,
        });
        setError((existing) => {
          if (existing) return existing;
          return toUserMessage(new Error("stream_error"), "investigations.stream");
        });
      };

      socket.onclose = (event) => {
        logWs("warn", "Websocket connection closed", {
          appId: appId ?? null,
          connectionId,
          code: event.code,
          reason: event.reason || null,
          wasClean: event.wasClean,
          closedByEffect,
          readyState: socket?.readyState,
        });
        socket = null;
        scheduleReconnect();
      };
    }

    connect();

    return () => {
      closedByEffect = true;
      clearReconnectTimer();
      if (socket && socket.readyState !== WebSocket.CLOSED) {
        logWs("info", "Closing websocket due to effect cleanup", {
          appId: appId ?? null,
          readyState: socket.readyState,
        });
        socket.close();
      }
    };
  }, [appId, enableStream, queryClient, queryKey, wsDebugEnabled]);

  const loading = investigationsQuery.isLoading;
  const effectiveError = error ?? queryError;

  return {
    investigations,
    loading,
    error: effectiveError,
    addInvestigation,
    rerunInvestigation,
    cancelUserInitiatedInvestigations,
    overrideVerdict,
  };
}
