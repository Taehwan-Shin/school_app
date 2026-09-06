import { onCall, HttpsError } from 'firebase-functions/v2/https';
import crypto from 'node:crypto';
import type { Role } from '@school-app/shared';
import { authenticateRequest, assertHasCap, assertHasScopes } from '../../authz/middleware.js';
import { writeAudit } from '../../audit/writeAudit.js';
import { getChatClient, type ChatSpace } from '../../google/chatClient.js';

export interface ChatListRequest {}

export interface ChatListResponse {
  spaces: ChatSpace[];
}

const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/chat.spaces',
] as const;

function readHeader(request: any, key: string): string | undefined {
  const raw =
    request.rawRequest?.headers?.[key] ?? request.rawRequest?.headers?.[key.toLowerCase()];
  return Array.isArray(raw) ? raw[0] : raw;
}

export const chatList = onCall(
  { region: 'asia-northeast3', cors: true },
  async (request): Promise<ChatListResponse> => {
    const requestId = readHeader(request, 'x-request-id') ?? crypto.randomUUID();

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
        target: '*',
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
        target: '*',
        request_id: requestId,
        result: 'denied',
        message: (err as Error).message,
      });
      throw err;
    }

    try {
      const chat = getChatClient(user.googleAccessToken);
      const results: ChatSpace[] = [];
      let pageToken: string | undefined;

      do {
        const res = await chat.spaces.list({ pageSize: 100, pageToken });
        results.push(...(res.data.spaces ?? []));
        pageToken = res.data.nextPageToken ?? undefined;
      } while (pageToken);

      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'chat.read',
        target: '*',
        request_id: requestId,
        result: 'ok',
        message: `listed ${results.length} chat spaces`,
      });

      return { spaces: results };
    } catch (err) {
      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'chat.read',
        target: '*',
        request_id: requestId,
        result: 'error',
        message: (err as Error).message,
      });
      if (err instanceof HttpsError) {
        throw err;
      }
      throw new HttpsError('unknown', (err as Error).message);
    }
  },
);
