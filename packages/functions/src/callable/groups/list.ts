import { onCall, HttpsError } from 'firebase-functions/v2/https';
import crypto from 'node:crypto';
import type { Role } from '@school-app/shared';
import { authenticateRequest, assertHasCap, assertHasScopes } from '../../authz/middleware.js';
import { writeAudit } from '../../audit/writeAudit.js';
import { getDirectoryClient } from '../../google/directoryClient.js';
import { ALLOWED_DOMAIN } from '../../auth/onUserCreate.js';

export interface GroupItem {
  email: string;
  name: string;
  description: string;
  aliases: string[];
  directMembersCount: number;
}

export interface GroupsListRequest {
  userKey?: string;
}

export interface GroupsListResponse {
  groups: GroupItem[];
}

const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/admin.directory.group.readonly',
] as const;

function readHeader(request: any, key: string): string | undefined {
  const raw =
    request.rawRequest?.headers?.[key] ?? request.rawRequest?.headers?.[key.toLowerCase()];
  return Array.isArray(raw) ? raw[0] : raw;
}

export const groupsList = onCall(
  { region: 'asia-northeast3', cors: true },
  async (request): Promise<GroupsListResponse> => {
    const requestId = readHeader(request, 'x-request-id') ?? crypto.randomUUID();

    // 인증 실패도 denied 감사 로그를 남긴다. 알 수 없는 자리는 정직하게 'unknown' 으로 기록.
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
        target: '*',
        request_id: requestId,
        result: 'denied',
        message: (err as Error).message,
      });
      throw err;
    }

    // 캡·스코프 검증. 둘 중 하나라도 실패하면 denied 감사.
    try {
      assertHasCap(user, 'groups.read');
      assertHasScopes(user, REQUIRED_SCOPES);
    } catch (err) {
      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'groups.read',
        target: '*',
        request_id: requestId,
        result: 'denied',
        message: (err as Error).message,
      });
      throw err;
    }

    try {
      const data = request.data as Partial<GroupsListRequest> | undefined;
      const rawUserKey = data?.userKey;
      let userKey: string | undefined;
      if (typeof rawUserKey === 'string' && rawUserKey.trim()) {
        userKey = rawUserKey.trim();
        const domain = userKey.split('@')[1];
        if (domain !== ALLOWED_DOMAIN) {
          throw new HttpsError('invalid-argument', 'invalid_email_domain');
        }
      }

      const directory = getDirectoryClient(user.googleAccessToken);
      const results: GroupItem[] = [];
      let pageToken: string | undefined;

      do {
        const params: any = userKey
          ? { userKey, maxResults: 200 }
          : { customer: 'my_customer', maxResults: 200 };
        const res = await directory.groups.list({
          ...params,
          pageToken,
        });
        results.push(
          ...((res.data.groups ?? []) as any[]).map((g): GroupItem => ({
            email: g.email ?? '',
            name: g.name ?? '',
            description: g.description ?? '',
            aliases: Array.isArray(g.aliases) ? g.aliases : [],
            directMembersCount:
              typeof g.directMembersCount === 'string'
                ? Number.parseInt(g.directMembersCount, 10)
                : Number(g.directMembersCount ?? 0),
          })),
        );
        pageToken = res.data.nextPageToken ?? undefined;
      } while (pageToken);

      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'groups.read',
        target: '*',
        request_id: requestId,
        result: 'ok',
        message: userKey
          ? `listed ${results.length} groups for user ${userKey}`
          : `listed ${results.length} groups`,
      });

      return { groups: results };
    } catch (err) {
      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'groups.read',
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
