import { useMutation, useQueryClient } from "@tanstack/react-query";
import { auth } from "../lib/firebase";
import { getGoogleAccessTokenFromSession } from "../lib/auth";

export interface UsersUpdateRequest {
  primaryEmail: string;
  firstName?: string;
  lastName?: string;
  orgUnitPath?: string;
}

export interface UsersUpdateResponse {
  primaryEmail: string;
  updatedFields: string[];
}

export async function callUsersUpdate(data: UsersUpdateRequest): Promise<UsersUpdateResponse> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("not_authenticated");
  }
  const idToken = await user.getIdToken();
  const googleAccessToken = getGoogleAccessTokenFromSession() || "";

  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || "school-app-5a636";
  // 프로덕션: Cloud Functions 직접 URL. Firebase Hosting rewrite 는 커스텀 헤더 (X-Google-Access-Token) 를 서버까지 전달하지 못하는 경우가 있어 함수 URL 로 직접 호출.
  const url = import.meta.env.DEV
    ? `http://127.0.0.1:5001/${projectId}/asia-northeast3/usersUpdate`
    : `https://asia-northeast3-${projectId}.cloudfunctions.net/usersUpdate`;

  const requestId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
      "X-Google-Access-Token": googleAccessToken,
      "X-Google-Scopes": "https://www.googleapis.com/auth/admin.directory.user",
      "X-Request-Id": requestId,
    },
    body: JSON.stringify({ data }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = body.error?.message ?? `http_${res.status}`;
    const err = new Error(message) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  const body = await res.json();
  return (body.result ?? body) as UsersUpdateResponse;
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
