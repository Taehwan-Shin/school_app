import { onCall, HttpsError } from 'firebase-functions/v2/https';
import crypto from 'node:crypto';
import type { Role } from '@school-app/shared';
import { authenticateRequest, assertHasCap, assertHasScopes } from '../../authz/middleware.js';
import { writeAudit } from '../../audit/writeAudit.js';
import { getDirectoryClient } from '../../google/directoryClient.js';
import { ALLOWED_DOMAIN } from '../../auth/onUserCreate.js';

export interface GroupsCreateRequest {
  email: string;
  name: string;
  description?: string;
}

export interface GroupsCreateResponse {
  email: string;
  id: string;
}

const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/admin.directory.group',
] as const;

function readHeader(request: any, key: string): string | undefined {
  const raw =
    request.rawRequest?.headers?.[key] ?? request.rawRequest?.headers?.[key.toLowerCase()];
  return Array.isArray(raw) ? raw[0] : raw;
}

export const groupsCreate = onCall(
  { region: 'asia-northeast3', cors: true },
  async (request): Promise<GroupsCreateResponse> => {
    const requestId = readHeader(request, 'x-request-id') ?? crypto.randomUUID();
    const data = request.data as Partial<GroupsCreateRequest> | undefined;
    const targetEmail =
      typeof data?.email === 'string' && data.email.trim() ? data.email.trim() : '*';

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
        action: 'groups.write',
        target: targetEmail,
        request_id: requestId,
        result: 'denied',
        message: (err as Error).message,
      });
      throw err;
    }

    try {
      assertHasCap(user, 'groups.write');
      assertHasScopes(user, REQUIRED_SCOPES);
    } catch (err) {
      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'groups.write',
        target: targetEmail,
        request_id: requestId,
        result: 'denied',
        message: (err as Error).message,
      });
      throw err;
    }

    try {
      if (!data) {
        throw new HttpsError('invalid-argument', 'missing_request_data');
      }

      const { email, name, description } = data;

      if (!email || typeof email !== 'string') {
        throw new HttpsError('invalid-argument', 'email_required');
      }

      const trimmedEmail = email.trim();
      const domain = trimmedEmail.split('@')[1];
      if (domain !== ALLOWED_DOMAIN) {
        throw new HttpsError('invalid-argument', 'invalid_email_domain');
      }

      if (!name || typeof name !== 'string' || !name.trim()) {
        throw new HttpsError('invalid-argument', 'name_required');
      }

      const directory = getDirectoryClient(user.googleAccessToken);
      const res = await directory.groups.insert({
        requestBody: {
          email: trimmedEmail,
          name: name.trim(),
          ...(typeof description === 'string' && description.trim()
            ? { description: description.trim() }
            : {}),
        },
      });

      const id = (res.data?.id as string) ?? '';

      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'groups.write',
        target: trimmedEmail,
        request_id: requestId,
        result: 'ok',
        message: 'created group',
      });

      return {
        email: trimmedEmail,
        id,
      };
    } catch (err) {
      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'groups.write',
        target: targetEmail,
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
