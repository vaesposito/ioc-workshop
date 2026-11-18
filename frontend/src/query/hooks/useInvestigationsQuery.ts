import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cancelUserInitiatedInvestigations,
  overrideInvestigationVerdict,
  rerunInvestigationFromTrace,
  submitInvestigation,
} from "../../utils/api";
import { cmsRepository } from "../../cms/repository";
import type { Investigation } from "../../utils/investigationStore";
import { queryKeys } from "../keys";

export function useInvestigationsQuery(appId?: string) {
  return useQuery({
    queryKey: queryKeys.investigations.list(appId),
    queryFn: () => cmsRepository.listInvestigations(appId),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnMount: false,
  });
}

export function useSubmitInvestigationMutation(appId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: submitInvestigation,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.investigations.all(),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.traces.all(),
      });

      if (appId) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.investigations.list(appId),
        });
      }
    },
  });
}

export function useOverrideInvestigationVerdictMutation(appId?: string) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.investigations.list(appId);

  return useMutation({
    mutationFn: ({
      investigationId,
      verdict,
      reason,
    }: {
      investigationId: string;
      verdict: "malicious" | "benign";
      reason?: string;
    }) => overrideInvestigationVerdict(investigationId, verdict, reason),
    onSuccess: (updated) => {
      queryClient.setQueryData<Investigation[]>(queryKey, (prev = []) =>
        prev.map((inv) => (inv.id === updated.id ? updated : inv)),
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.traces.all(),
      });
    },
  });
}

export function useCancelUserInitiatedInvestigationsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: cancelUserInitiatedInvestigations,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.investigations.all(),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.traces.all(),
      });
    },
  });
}

export function useRerunInvestigationMutation(appId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: rerunInvestigationFromTrace,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.investigations.all(),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.traces.all(),
      });

      if (appId) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.investigations.list(appId),
        });
      }
    },
  });
}
