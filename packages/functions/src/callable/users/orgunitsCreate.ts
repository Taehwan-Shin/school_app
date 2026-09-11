import { onCall, HttpsError } from 'firebase-functions/v2/https';
import crypto from 'node:crypto';
import type { Role } from '@school-app/shared';
import { authenticateRequest, assertHasCap, assertHasScopes } from '../../authz/middleware.js';
import { writeAudit } from '../../audit/writeAudit.js';
import { writeAuditWithBackup } from '../../audit/writeAuditWithBackup.js';
import { getDirectoryClient } from '../../google/directoryClient.js';

// v0.121: 신규 OU 생성. v0.119 의 `orgunitsList` 옵션 (`orgunits.readonly` scope) 만
// 으로는 create 를 못 하므로 별도 `admin.directory.orgunit` (read/write) scope 요구.

export interface OrgunitsCreateRequest {
  name: string;
  parentOrgUnitPath: string;
  description?: string;
  blockInheritance?: boolean;
}

export interface OrgunitsCreateResponse {
  orgUnitPath: string;
  name: string;
  description?: string;
  parentOrgUnitPath: string;
}

const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/admin.directory.orgunit',
] as const;

// OU 이름 제약: 슬래시·백슬래시·leading/trailing whitespace 금지. Google 은
// 길이 제한을 문서화하지 않지만 실무상 100 자로 컷 (감사 message 오염 방지).
const NAME_RE = /^[^\/\\][^\/\\]*[^\/\\\s]$|^[^\/\\\s]$/;
const NAME_MAX = 100;
// 부모 경로: 절대 경로 (「/」 시작), 최상위는 「/」 자체.
const PARENT_PATH_RE = /^\/[^\s\\](?:.*[^\s\\])?$|^\/$/;

// v0.121b F98: Google `orgunits.insert` 성공 뒤 감사 쓰기가 실패해도 이미
// 생성된 OU 상태를 client 에 반환해야 재시도 409 를 피할 수 있다.
// v0.133: shared writeAuditWithBackup util 로 통합 (audit/writeAuditWithBackup.ts).

function readHeader(request: any, key: string): string | undefined {
  const raw =
    request.rawRequest?.headers?.[key] ?? request.rawRequest?.headers?.[key.toLowerCase()];
  return Array.isArray(raw) ? raw[0] : raw;
}

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
  if (status === 409) {
    return new HttpsError('already-exists', `orgunit_already_exists: ${msg}`);
  }
  if (status === 429 || (typeof status === 'number' && status >= 500 && status < 600)) {
    return new HttpsError('unavailable', `google_upstream_unavailable: ${msg}`);
  }
  return new HttpsError('unknown', msg);
}

