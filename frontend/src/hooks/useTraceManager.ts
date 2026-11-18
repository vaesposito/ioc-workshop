import { toUserMessage } from "../utils/api";
import { useTraceManagerQuery } from "../query/hooks/useTraceManagerQuery";

export function useTraceManager() {
  const tracesQuery = useTraceManagerQuery();

  return {
    traces: tracesQuery.data ?? [],
    loading: tracesQuery.isLoading,
    error: tracesQuery.error
      ? toUserMessage(tracesQuery.error, "traces.load")
      : null,
  };
}
