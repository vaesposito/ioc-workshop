import { useQuery } from "@tanstack/react-query";
import { cmsRepository } from "../../cms/repository";
import { queryKeys } from "../keys";

export function useTraceContentQuery(traceFileId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.traces.detail(traceFileId ?? ""),
    queryFn: () => cmsRepository.getTraceContent(traceFileId as string),
    enabled: Boolean(traceFileId),
    staleTime: 60_000,
  });
}
