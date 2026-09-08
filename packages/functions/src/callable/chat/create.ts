import { onCall, HttpsError } from 'firebase-functions/v2/https';
import crypto from 'node:crypto';
import type { Role } from '@school-app/shared';
import { authenticateRequest, assertHasCap, assertHasScopes } from '../../authz/middleware.js';
import { writeAudit } from '../../audit/writeAudit.js';
import { getChatClient, type ChatSpace } from '../../google/chatClient.js';

export interface ChatCreateRequest {
  displayName: string;
  spaceType?: 'SPACE';
}

export interface ChatCreateResponse {
  space: ChatSpace;
}

const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/chat.spaces',
] as const;

function readHeader(request: any, key: string): string | undefined {
  const raw =
    request.rawRequest?.headers?.[key] ?? request.rawRequest?.headers?.[key.toLowerCase()];
  return Array.isArray(raw) ? raw[0] : raw;
}

export const chatCreate = onCall(
  { region: 'asia-northeast3', cors: true },
  async (request): Promise<ChatCreateResponse> => {
    const requestId = readHeader(request, 'x-request-id') ?? crypto.randomUUID();
    const data = request.data as Partial<ChatCreateRequest> | undefined;
    const requestedDisplayName =
      typeof data?.displayName === 'string' && data.displayName.trim()
        ? data.displayName.trim()
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
        action: 'chat.write',
        target: requestedDisplayName,
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
        action: 'chat.write',
        target: requestedDisplayName,
        request_id: requestId,
        result: 'denied',
        message: (err as Error).message,
      });
      throw err;
    }

    try {
      if (
        !data?.displayName ||
        typeof data.displayName !== 'string' ||
        data.displayName.trim().length === 0
      ) {
        throw new HttpsError('invalid-argument', 'display_name_required');
      }
      const displayName = data.displayName.trim();
      // Google Chat spaces.create displayName 은 128자 제한. bulk 생성 시 긴 반 이름 +
      // courseName prefix 로 초과할 수 있어 서버에서 명시 검증 (v0.97 Codex F12).
      if (displayName.length > 128) {
        throw new HttpsError('invalid-argument', 'display_name_too_long');
      }

      const chat = getChatClient(user.googleAccessToken);
      const res = await chat.spaces.create({
        requestBody: {
          displayName,
          spaceType: 'SPACE',
        },
      });

      const spaceName = res.data.name || '*';

      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'chat.write',
        target: spaceName,
        request_id: requestId,
        result: 'ok',
        message: `created chat space ${res.data.name} (${displayName})`,
      });

      return { space: res.data };
    } catch (err) {
      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'chat.write',
        target: requestedDisplayName,
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
