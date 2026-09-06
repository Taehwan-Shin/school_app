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
        !data.spaceName.trim().startsWith('spaces/')
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
      const isDenied =
        err instanceof HttpsError &&
        (err.code === 'permission-denied' || err.code === 'failed-precondition');

      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'chat.read',
        target: targetName,
        request_id: requestId,
        result: isDenied ? 'denied' : 'error',
        message: (err as Error).message,
      });

      if (err instanceof HttpsError) {
        throw err;
      }
      throw new HttpsError('unknown', (err as Error).message);
    }
  },
);
