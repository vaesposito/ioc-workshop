import { useQuery } from "@tanstack/react-query";
import { fetchAuthMe } from "../../utils/api";
import { queryKeys } from "../keys";

export function useAuthMeQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.auth.me(),
    queryFn: fetchAuthMe,
    enabled,
  });
}
