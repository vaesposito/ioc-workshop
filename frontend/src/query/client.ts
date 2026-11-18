import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { AUTH_FORCED_LOGOUT_EVENT, ApiError } from "../utils/api";

function dispatchForcedLogoutForUnauthorized(error: unknown): void {
  if (!(error instanceof ApiError) || error.status !== 401) {
    return;
  }

  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(AUTH_FORCED_LOGOUT_EVENT, {
      detail: { reason: "unauthorized" },
    }),
  );
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      dispatchForcedLogoutForUnauthorized(error);
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      dispatchForcedLogoutForUnauthorized(error);
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
