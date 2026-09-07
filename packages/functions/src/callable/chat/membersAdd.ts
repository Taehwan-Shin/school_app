import { onCall, HttpsError } from 'firebase-functions/v2/https';
import crypto from 'node:crypto';
import type { Role } from '@school-app/shared';
import { authenticateRequest, assertHasCap, assertHasScopes } from '../../authz/middleware.js';
import { writeAudit } from '../../audit/writeAudit.js';
import { getChatClient, type ChatMember } from '../../google/chatClient.js';
import { getDirectoryClient } from '../../google/directoryClient.js';

export interface ChatMembersAddRequest {
  spaceName: string;
  email: string;
}

export interface ChatMembersAddResponse {
  member: ChatMember;
}

const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/chat.memberships',
  'https://www.googleapis.com/auth/admin.directory.user.readonly',
] as const;

const SPACE_NAME_RE = /^spaces\/[A-Za-z0-9_-]+$/;
const EMAIL_RE = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;

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

export const chatMembersAdd = onCall(
  { region: 'asia-northeast3', cors: true },
  async (request): Promise<ChatMembersAddResponse> => {
    const requestId = readHeader(request, 'x-request-id') ?? crypto.randomUUID();
    const data = request.data as Partial<ChatMembersAddRequest> | undefined;

    const spaceNamePart =
      typeof data?.spaceName === 'string' && data.spaceName.trim() ? data.spaceName.trim() : '*';
    const emailPart =
      typeof data?.email === 'string' && data.email.trim() ? data.email.trim() : '*';
    let target =
      spaceNamePart === '*' && emailPart === '*'
        ? '*'
        : `${spaceNamePart}/members/${emailPart}`;

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
        action: 'chat.members.add',
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
        action: 'chat.members.add',
        target,
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
      if (
        !data?.email ||
        typeof data.email !== 'string' ||
        !EMAIL_RE.test(data.email.trim())
      ) {
        throw new HttpsError('invalid-argument', 'invalid_email');
      }

      const spaceName = data.spaceName.trim();
      const email = data.email.trim();

      const directory = getDirectoryClient(user.googleAccessToken);
      let userId: string;
      try {
        const dirRes = await directory.users.get({ userKey: email });
        if (!dirRes.data?.id) {
          throw new HttpsError('not-found', 'directory_user_not_found');
        }
        userId = dirRes.data.id;
      } catch (dirErr) {
        if (dirErr instanceof HttpsError) {
          throw dirErr;
        }
        const status: number | undefined =
          (dirErr as any)?.response?.status ??
          (typeof (dirErr as any)?.code === 'number' ? (dirErr as any).code : undefined);
        if (status === 404) {
          throw new HttpsError('not-found', 'directory_user_not_found');
        }
        throw dirErr;
      }

      target = `${spaceName}/members/${userId}`;

      const chat = getChatClient(user.googleAccessToken);
      const res = await chat.spaces.members.create({
        parent: spaceName,
        requestBody: {
          member: {
            name: `users/${userId}`,
            type: 'HUMAN',
          },
        },
      });

      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'chat.members.add',
        target,
        request_id: requestId,
        result: 'ok',
        message: `email=${email}`,
      });

      return { member: res.data };
    } catch (err) {
      const mapped = mapUpstreamError(err);
      const isDenied =
        mapped.code === 'permission-denied' || mapped.code === 'failed-precondition';

      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'chat.members.add',
        target,
        request_id: requestId,
        result: isDenied ? 'denied' : 'error',
        message: mapped.message,
      });

      throw mapped;
    }
  },
);
