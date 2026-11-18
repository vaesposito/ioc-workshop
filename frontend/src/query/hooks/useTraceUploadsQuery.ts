import { useMutation, useQueryClient } from "@tanstack/react-query";
import { uploadTraceOnly } from "../../utils/api";
import { queryKeys } from "../keys";

export function useUploadTraceOnlyMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: uploadTraceOnly,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.traces.all(),
      });
    },
  });
}
