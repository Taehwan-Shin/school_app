import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import crypto from 'node:crypto';
import type { Capability, Role } from '@school-app/shared';
import {
  authenticateRequest,
  assertHasCap,
  assertHasScopes,
  type AuthenticatedUser,
} from '../../authz/middleware.js';
import { writeAudit } from '../../audit/writeAudit.js';
import { writeAuditWithBackup } from '../../audit/writeAuditWithBackup.js';

// v0.322: messages/* callable 공통 — 인증 · cap · scope · 감사 (denied/ok/error) 를 한 곳에서.
// 기존 callable 들이 파일마다 반복하던 3단 try/catch 와 동일한 순서·결과값을 유지한다.

export const EMAIL_RE = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;
export const SPACE_NAME_RE = /^spaces\/[A-Za-z0-9_-]+$/;

export function mapUpstreamError(err: unknown): HttpsError {
  if (err instanceof HttpsError) return err;
  const status: number | undefined =
    (err as any)?.response?.status ??
    (typeof (err as any)?.code === 'number' ? (err as any).code : undefined);
  const msg = (err as Error)?.message ?? 'unknown';
  if (status === 400) return new HttpsError('invalid-argument', `google_upstream_invalid: ${msg}`);
  if (status === 401 || status === 403) {
    return new HttpsError('permission-denied', `google_upstream_denied: ${msg}`);
  }
  if (status === 404) return new HttpsError('not-found', `google_upstream_not_found: ${msg}`);
  if (status === 429 || (typeof status === 'number' && status >= 500 && status < 600)) {
    return new HttpsError('unavailable', `google_upstream_unavailable: ${msg}`);
  }
  return new HttpsError('unknown', msg);
}

function readHeader(request: CallableRequest, key: string): string | undefined {
  const headers = (request.rawRequest as any)?.headers;
  const raw = headers?.[key] ?? headers?.[key.toLowerCase()];
  return Array.isArray(raw) ? raw[0] : raw;
}

export interface AuditedCallOptions {
  action: string;
  target: string;
  cap: Capability;
  scopes: readonly string[];
  scopeMode?: 'all' | 'any';
}

export async function runAudited<T>(
  request: CallableRequest,
  opts: AuditedCallOptions,
  fn: (user: AuthenticatedUser) => Promise<{ result: T; message?: string; target?: string }>,
): Promise<T> {
  const requestId = readHeader(request, 'x-request-id') ?? crypto.randomUUID();
  let target = opts.target;

  let user: AuthenticatedUser;
  try {
    user = await authenticateRequest(request);
  } catch (err) {
    const claimRole = request.auth?.token?.role;
    const role: Role | 'unknown' =
      claimRole === 'super_admin' || claimRole === 'admin' || claimRole === 'teacher'
        ? (claimRole as Role)
        : 'unknown';
    await writeAudit({
      actor: (request.auth?.token?.email as string | undefined) ?? 'unknown',
      role,
      action: opts.action,
      target,
      request_id: requestId,
      result: 'denied',
      message: (err as Error).message,
    });
    throw err;
  }

  try {
    assertHasCap(user, opts.cap);
    assertHasScopes(user, opts.scopes, opts.scopeMode ?? 'all');
  } catch (err) {
    await writeAudit({
      actor: user.email,
      role: user.role,
      action: opts.action,
      target,
      request_id: requestId,
      result: 'denied',
      message: (err as Error).message,
    });
    throw err;
  }

  let out: { result: T; message?: string; target?: string };
  try {
    out = await fn(user);
  } catch (err) {
    const mapped = mapUpstreamError(err);
    const isDenied = mapped.code === 'permission-denied' || mapped.code === 'failed-precondition';
    await writeAudit({
      actor: user.email,
      role: user.role,
      action: opts.action,
      target,
      request_id: requestId,
      result: isDenied ? 'denied' : 'error',
      message: mapped.message,
    });
    throw mapped;
  }

  // v0.324 (Codex v0.322 R1 F-A): 메일/챗은 이미 발송됨 → 성공 감사 저장 실패가 응답을
  // 실패로 뒤집으면 사용자가 재시도해 중복 발송된다. writeAuditWithBackup 은 3회 재시도 후
  // Cloud Logging fallback 만 남기고 throw 하지 않는다 (v0.133 규약 · 성공 후 감사 전용).
  if (out.target) target = out.target;
  await writeAuditWithBackup(
    {
      actor: user.email,
      role: user.role,
      action: opts.action,
      target,
      request_id: requestId,
      result: 'ok',
      message: out.message,
    },
    requestId,
    opts.action.replace(/\./g, '_'),
  );
  return out.result;
}

/** 헤더 injection 방지 + trim + 길이 상한. */
export function requireText(
  value: unknown,
  field: string,
  max: number,
  opts: { singleLine?: boolean } = {},
): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new HttpsError('invalid-argument', `missing_${field}`);
  }
  const v = value.trim();
  if (v.length > max) throw new HttpsError('invalid-argument', `${field}_too_long`);
  if (opts.singleLine && /[\r\n]/.test(v)) throw new HttpsError('invalid-argument', `invalid_${field}`);
  return v;
}

export function requireEmail(value: unknown): string {
  const v = typeof value === 'string' ? value.trim() : '';
  if (!EMAIL_RE.test(v)) throw new HttpsError('invalid-argument', 'invalid_email');
  return v;
}
