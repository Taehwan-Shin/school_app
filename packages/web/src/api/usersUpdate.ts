import { useMutation, useQueryClient } from "@tanstack/react-query";
import { callCallable } from "./callCallable";

export interface UsersUpdateRequest {
  primaryEmail: string;
  firstName?: string;
  lastName?: string;
  orgUnitPath?: string;
  suspended?: boolean;
}

export interface UsersUpdateResponse {
  primaryEmail: string;
  updatedFields: string[];
}

export async function callUsersUpdate(data: UsersUpdateRequest): Promise<UsersUpdateResponse> {
  return callCallable<UsersUpdateRequest, UsersUpdateResponse>(
    "usersUpdate",
    data,
    { scopes: "https://www.googleapis.com/auth/admin.directory.user" },
  );
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation<UsersUpdateResponse, Error, UsersUpdateRequest>({
    mutationFn: (data) => callUsersUpdate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users", "list"] });
    },
  });
}
