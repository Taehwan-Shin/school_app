import { useMutation, useQueryClient } from "@tanstack/react-query";
import { callCallable } from "./callCallable";

export interface GroupsDeleteRequest {
  email: string;
}

export interface GroupsDeleteResponse {
  email: string;
  deleted: true;
}

export async function callGroupsDelete(data: GroupsDeleteRequest): Promise<GroupsDeleteResponse> {
  return callCallable<GroupsDeleteRequest, GroupsDeleteResponse>(
    "groupsDelete",
    data,
    { scopes: "https://www.googleapis.com/auth/admin.directory.group" },
  );
}

export function useDeleteGroup() {
  const queryClient = useQueryClient();
  return useMutation<GroupsDeleteResponse, Error, GroupsDeleteRequest>({
    mutationFn: (data) => callGroupsDelete(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups", "list"] });
    },
  });
}
