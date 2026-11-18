import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createUser,
  deleteUser,
  fetchUsers,
  updateUserRole,
} from "../../utils/api";
import type { ManagedUser } from "../../utils/api";
import { queryKeys } from "../keys";

export function useUsersQuery() {
  return useQuery({
    queryKey: queryKeys.users.all(),
    queryFn: fetchUsers,
  });
}

export function useCreateUserMutation() {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.users.all();

  return useMutation({
    mutationFn: createUser,
    onSuccess: (created) => {
      queryClient.setQueryData<ManagedUser[]>(queryKey, (prev = []) => [
        created,
        ...prev,
      ]);
    },
  });
}

export function useUpdateUserRoleMutation() {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.users.all();

  return useMutation({
    mutationFn: ({
      email,
      role,
    }: {
      email: string;
      role: "view" | "execute" | "admin";
    }) => updateUserRole(email, role),
    onSuccess: (updated) => {
      queryClient.setQueryData<ManagedUser[]>(queryKey, (prev = []) =>
        prev.map((user) => (user.email === updated.email ? updated : user)),
      );
    },
  });
}

export function useDeleteUserMutation() {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.users.all();

  return useMutation({
    mutationFn: (email: string) => deleteUser(email),
    onSuccess: (_, email) => {
      queryClient.setQueryData<ManagedUser[]>(queryKey, (prev = []) =>
        prev.filter((user) => user.email !== email),
      );
    },
  });
}
