import { onCall, HttpsError } from 'firebase-functions/v2/https';
import crypto from 'node:crypto';
import type { Role } from '@school-app/shared';
import { authenticateRequest, assertHasCap, assertHasScopes } from '../../authz/middleware.js';
import { writeAudit } from '../../audit/writeAudit.js';
import { getChatClient } from '../../google/chatClient.js';

export interface ChatDeleteRequest {
  name: string;
}

export interface ChatDeleteResponse {
  deleted: true;
  name: string;
}

const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/chat.spaces',
] as const;

function readHeader(request: any, key: string): string | undefined {
  const raw =
    request.rawRequest?.headers?.[key] ?? request.rawRequest?.headers?.[key.toLowerCase()];
  return Array.isArray(raw) ? raw[0] : raw;
}

export const chatDelete = onCall(
  { region: 'asia-northeast3', cors: true },
  async (request): Promise<ChatDeleteResponse> => {
    const requestId = readHeader(request, 'x-request-id') ?? crypto.randomUUID();
    const data = request.data as Partial<ChatDeleteRequest> | undefined;
    const targetName =
      typeof data?.name === 'string' && data.name.trim() ? data.name.trim() : '*';

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
        action: 'chat.delete',
        target: targetName,
        request_id: requestId,
        result: 'denied',
        message: (err as Error).message,
      });
      throw err;
    }

    try {
      assertHasCap(user, 'chat.delete');
      assertHasScopes(user, REQUIRED_SCOPES);
    } catch (err) {
      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'chat.delete',
        target: targetName,
        request_id: requestId,
        result: 'denied',
        message: (err as Error).message,
      });
      throw err;
    }

    try {
      if (!data?.name || typeof data.name !== 'string' || !data.name.trim().startsWith('spaces/')) {
        throw new HttpsError('invalid-argument', 'invalid_space_name');
      }
      const name = data.name.trim();

      const chat = getChatClient(user.googleAccessToken);
      await chat.spaces.delete({ name });

      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'chat.delete',
        target: name,
        request_id: requestId,
        result: 'ok',
        message: `deleted chat space ${name}`,
      });

      return { deleted: true, name };
    } catch (err) {
      const isDenied =
        err instanceof HttpsError &&
        (err.code === 'permission-denied' || err.code === 'failed-precondition');

      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'chat.delete',
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
