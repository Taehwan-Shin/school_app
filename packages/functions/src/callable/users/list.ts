import { onCall, HttpsError } from 'firebase-functions/v2/https';
import crypto from 'node:crypto';
import type { Role } from '@school-app/shared';
import { authenticateRequest, assertHasCap, assertHasScopes } from '../../authz/middleware.js';
import { writeAudit } from '../../audit/writeAudit.js';
import { getDirectoryClient } from '../../google/directoryClient.js';

export interface UserItem {
  email: string;
  firstName: string;
  lastName: string;
  orgUnitPath: string;
  isAdmin: boolean;
  isSuspended: boolean;
}

export interface UsersListResponse {
  users: UserItem[];
}

const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/admin.directory.user.readonly',
] as const;

function readHeader(request: any, key: string): string | undefined {
  const raw =
    request.rawRequest?.headers?.[key] ?? request.rawRequest?.headers?.[key.toLowerCase()];
  return Array.isArray(raw) ? raw[0] : raw;
}

export const usersList = onCall({ region: 'asia-northeast3' }, async (request): Promise<UsersListResponse> => {
  const requestId = readHeader(request, 'x-request-id') ?? crypto.randomUUID();

  // 인증 실패도 denied 감사 로그를 남긴다. 알 수 없는 자리는 정직하게 'unknown' 으로 기록.
  // 절대 임의 role 로 위조하지 않는다 (감사 신뢰 경계).
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
      action: 'users.read',
      target: '*',
      request_id: requestId,
      result: 'denied',
      message: (err as Error).message,
    });
    throw err;
  }

  // 캡·스코프 검증. 둘 중 하나라도 실패하면 denied 감사.
  try {
    assertHasCap(user, 'users.read');
    assertHasScopes(user, REQUIRED_SCOPES);
  } catch (err) {
    await writeAudit({
      actor: user.email,
      role: user.role,
      action: 'users.read',
      target: '*',
      request_id: requestId,
      result: 'denied',
      message: (err as Error).message,
    });
    throw err;
  }

  try {
    const directory = getDirectoryClient(user.googleAccessToken);
    const results: UserItem[] = [];
    let pageToken: string | undefined;

    do {
      const res = await directory.users.list({
        customer: 'my_customer',
        maxResults: 100,
        pageToken,
        orderBy: 'email',
      });
      results.push(
        ...((res.data.users ?? []) as any[]).map((u): UserItem => ({
          email: u.primaryEmail ?? '',
          firstName: u.name?.givenName ?? '',
          lastName: u.name?.familyName ?? '',
          orgUnitPath: u.orgUnitPath ?? '',
          isAdmin: u.isAdmin ?? false,
          isSuspended: u.suspended ?? false,
        })),
      );
      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);

    await writeAudit({
      actor: user.email,
      role: user.role,
      action: 'users.read',
      target: '*',
      request_id: requestId,
      result: 'ok',
      message: `listed ${results.length} users`,
    });

    return { users: results };
  } catch (err) {
    await writeAudit({
      actor: user.email,
      role: user.role,
      action: 'users.read',
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
});
