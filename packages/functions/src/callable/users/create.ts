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

// v0.132b F106 (== v0.121b F98 대칭): Directory users.insert 성공 뒤 감사
// 쓰기가 실패해도 이미 생성된 계정 상태를 client 에 반환해야 재시도 409/duplicate
// 를 피할 수 있다. 3회 재시도 + Cloud Logging fallback + throw 안 함.
type AuditEntry = Parameters<typeof writeAudit>[0];
async function writeAuditWithBackup(entry: AuditEntry, requestId: string): Promise<void> {
  const maxAttempts = 3;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await writeAudit(entry);
      return;
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
      }
    }
  }
  console.error(
    JSON.stringify({
      severity: "ERROR",
      message: "users_create_audit_write_failed",
      request_id: requestId,
      audit_entry: entry,
      final_error: (lastErr as Error)?.message ?? String(lastErr),
    }),
  );
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

    // v0.132b F106: 입력 검증 · Directory 호출까지는 실패 시 감사 후 throw.
    // 성공 후 audit 실패는 non-throwing 으로 격리 (F98/orgunitsCreate 대칭).
    let trimmedEmail = "";
    let givenName = "";
    let familyName = "";
    let password = "";
    let formattedOrgUnit = "/";
    let changePasswordAtNextLogin = true;

    try {
      if (!data) {
        throw new HttpsError("invalid-argument", "missing_request_data");
      }

      const {
        primaryEmail,
        givenName: givenNameRaw,
        familyName: familyNameRaw,
        password: passwordRaw,
        orgUnitPath = "/",
        changePasswordAtNextLogin: changePwRaw = true,
      } = data;

      if (!primaryEmail || typeof primaryEmail !== "string") {
        throw new HttpsError("invalid-argument", "email_required");
      }

      trimmedEmail = primaryEmail.trim();
      const domain = trimmedEmail.split("@")[1];
      if (domain !== ALLOWED_DOMAIN) {
        throw new HttpsError("invalid-argument", "invalid_email_domain");
      }

      if (!givenNameRaw || typeof givenNameRaw !== "string" || !givenNameRaw.trim()) {
        throw new HttpsError("invalid-argument", "given_name_required");
      }
      givenName = givenNameRaw.trim();

      if (!familyNameRaw || typeof familyNameRaw !== "string" || !familyNameRaw.trim()) {
        throw new HttpsError("invalid-argument", "family_name_required");
      }
      familyName = familyNameRaw.trim();

      if (!passwordRaw || typeof passwordRaw !== "string" || passwordRaw.length < 8) {
        throw new HttpsError("invalid-argument", "password_too_short");
      }
      password = passwordRaw;

      formattedOrgUnit =
        typeof orgUnitPath === "string" && orgUnitPath.trim()
          ? (orgUnitPath.trim().startsWith("/") ? orgUnitPath.trim() : "/" + orgUnitPath.trim())
          : "/";
      changePasswordAtNextLogin = Boolean(changePwRaw);
    } catch (err) {
      // v0.132c F110: validation 실패는 result="error" (기존 계약 · roles.md 66-76:
      // 세 서버 게이트 [permission-denied, unauthenticated, failed-precondition] 만
      // denied). usersUpdate/resetPassword 도 동일 분류.
      await writeAudit({
        actor: user.email,
        role: user.role,
        action: "users.write",
        target: targetEmail,
        request_id: requestId,
        result: "error",
        message: (err as Error).message,
      });
      if (err instanceof HttpsError) throw err;
      throw new HttpsError("unknown", (err as Error).message);
    }

    let res: Awaited<ReturnType<ReturnType<typeof getDirectoryClient>["users"]["insert"]>>;
    try {
      const directory = getDirectoryClient(user.googleAccessToken);
      res = await directory.users.insert({
        requestBody: {
          primaryEmail: trimmedEmail,
          name: { givenName, familyName },
          password,
          orgUnitPath: formattedOrgUnit,
          changePasswordAtNextLogin,
        },
      });
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
      if (err instanceof HttpsError) throw err;
      throw new HttpsError("unknown", (err as Error).message);
    }

    const uid = (res.data?.id as string) ?? "";

    // F106: Directory insert 이 이미 성공 — audit 실패해도 client 는 성공 응답을
    // 받아야 재시도 시 중복 충돌을 피한다. writeAuditWithBackup 은 throw 안 함.
    await writeAuditWithBackup(
      {
        actor: user.email,
        role: user.role,
        action: "users.write",
        target: trimmedEmail,
        request_id: requestId,
        result: "ok",
        message: "created user",
      },
      requestId,
    );

    return {
      primaryEmail: trimmedEmail,
      uid,
    };
  }
);
