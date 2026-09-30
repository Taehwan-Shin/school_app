import { useMutation, useQueryClient } from "@tanstack/react-query";
import { callCallable } from "./callCallable";

export interface GroupsCreateRequest {
  email: string;
  name: string;
  description?: string;
}

export interface GroupsCreateResponse {
  email: string;
  id: string;
}

export async function callGroupsCreate(data: GroupsCreateRequest): Promise<GroupsCreateResponse> {
  return callCallable<GroupsCreateRequest, GroupsCreateResponse>(
    "groupsCreate",
    data,
    { scopes: "https://www.googleapis.com/auth/admin.directory.group" },
  );
}

export function useCreateGroup() {
  const queryClient = useQueryClient();
  return useMutation<GroupsCreateResponse, Error, GroupsCreateRequest>({
    mutationFn: (data) => callGroupsCreate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups", "list"] });
    },
  });
}
