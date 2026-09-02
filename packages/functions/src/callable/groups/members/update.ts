import { onCall, HttpsError } from 'firebase-functions/v2/https';
import crypto from 'node:crypto';
import type { Role } from '@school-app/shared';
import { authenticateRequest, assertHasCap, assertHasScopes } from '../../../authz/middleware.js';
import { writeAudit } from '../../../audit/writeAudit.js';
import { getDirectoryClient } from '../../../google/directoryClient.js';
import { ALLOWED_DOMAIN } from '../../../auth/onUserCreate.js';

export interface GroupsMembersUpdateRequest {
  groupEmail: string;
  memberEmail: string;
  role: 'OWNER' | 'MANAGER' | 'MEMBER';
}

export interface GroupsMembersUpdateResponse {
  groupEmail: string;
  memberEmail: string;
  role: string;
}

const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/admin.directory.group.member',
] as const;

function readHeader(request: any, key: string): string | undefined {
  const raw =
    request.rawRequest?.headers?.[key] ?? request.rawRequest?.headers?.[key.toLowerCase()];
  return Array.isArray(raw) ? raw[0] : raw;
}

export const groupsMembersUpdate = onCall(
  { region: 'asia-northeast3', cors: true },
  async (request): Promise<GroupsMembersUpdateResponse> => {
    const requestId = readHeader(request, 'x-request-id') ?? crypto.randomUUID();
    const data = request.data as Partial<GroupsMembersUpdateRequest> | undefined;
    const targetEmail =
      typeof data?.groupEmail === 'string' && data.groupEmail.trim() ? data.groupEmail.trim() : '*';

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

      const { groupEmail, memberEmail, role } = data;

      if (!groupEmail || typeof groupEmail !== 'string') {
        throw new HttpsError('invalid-argument', 'group_email_required');
      }

      const trimmedGroupEmail = groupEmail.trim();
      const groupDomain = trimmedGroupEmail.split('@')[1];
      if (groupDomain !== ALLOWED_DOMAIN) {
        throw new HttpsError('invalid-argument', 'invalid_group_email_domain');
      }

      if (!memberEmail || typeof memberEmail !== 'string') {
        throw new HttpsError('invalid-argument', 'member_email_required');
      }

      const trimmedMemberEmail = memberEmail.trim();
      const memberDomain = trimmedMemberEmail.split('@')[1];
      if (memberDomain !== ALLOWED_DOMAIN) {
        throw new HttpsError('invalid-argument', 'invalid_member_email_domain');
      }

      if (!role || typeof role !== 'string') {
        throw new HttpsError('invalid-argument', 'role_required');
      }

      if (role !== 'OWNER' && role !== 'MANAGER' && role !== 'MEMBER') {
        throw new HttpsError('invalid-argument', 'invalid_role');
      }

      const directory = getDirectoryClient(user.googleAccessToken);
      await (directory.groups.members as any).update({
        groupKey: trimmedGroupEmail,
        memberKey: trimmedMemberEmail,
        requestBody: { role },
      });

      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'groups.write',
        target: trimmedGroupEmail,
        request_id: requestId,
        result: 'ok',
        message: `updated ${trimmedMemberEmail} role to ${role} in group ${trimmedGroupEmail}`,
      });

      return {
        groupEmail: trimmedGroupEmail,
        memberEmail: trimmedMemberEmail,
        role,
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
