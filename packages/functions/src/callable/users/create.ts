import { onCall, HttpsError } from "firebase-functions/v2/https";
import crypto from "node:crypto";
import type { Role } from "@school-app/shared";
import { authenticateRequest, assertHasCap, assertHasScopes } from "../../authz/middleware.js";
import { writeAudit } from "../../audit/writeAudit.js";
import { getDirectoryClient } from "../../google/directoryClient.js";
import { ALLOWED_DOMAIN } from "../../auth/onUserCreate.js";

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

const REQUIRED_SCOPES = [
  "https://www.googleapis.com/auth/admin.directory.user",
] as const;

function readHeader(request: any, key: string): string | undefined {
  const raw =
    request.rawRequest?.headers?.[key] ?? request.rawRequest?.headers?.[key.toLowerCase()];
  return Array.isArray(raw) ? raw[0] : raw;
}

export const usersCreate = onCall(
  { region: "asia-northeast3", cors: true },
  async (request): Promise<UsersCreateResponse> => {
    const requestId = readHeader(request, "x-request-id") ?? crypto.randomUUID();
    const data = request.data as Partial<UsersCreateRequest> | undefined;
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
        action: "users.write",
        target: targetEmail,
        request_id: requestId,
        result: "denied",
        message: (err as Error).message,
      });
      throw err;
    }

    try {
      assertHasCap(user, "users.write");
      assertHasScopes(user, REQUIRED_SCOPES);
    } catch (err) {
      await writeAudit({
        actor: user.email,
        role: user.role,
        action: "users.write",
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

      const {
        primaryEmail,
        givenName,
        familyName,
        password,
        orgUnitPath = "/",
        changePasswordAtNextLogin = true,
      } = data;

      if (!primaryEmail || typeof primaryEmail !== "string") {
        throw new HttpsError("invalid-argument", "email_required");
      }

      const trimmedEmail = primaryEmail.trim();
      const domain = trimmedEmail.split("@")[1];
      if (domain !== ALLOWED_DOMAIN) {
        throw new HttpsError("invalid-argument", "invalid_email_domain");
      }

      if (!givenName || typeof givenName !== "string" || !givenName.trim()) {
        throw new HttpsError("invalid-argument", "given_name_required");
      }

      if (!familyName || typeof familyName !== "string" || !familyName.trim()) {
        throw new HttpsError("invalid-argument", "family_name_required");
      }

      if (!password || typeof password !== "string" || password.length < 8) {
        throw new HttpsError("invalid-argument", "password_too_short");
      }

      const formattedOrgUnit =
        typeof orgUnitPath === "string" && orgUnitPath.trim()
          ? (orgUnitPath.trim().startsWith("/") ? orgUnitPath.trim() : "/" + orgUnitPath.trim())
          : "/";

      const directory = getDirectoryClient(user.googleAccessToken);
      const res = await directory.users.insert({
        requestBody: {
          primaryEmail: trimmedEmail,
          name: {
            givenName: givenName.trim(),
            familyName: familyName.trim(),
          },
          password,
          orgUnitPath: formattedOrgUnit,
          changePasswordAtNextLogin: Boolean(changePasswordAtNextLogin),
        },
      });

      const uid = (res.data?.id as string) ?? "";

      await writeAudit({
        actor: user.email,
        role: user.role,
        action: "users.write",
        target: trimmedEmail,
        request_id: requestId,
        result: "ok",
        message: "created user",
      });

      return {
        primaryEmail: trimmedEmail,
        uid,
      };
    } catch (err) {
      await writeAudit({
        actor: user.email,
        role: user.role,
        action: "users.write",
        target: targetEmail,
        request_id: requestId,
        result: "error",
        message: (err as Error).message,
      });

      if (err instanceof HttpsError) {
        throw err;
      }
      throw new HttpsError("unknown", (err as Error).message);
    }
  }
);
