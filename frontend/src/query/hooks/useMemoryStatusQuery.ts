import { useQuery } from "@tanstack/react-query";
import { cmsRepository, type ApplicationTechniqueReadiness } from "../../cms/repository";
import { queryKeys } from "../keys";

const DEFAULT_TECHNIQUE_READINESS: ApplicationTechniqueReadiness = {
  evoguard: false,
};

export function useApplicationMemoryStatusQuery(
  appId?: string,
  options?: { enabled?: boolean },
) {
  const enabled = Boolean(appId) && (options?.enabled ?? true);
  const keyAppId = appId ?? "none";

  return useQuery({
    queryKey: queryKeys.memoryStatus.byApp(keyAppId),
    queryFn: () => cmsRepository.getApplicationMemoryStatus(appId ?? ""),
    enabled,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    placeholderData: DEFAULT_TECHNIQUE_READINESS,
  });
}
