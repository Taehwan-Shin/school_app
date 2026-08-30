import { onCall, HttpsError } from "firebase-functions/v2/https";
import crypto from "node:crypto";
import type { Role } from "@school-app/shared";
import { authenticateRequest, assertHasCap, assertHasScopes } from "../../authz/middleware.js";
import { writeAudit } from "../../audit/writeAudit.js";
import { getDirectoryClient } from "../../google/directoryClient.js";
import { ALLOWED_DOMAIN } from "../../auth/onUserCreate.js";

export interface UsersDeleteRequest {
  primaryEmail: string;
}

export interface UsersDeleteResponse {
  primaryEmail: string;
  deleted: true;
}

const REQUIRED_SCOPES = [
  "https://www.googleapis.com/auth/admin.directory.user",
] as const;

function readHeader(request: any, key: string): string | undefined {
  const raw =
    request.rawRequest?.headers?.[key] ?? request.rawRequest?.headers?.[key.toLowerCase()];
  return Array.isArray(raw) ? raw[0] : raw;
}

export const usersDelete = onCall(
  { region: "asia-northeast3" },
  async (request): Promise<UsersDeleteResponse> => {
    const requestId = readHeader(request, "x-request-id") ?? crypto.randomUUID();
    const data = request.data as Partial<UsersDeleteRequest> | undefined;
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
        action: "users.delete",
        target: targetEmail,
        request_id: requestId,
        result: "denied",
        message: (err as Error).message,
      });
      throw err;
    }

    try {
      assertHasCap(user, "users.delete");
      assertHasScopes(user, REQUIRED_SCOPES);
    } catch (err) {
      await writeAudit({
        actor: user.email,
        role: user.role,
        action: "users.delete",
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

      const { primaryEmail } = data;

      if (!primaryEmail || typeof primaryEmail !== "string") {
        throw new HttpsError("invalid-argument", "email_required");
      }

      const trimmedEmail = primaryEmail.trim();
      const domain = trimmedEmail.split("@")[1];
      if (domain !== ALLOWED_DOMAIN) {
        throw new HttpsError("invalid-argument", "invalid_email_domain");
      }

      // 1. 본인 삭제 방지
      if (user.email.toLowerCase() === trimmedEmail.toLowerCase()) {
        throw new HttpsError("failed-precondition", "cannot_delete_self");
      }

      const directory = getDirectoryClient(user.googleAccessToken);

      // 2. super_admin / admin 삭제 보호 (admin 은 관리자/super_admin 계정 삭제 불가)
      if (user.role !== "super_admin") {
        const targetUser = await directory.users.get({ userKey: trimmedEmail });
        if (targetUser.data?.isAdmin) {
          throw new HttpsError("permission-denied", "admin_cannot_delete_admin");
        }
      }

      await directory.users.delete({ userKey: trimmedEmail });

      await writeAudit({
        actor: user.email,
        role: user.role,
        action: "users.delete",
        target: trimmedEmail,
        request_id: requestId,
        result: "ok",
        message: "deleted user",
      });

      return {
        primaryEmail: trimmedEmail,
        deleted: true,
      };
    } catch (err) {
      const isDenied =
        err instanceof HttpsError &&
        (err.code === "permission-denied" || err.code === "failed-precondition");

      await writeAudit({
        actor: user.email,
        role: user.role,
        action: "users.delete",
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
