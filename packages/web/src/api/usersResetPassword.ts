import { useMutation } from "@tanstack/react-query";
import { callCallable } from "./callCallable";

export interface UsersResetPasswordRequest {
  primaryEmail: string;
  newPassword: string;
  changePasswordAtNextLogin?: boolean;
}

export interface UsersResetPasswordResponse {
  primaryEmail: string;
  passwordReset: true;
}

export async function callUsersResetPassword(
  data: UsersResetPasswordRequest
): Promise<UsersResetPasswordResponse> {
  return callCallable<UsersResetPasswordRequest, UsersResetPasswordResponse>(
    "usersResetPassword",
    data,
    { scopes: "https://www.googleapis.com/auth/admin.directory.user.security" },
  );
}

export function useResetPassword() {
  return useMutation<UsersResetPasswordResponse, Error, UsersResetPasswordRequest>({
    mutationFn: (data) => callUsersResetPassword(data),
    // 성공 후 users list 다시 불러올 필요 없음 (사용자 필드 안 바뀜)
  });
}
