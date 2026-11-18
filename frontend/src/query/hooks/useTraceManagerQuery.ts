import { useQuery } from "@tanstack/react-query";
import { cmsRepository } from "../../cms/repository";
import { queryKeys } from "../keys";

export function useTraceManagerQuery() {
  return useQuery({
    queryKey: queryKeys.traces.list(),
    queryFn: cmsRepository.listTraceManagerRows,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnMount: false,
  });
}
