import { useMutation, useQueryClient } from "@tanstack/react-query";
import { callCallable } from "./callCallable";

export interface UsersDeleteRequest {
  primaryEmail: string;
}

export interface UsersDeleteResponse {
  primaryEmail: string;
  deleted: true;
}

export async function callUsersDelete(data: UsersDeleteRequest): Promise<UsersDeleteResponse> {
  return callCallable<UsersDeleteRequest, UsersDeleteResponse>(
    "usersDelete",
    data,
    { scopes: "https://www.googleapis.com/auth/admin.directory.user" },
  );
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation<UsersDeleteResponse, Error, UsersDeleteRequest>({
    mutationFn: (data) => callUsersDelete(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users", "list"] });
    },
  });
}
