import { onCall, HttpsError } from "firebase-functions/v2/https";
import crypto from "node:crypto";
import { getFirestore } from "firebase-admin/firestore";
import type { Role } from "@school-app/shared";
import { authenticateRequest, assertHasCap, assertHasScopes } from "../../authz/middleware.js";
import { writeAudit } from "../../audit/writeAudit.js";
import { getDirectoryClient } from "../../google/directoryClient.js";
import { ALLOWED_DOMAIN } from "../../auth/onUserCreate.js";

export interface UsersResetPasswordRequest {
  primaryEmail: string;
  newPassword: string;
  changePasswordAtNextLogin?: boolean;
}

export interface UsersResetPasswordResponse {
  primaryEmail: string;
  passwordReset: true;
}

const REQUIRED_SCOPES = [
  "https://www.googleapis.com/auth/admin.directory.user.security",
] as const;

function readHeader(request: any, key: string): string | undefined {
  const raw =
    request.rawRequest?.headers?.[key] ?? request.rawRequest?.headers?.[key.toLowerCase()];
  return Array.isArray(raw) ? raw[0] : raw;
}

export const usersResetPassword = onCall(
  { region: "asia-northeast3", cors: true },
  async (request): Promise<UsersResetPasswordResponse> => {
    const requestId = readHeader(request, "x-request-id") ?? crypto.randomUUID();
    const data = request.data as Partial<UsersResetPasswordRequest> | undefined;
    const targetEmail = typeof data?.primaryEmail === "string" ? data.primaryEmail.trim() : "*";

    let user;
    try {
      user = await authenticateRequest(request);
    } catch (err) {
      const actorEmail = (request.auth?.token?.email as string | undefined) ?? "unknown";
      const claimRole = request.auth?.token?.role;
      const actorRole: Role | "unknown" =
        claimRole === "super_admin" || claimRole === "admin" || claimRole === "teacher"
          ? (claimRole as Role)
          : "unknown";
      await writeAudit({
        actor: actorEmail,
        role: actorRole,
        action: "users.reset_password",
        target: targetEmail,
        request_id: requestId,
        result: "denied",
        message: (err as Error).message,
      });
      throw err;
    }

    try {
      assertHasCap(user, "users.reset_password");
      assertHasScopes(user, REQUIRED_SCOPES);
    } catch (err) {
      await writeAudit({
        actor: user.email,
        role: user.role,
        action: "users.reset_password",
        target: targetEmail,
        request_id: requestId,
        result: "denied",
        message: (err as Error).message,
      });
      throw err;
    }

    try {
      if (!data) {
        throw new HttpsError("invalid-argument", "missing_request_data");
      }

      const { primaryEmail, newPassword, changePasswordAtNextLogin = true } = data;

      if (!primaryEmail || typeof primaryEmail !== "string") {
        throw new HttpsError("invalid-argument", "email_required");
      }

      const trimmedEmail = primaryEmail.trim();
      const domain = trimmedEmail.split("@")[1];
      if (domain !== ALLOWED_DOMAIN) {
        throw new HttpsError("invalid-argument", "invalid_email_domain");
      }

      if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
        throw new HttpsError("invalid-argument", "password_too_short");
      }

      const change = changePasswordAtNextLogin !== undefined ? Boolean(changePasswordAtNextLogin) : true;

      const directory = getDirectoryClient(user.googleAccessToken);

      const isSelf = user.email.toLowerCase() === trimmedEmail.toLowerCase();
      if (!isSelf && user.role !== "super_admin") {
        const db = getFirestore();
        const [appRoleSnap, workspaceUser] = await Promise.all([
          db.collection("users").where("email", "==", trimmedEmail).limit(1).get(),
          directory.users.get({ userKey: trimmedEmail }),
        ]);

        const appRoleIsSuperAdmin =
          !appRoleSnap.empty && appRoleSnap.docs[0].data()?.role === "super_admin";
        const isWorkspaceAdmin = workspaceUser.data?.isAdmin === true;

        if (appRoleIsSuperAdmin || isWorkspaceAdmin) {
          throw new HttpsError("permission-denied", "admin_cannot_edit_admin");
        }
      }

      const updater = (directory.users as any).update
        ? (directory.users as any).update.bind(directory.users)
        : directory.users.patch.bind(directory.users);

      await updater({
        userKey: trimmedEmail,
        requestBody: {
          password: newPassword,
          changePasswordAtNextLogin: change,
        },
      });

      await writeAudit({
        actor: user.email,
        role: user.role,
        action: "users.reset_password",
        target: trimmedEmail,
        request_id: requestId,
        result: "ok",
        message: `password reset (changeOnNextLogin: ${change})`,
      });

      return {
        primaryEmail: trimmedEmail,
        passwordReset: true,
      };
    } catch (err) {
      const isDenied =
        err instanceof HttpsError &&
        (err.code === "permission-denied" || err.code === "failed-precondition");

      await writeAudit({
        actor: user.email,
        role: user.role,
        action: "users.reset_password",
        target: targetEmail,
        request_id: requestId,
        result: isDenied ? "denied" : "error",
        message: (err as Error).message,
      });

      if (err instanceof HttpsError) {
        throw err;
      }
      throw new HttpsError("unknown", (err as Error).message);
    }
  }
);
