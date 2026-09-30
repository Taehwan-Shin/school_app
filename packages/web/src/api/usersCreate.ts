import { useMutation, useQueryClient } from "@tanstack/react-query";
import { callCallable } from "./callCallable";

export interface UsersCreateRequest {
  primaryEmail: string;
  givenName: string;
  familyName: string;
  password: string;
  orgUnitPath?: string;
  changePasswordAtNextLogin?: boolean;
}

export interface UsersCreateResponse {
  primaryEmail: string;
  uid: string;
}

export async function callUsersCreate(data: UsersCreateRequest): Promise<UsersCreateResponse> {
  return callCallable<UsersCreateRequest, UsersCreateResponse>(
    "usersCreate",
    data,
    { scopes: "https://www.googleapis.com/auth/admin.directory.user" },
  );
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation<UsersCreateResponse, Error, UsersCreateRequest>({
    mutationFn: (data) => callUsersCreate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users", "list"] });
    },
  });
}
