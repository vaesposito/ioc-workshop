import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createApplication } from "../../utils/api";
import { cmsRepository } from "../../cms/repository";
import type { Application } from "../../utils/applicationStore";
import { queryKeys } from "../keys";

export function useApplicationsQuery() {
  return useQuery({
    queryKey: queryKeys.applications(),
    queryFn: cmsRepository.listApplications,
  });
}

export function useCreateApplicationMutation() {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.applications();

  return useMutation({
    mutationFn: createApplication,
    onSuccess: (app) => {
      queryClient.setQueryData<Application[]>(queryKey, (prev = []) => [
        ...prev,
        app,
      ]);
    },
  });
}
