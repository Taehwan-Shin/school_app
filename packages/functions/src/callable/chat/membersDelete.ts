import { onCall, HttpsError } from 'firebase-functions/v2/https';
import crypto from 'node:crypto';
import type { Role } from '@school-app/shared';
import { authenticateRequest, assertHasCap, assertHasScopes } from '../../authz/middleware.js';
import { writeAudit } from '../../audit/writeAudit.js';
import { getChatClient } from '../../google/chatClient.js';

export interface ChatMembersDeleteRequest {
  memberName: string;
}

export interface ChatMembersDeleteResponse {
  ok: true;
}

const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/chat.memberships',
] as const;

const MEMBER_NAME_RE = /^spaces\/[A-Za-z0-9_-]+\/members\/[A-Za-z0-9_-]+$/;

function mapUpstreamError(err: unknown): HttpsError {
  if (err instanceof HttpsError) return err;
  const status: number | undefined =
    (err as any)?.response?.status ??
    (typeof (err as any)?.code === 'number' ? (err as any).code : undefined);
  const msg = (err as Error).message ?? 'unknown';
  if (status === 401 || status === 403) {
    return new HttpsError('permission-denied', `google_upstream_denied: ${msg}`);
  }
  if (status === 404) {
    return new HttpsError('not-found', `google_upstream_not_found: ${msg}`);
  }
  if (status === 429 || (typeof status === 'number' && status >= 500 && status < 600)) {
    return new HttpsError('unavailable', `google_upstream_unavailable: ${msg}`);
  }
  return new HttpsError('unknown', msg);
}

function readHeader(request: any, key: string): string | undefined {
  const raw =
    request.rawRequest?.headers?.[key] ?? request.rawRequest?.headers?.[key.toLowerCase()];
  return Array.isArray(raw) ? raw[0] : raw;
}

export const chatMembersDelete = onCall(
  { region: 'asia-northeast3', cors: true },
  async (request): Promise<ChatMembersDeleteResponse> => {
    const requestId = readHeader(request, 'x-request-id') ?? crypto.randomUUID();
    const data = request.data as Partial<ChatMembersDeleteRequest> | undefined;
    const target =
      typeof data?.memberName === 'string' && data.memberName.trim()
        ? data.memberName.trim()
        : '*';

    let user;
    try {
      user = await authenticateRequest(request);
    } catch (err) {
      const actorEmail = (request.auth?.token?.email as string | undefined) ?? 'unknown';
      const claimRole = request.auth?.token?.role;
      const actorRole: Role | 'unknown' =
        claimRole === 'super_admin' || claimRole === 'admin' || claimRole === 'teacher'
          ? (claimRole as Role)
          : 'unknown';
      await writeAudit({
        actor: actorEmail,
        role: actorRole,
        action: 'chat.members.delete',
        target,
        request_id: requestId,
        result: 'denied',
        message: (err as Error).message,
      });
      throw err;
    }

    try {
      assertHasCap(user, 'chat.write');
      assertHasScopes(user, REQUIRED_SCOPES);
    } catch (err) {
      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'chat.members.delete',
        target,
        request_id: requestId,
        result: 'denied',
        message: (err as Error).message,
      });
      throw err;
    }

    try {
      if (
        !data?.memberName ||
        typeof data.memberName !== 'string' ||
        !MEMBER_NAME_RE.test(data.memberName.trim())
      ) {
        throw new HttpsError('invalid-argument', 'invalid_member_name');
      }

      const memberName = data.memberName.trim();
      const chat = getChatClient(user.googleAccessToken);
      await chat.spaces.members.delete({ name: memberName });

      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'chat.members.delete',
        target: memberName,
        request_id: requestId,
        result: 'ok',
        message: memberName,
      });

      return { ok: true };
    } catch (err) {
      const mapped = mapUpstreamError(err);
      const isDenied =
        mapped.code === 'permission-denied' || mapped.code === 'failed-precondition';

      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'chat.members.delete',
        target,
        request_id: requestId,
        result: isDenied ? 'denied' : 'error',
        message: mapped.message,
      });

      throw mapped;
    }
  },
);
