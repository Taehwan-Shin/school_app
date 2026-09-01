import { onCall, HttpsError } from 'firebase-functions/v2/https';
import crypto from 'node:crypto';
import type { Role } from '@school-app/shared';
import { authenticateRequest, assertHasCap, assertHasScopes } from '../../../authz/middleware.js';
import { writeAudit } from '../../../audit/writeAudit.js';
import { getDirectoryClient } from '../../../google/directoryClient.js';
import { ALLOWED_DOMAIN } from '../../../auth/onUserCreate.js';

export interface GroupsMembersListRequest {
  groupEmail: string;   // 그룹 이메일
  pageToken?: string;   // 페이지네이션 (선택)
  maxResults?: number;  // 1..200, default 200
}

export interface GroupItem {
  email: string;
  role: 'OWNER' | 'MANAGER' | 'MEMBER';
  type: 'USER' | 'GROUP' | 'CUSTOMER' | 'EXTERNAL';
  status: string;  // 'ACTIVE' 등
}

export interface GroupsMembersListResponse {
  members: GroupItem[];
  nextPageToken: string | null;
}

const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/admin.directory.group.member.readonly',
] as const;

function readHeader(request: any, key: string): string | undefined {
  const raw =
    request.rawRequest?.headers?.[key] ?? request.rawRequest?.headers?.[key.toLowerCase()];
  return Array.isArray(raw) ? raw[0] : raw;
}

export const groupsMembersList = onCall(
  { region: 'asia-northeast3', cors: true },
  async (request): Promise<GroupsMembersListResponse> => {
    const requestId = readHeader(request, 'x-request-id') ?? crypto.randomUUID();
    const data = request.data as Partial<GroupsMembersListRequest> | undefined;
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
        action: 'groups.read',
        target: targetEmail,
        request_id: requestId,
        result: 'denied',
        message: (err as Error).message,
      });
      throw err;
    }

    try {
      assertHasCap(user, 'groups.read');
      assertHasScopes(user, REQUIRED_SCOPES);
    } catch (err) {
      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'groups.read',
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

      const { groupEmail, pageToken, maxResults: rawMaxResults } = data;

      if (!groupEmail || typeof groupEmail !== 'string') {
        throw new HttpsError('invalid-argument', 'group_email_required');
      }

      const trimmedEmail = groupEmail.trim();
      const domain = trimmedEmail.split('@')[1];
      if (domain !== ALLOWED_DOMAIN) {
        throw new HttpsError('invalid-argument', 'invalid_email_domain');
      }

      let maxResults = 200;
      if (typeof rawMaxResults === 'number' && Number.isFinite(rawMaxResults)) {
        maxResults = Math.min(200, Math.max(1, Math.floor(rawMaxResults)));
      }

      const directory = getDirectoryClient(user.googleAccessToken);
      const res = await directory.groups.members.list({
        groupKey: trimmedEmail,
        maxResults,
        pageToken: typeof pageToken === 'string' && pageToken.trim() ? pageToken.trim() : undefined,
      });

      const members = ((res.data?.members ?? []) as any[]).map((m: any): GroupItem => ({
        email: m.email ?? '',
        role: m.role ?? 'MEMBER',
        type: m.type ?? 'USER',
        status: m.status ?? '',
      }));

      const nextPageToken = (res.data?.nextPageToken as string | undefined) ?? null;

      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'groups.read',
        target: trimmedEmail,
        request_id: requestId,
        result: 'ok',
        message: `listed ${members.length} members of group ${trimmedEmail}`,
      });

      return {
        members,
        nextPageToken,
      };
    } catch (err) {
      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'groups.read',
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
