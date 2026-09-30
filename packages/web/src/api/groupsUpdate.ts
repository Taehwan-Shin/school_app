import { useMutation, useQueryClient } from "@tanstack/react-query";
import { callCallable } from "./callCallable";

export interface GroupsUpdateRequest {
  email: string;
  name?: string;
  description?: string;
}

export interface GroupsUpdateResponse {
  email: string;
  updatedFields: string[];
}

export async function callGroupsUpdate(data: GroupsUpdateRequest): Promise<GroupsUpdateResponse> {
  return callCallable<GroupsUpdateRequest, GroupsUpdateResponse>(
    "groupsUpdate",
    data,
    { scopes: "https://www.googleapis.com/auth/admin.directory.group" },
  );
}

export function useUpdateGroup() {
  const queryClient = useQueryClient();
  return useMutation<GroupsUpdateResponse, Error, GroupsUpdateRequest>({
    mutationFn: (data) => callGroupsUpdate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups", "list"] });
    },
  });
}
