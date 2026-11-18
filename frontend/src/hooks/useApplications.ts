import type { CreateAppValues } from "../components/CreateApp";
import type { Application } from "../utils/applicationStore";
import { toUserMessage } from "../utils/api";
import {
  useApplicationsQuery,
  useCreateApplicationMutation,
} from "../query/hooks/useApplicationsQuery";
import { queryClient } from "../query/client";
import { queryKeys } from "../query/keys";

export function useApplications() {
  const applicationsQuery = useApplicationsQuery();
  const createApplicationMutation = useCreateApplicationMutation();

  const applications = applicationsQuery.data ?? [];
  const loading = applicationsQuery.isLoading;
  const error = applicationsQuery.error
    ? toUserMessage(applicationsQuery.error, "applications.load")
    : null;

  async function addApplication(values: CreateAppValues): Promise<Application> {
    try {
      const app = await createApplicationMutation.mutateAsync({
        name: values.name,
        description: values.description,
      });
      return app;
    } catch (err) {
      const message = toUserMessage(err, "applications.create");
      throw new Error(message);
    }
  }

  async function updateApplication(
    id: string,
    values: CreateAppValues,
  ): Promise<void> {
    // Optimistic local update; full PATCH endpoint can be added later
    queryClient.setQueryData<Application[]>(queryKeys.applications(), (prev = []) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, name: values.name, description: values.description }
          : a,
      ),
    );
  }

  async function refresh(): Promise<void> {
    await queryClient.invalidateQueries({ queryKey: queryKeys.applications() });
  }

  return {
    applications,
    loading,
    error,
    addApplication,
    updateApplication,
    refresh,
  };
}