export const orgunitsCreate = onCall(
  { region: 'asia-northeast3', cors: true },
  async (request): Promise<OrgunitsCreateResponse> => {
    const requestId = readHeader(request, 'x-request-id') ?? crypto.randomUUID();
    const data = request.data as Partial<OrgunitsCreateRequest> | undefined;

    // target 표시용 문자열 — validation 통과 전에도 감사에 남기기 위해 미리 계산.
    const preTarget =
      typeof data?.parentOrgUnitPath === 'string' && typeof data?.name === 'string'
        ? `orgunits${data.parentOrgUnitPath.endsWith('/') ? data.parentOrgUnitPath.slice(0, -1) : data.parentOrgUnitPath}/${data.name}`
        : 'orgunits';

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
        action: 'users.write',
        target: preTarget,
        request_id: requestId,
        result: 'denied',
        message: (err as Error).message,
      });
      throw err;
    }

    try {
      // users.write cap 재사용 — 계정 생성 경계와 같이 계정 관리 담당자만 OU 를
      // 만들 수 있음. teacher role 은 두 작업 모두 미허용.
      assertHasCap(user, 'users.write');
      assertHasScopes(user, REQUIRED_SCOPES);
    } catch (err) {
      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'users.write',
        target: preTarget,
        request_id: requestId,
        result: 'denied',
        message: (err as Error).message,
      });
      throw err;
    }

    // v0.121b F98: 입력 검증·Google 호출 · 그리고 insert 후 orgUnitPath 검증까지
    // 는 실패 시 감사 (denied/error) 를 남기고 throw. `orgunits.insert` 가
    // 성공하고 orgUnitPath 도 확보되면 그 시점부터 감사 실패는 성공 응답을
    // 뒤엎지 않도록 별도 처리 (writeAuditWithBackup).
    let name = '';
    let parentOrgUnitPath = '';
    let description: string | undefined;
    let blockInheritance: boolean | undefined;

    try {
      name = typeof data?.name === 'string' ? data.name.trim() : '';
      if (!name) {
        throw new HttpsError('invalid-argument', 'name_required');
      }
      if (name.length > NAME_MAX) {
        throw new HttpsError('invalid-argument', `name_too_long: max ${NAME_MAX}`);
      }
      if (!NAME_RE.test(name)) {
        throw new HttpsError('invalid-argument', 'name_invalid_chars');
      }
      parentOrgUnitPath =
        typeof data?.parentOrgUnitPath === 'string' ? data.parentOrgUnitPath.trim() : '';
      if (!parentOrgUnitPath || !PARENT_PATH_RE.test(parentOrgUnitPath)) {
        throw new HttpsError('invalid-argument', 'invalid_parent_path');
      }
      description =
        typeof data?.description === 'string' ? data.description.trim() : undefined;
      blockInheritance =
        typeof data?.blockInheritance === 'boolean' ? data.blockInheritance : undefined;
    } catch (err) {
      const mapped = mapUpstreamError(err);
      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'users.write',
        target: preTarget,
        request_id: requestId,
        result: 'denied',
        message: mapped.message,
      });
      throw mapped;
    }

    type OrgunitInsertResult = Awaited<
      ReturnType<ReturnType<typeof getDirectoryClient>['orgunits']['insert']>
    >;
    let res: OrgunitInsertResult;
    try {
      const directory = getDirectoryClient(user.googleAccessToken);
      res = await directory.orgunits.insert({
        customerId: 'my_customer',
        requestBody: {
          name,
          parentOrgUnitPath,
          ...(description !== undefined ? { description } : {}),
          ...(blockInheritance !== undefined ? { blockInheritance } : {}),
        },
      });
    } catch (err) {
      const mapped = mapUpstreamError(err);
      const isDenied =
        mapped.code === 'permission-denied' || mapped.code === 'failed-precondition';
      await writeAudit({
        actor: user.email,
        role: user.role,
        action: 'users.write',
        target: preTarget,
        request_id: requestId,
        result: isDenied ? 'denied' : 'error',
        message: mapped.message,
      });
      throw mapped;
    }

    const orgUnitPath = res.data?.orgUnitPath;
    if (!orgUnitPath || typeof orgUnitPath !== 'string') {
      // Google API 가 orgUnitPath 를 안 돌려주면 client 가 참조할 자원이 없어
      // 재시도해도 409 만 반복. UI 는 orgunits list refetch 로 대체할 수밖에.
      // 이 케이스는 관측되지 않았으나 방어적으로 error 감사.
      await writeAuditWithBackup(
        {
          actor: user.email,
          role: user.role,
          action: 'users.write',
          target: preTarget,
          request_id: requestId,
          result: 'error',
          message: 'orgunit_created_but_path_missing',
        },
        requestId,
        'orgunits_create',
      );
      throw new HttpsError('internal', 'orgunit_created_but_path_missing');
    }

    // 여기부터는 「Google 쪽 OU 이미 생성됨」 이 확정. 감사 실패해도 client 는
    // orgUnitPath 를 받아야 재시도 409 를 피한다. writeAuditWithBackup 은 throw
    // 하지 않음 — 최종 실패 시 Cloud Logging 로 남기고 성공 응답을 반환.
    await writeAuditWithBackup(
      {
        actor: user.email,
        role: user.role,
        action: 'users.write',
        target: `orgunits${orgUnitPath}`,
        request_id: requestId,
        result: 'ok',
        message: `created orgunit name=${name} parent=${parentOrgUnitPath}`,
      },
      requestId,
      'orgunits_create',
    );

    return {
      orgUnitPath,
      name: res.data.name ?? name,
      description: res.data.description ?? description,
      parentOrgUnitPath: res.data.parentOrgUnitPath ?? parentOrgUnitPath,
    };
  },
);
