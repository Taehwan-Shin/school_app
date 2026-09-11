import { onCall, HttpsError } from 'firebase-functions/v2/https';
import crypto from 'node:crypto';
import type { Role } from '@school-app/shared';
import { authenticateRequest, assertHasCap, assertHasScopes } from '../../authz/middleware.js';
import { writeAudit } from '../../audit/writeAudit.js';
import { getDirectoryClient } from '../../google/directoryClient.js';

// v0.119: CreateUserDialog 의 「조직 단위 (OU)」 드롭다운을 채우기 위한 read-only
// callable. Directory API `orgunits.list(customerId='my_customer', type='all')` 로
// 도메인 전체 OU 트리를 조회. 새 OU 생성은 이 슬라이스 밖.

export interface OrgunitEntry {
  orgUnitPath: string; // 예: '/학생/1학년'
  name?: string;
  description?: string;
  parentOrgUnitPath?: string;
}

export interface OrgunitsListResponse {
  orgUnits: OrgunitEntry[];
}

const REQUIRED_SCOPES = [
  // OU 목록 조회는 orgunit.readonly 스코프로 충분하지만, 기존 users.write 세션이
  // 이미 admin.directory.orgunit 을 포함하므로 reuse. `type=all` 은 read-only.
  'https://www.googleapis.com/auth/admin.directory.orgunit.readonly',
] as const;

function readHeader(request: any, key: string): string | undefined {
  const raw =
    request.rawRequest?.headers?.[key] ?? request.rawRequest?.headers?.[key.toLowerCase()];
  return Array.isArray(raw) ? raw[0] : raw;
}

export const orgunitsList = onCall(
  { region: 'asia-northeast3', cors: true },
  async (request): Promise<OrgunitsListResponse> => {
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
        action: 'users.read',
        target: 'orgunits',
        request_id: requestId,
        result: 'denied',
        message: (err as Error).message,
      });
      throw err;
    }

    try {
      // 계정 생성 UI 의 보조 조회이므로 users.write 를 가진 role 만 허용
      // (super_admin/admin). teacher 는 계정 생성 자체가 불가하므로 이 callable
      // 도 필요 없음.
      assertHasCap(user, 'users.write');
      assertHasScopes(user, REQUIRED_SCOPES);
    } catch (err) {
      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'users.read',
        target: 'orgunits',
        request_id: requestId,
        result: 'denied',
        message: (err as Error).message,
      });
      throw err;
    }

    try {
      const directory = getDirectoryClient(user.googleAccessToken);
      const res = await directory.orgunits.list({
        customerId: 'my_customer',
        type: 'all',
      });

      const orgUnits: OrgunitEntry[] = (res.data?.organizationUnits ?? [])
        .filter(
          (ou): ou is OrgunitEntry & { orgUnitPath: string } =>
            typeof ou.orgUnitPath === 'string' && ou.orgUnitPath.length > 0,
        )
        .map((ou) => ({
          orgUnitPath: ou.orgUnitPath!,
          name: ou.name,
          description: ou.description,
          parentOrgUnitPath: ou.parentOrgUnitPath,
        }));

      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'users.read',
        target: 'orgunits',
        request_id: requestId,
        result: 'ok',
        message: `listed ${orgUnits.length} orgunits`,
      });

      return { orgUnits };
    } catch (err) {
      const status: number | undefined =
        (err as any)?.response?.status ??
        (typeof (err as any)?.code === 'number' ? (err as any).code : undefined);
      const msg = (err as Error).message ?? 'unknown';
      let mapped: HttpsError;
      if (status === 401 || status === 403) {
        mapped = new HttpsError('permission-denied', `google_upstream_denied: ${msg}`);
      } else if (status === 429 || (typeof status === 'number' && status >= 500 && status < 600)) {
        mapped = new HttpsError('unavailable', `google_upstream_unavailable: ${msg}`);
      } else {
        mapped = new HttpsError('unknown', msg);
      }
      const isDenied =
        mapped.code === 'permission-denied' || mapped.code === 'failed-precondition';
      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'users.read',
        target: 'orgunits',
        request_id: requestId,
        result: isDenied ? 'denied' : 'error',
        message: mapped.message,
      });
      throw mapped;
    }
  },
);
