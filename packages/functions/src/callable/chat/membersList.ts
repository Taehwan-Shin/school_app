import { onCall, HttpsError } from 'firebase-functions/v2/https';
import crypto from 'node:crypto';
import type { Role } from '@school-app/shared';
import { authenticateRequest, assertHasCap, assertHasScopes } from '../../authz/middleware.js';
import { writeAudit } from '../../audit/writeAudit.js';
import { getChatClient, type ChatMember } from '../../google/chatClient.js';

export interface ChatMembersListRequest {
  spaceName: string;
}

export interface ChatMembersListResponse {
  members: ChatMember[];
}

const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/chat.memberships',
] as const;

const SPACE_NAME_RE = /^spaces\/[A-Za-z0-9_-]+$/;

function mapUpstreamError(err: unknown): HttpsError {
  if (err instanceof HttpsError) return err;
  // gaxios has err.response.status; also err.code sometimes numeric
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

export const chatMembersList = onCall(
  { region: 'asia-northeast3', cors: true },
  async (request): Promise<ChatMembersListResponse> => {
    const requestId = readHeader(request, 'x-request-id') ?? crypto.randomUUID();
    const data = request.data as Partial<ChatMembersListRequest> | undefined;
    const targetName =
      typeof data?.spaceName === 'string' && data.spaceName.trim() ? data.spaceName.trim() : '*';

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
        action: 'chat.read',
        target: targetName,
        request_id: requestId,
        result: 'denied',
        message: (err as Error).message,
      });
      throw err;
    }

    try {
      assertHasCap(user, 'chat.read');
      assertHasScopes(user, REQUIRED_SCOPES);
    } catch (err) {
      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'chat.read',
        target: targetName,
        request_id: requestId,
        result: 'denied',
        message: (err as Error).message,
      });
      throw err;
    }

    try {
      if (
        !data?.spaceName ||
        typeof data.spaceName !== 'string' ||
        !SPACE_NAME_RE.test(data.spaceName.trim())
      ) {
        throw new HttpsError('invalid-argument', 'invalid_space_name');
      }
      const spaceName = data.spaceName.trim();

      const chat = getChatClient(user.googleAccessToken);
      const results: ChatMember[] = [];
      let pageToken: string | undefined;
      do {
        const res = await chat.spaces.members.list({
          parent: spaceName,
          pageSize: 100,
          pageToken,
        });
        results.push(...(res.data.memberships ?? []));
        pageToken = res.data.nextPageToken ?? undefined;
      } while (pageToken);

      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'chat.read',
        target: spaceName,
        request_id: requestId,
        result: 'ok',
        message: `listed ${results.length} members for space ${spaceName}`,
      });

      return { members: results };
    } catch (err) {
      const mapped = mapUpstreamError(err);
      const isDenied =
        mapped.code === 'permission-denied' || mapped.code === 'failed-precondition';

      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'chat.read',
        target: targetName,
        request_id: requestId,
        result: isDenied ? 'denied' : 'error',
        message: mapped.message,
      });

      throw mapped;
    }
  },
);
