import { onCall, HttpsError } from 'firebase-functions/v2/https';
import crypto from 'node:crypto';
import type { Role } from '@school-app/shared';
import { authenticateRequest, assertHasCap, assertHasScopes } from '../../authz/middleware.js';
import { writeAudit } from '../../audit/writeAudit.js';
import { getDirectoryClient } from '../../google/directoryClient.js';
import { ALLOWED_DOMAIN } from '../../auth/onUserCreate.js';

export interface GroupsUpdateRequest {
  email: string;
  name?: string;
  description?: string;
}

export interface GroupsUpdateResponse {
  email: string;
  updatedFields: string[];
}

const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/admin.directory.group',
] as const;

function readHeader(request: any, key: string): string | undefined {
  const raw =
    request.rawRequest?.headers?.[key] ?? request.rawRequest?.headers?.[key.toLowerCase()];
  return Array.isArray(raw) ? raw[0] : raw;
}

export const groupsUpdate = onCall(
  { region: 'asia-northeast3', cors: true },
  async (request): Promise<GroupsUpdateResponse> => {
    const requestId = readHeader(request, 'x-request-id') ?? crypto.randomUUID();
    const data = request.data as Partial<GroupsUpdateRequest> | undefined;
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

      const requestBody: any = {};
      const updatedFields: string[] = [];

      if (typeof name === 'string' && name.trim()) {
        requestBody.name = name.trim();
        updatedFields.push('name');
      }

      if (typeof description === 'string') {
        requestBody.description = description.trim();
        updatedFields.push('description');
      }

      if (updatedFields.length === 0) {
        throw new HttpsError('invalid-argument', 'no_fields_to_update');
      }

      const directory = getDirectoryClient(user.googleAccessToken);
      const before = await directory.groups.get({ groupKey: trimmedEmail });

      await directory.groups.patch({
        groupKey: trimmedEmail,
        requestBody,
      });

      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'groups.write',
        target: trimmedEmail,
        request_id: requestId,
        result: 'ok',
        message: `updated fields: ${updatedFields.join(', ')} | before: ${JSON.stringify({
          name: before.data?.name,
          description: before.data?.description,
        })} | after: ${JSON.stringify(requestBody)}`,
      });

      return {
        email: trimmedEmail,
        updatedFields,
      };
    } catch (err) {
      const isDenied =
        err instanceof HttpsError &&
        (err.code === 'permission-denied' || err.code === 'failed-precondition');

      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'groups.write',
        target: targetEmail,
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
