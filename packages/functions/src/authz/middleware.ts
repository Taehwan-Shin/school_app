import { CallableRequest, HttpsError } from 'firebase-functions/v2/https';
import type { Role, Capability } from '@school-app/shared';
import { userHasCap } from '@school-app/shared';
import { ALLOWED_DOMAIN } from '../auth/onUserCreate.js';

export interface AuthenticatedUser {
  email: string;
  role: Role;
  googleAccessToken: string;
  /**
   * Google OAuth 액세스 토큰에 부여된 스코프 목록.
   * 프로덕션: tokeninfo 응답의 `scope` 필드 (공백 구분) 파싱.
   * Emulator: `X-Google-Scopes` 헤더에서 공백 구분으로 파싱 (테스트가 명시 지정).
   */
  scopes: readonly string[];
}

export async function authenticateRequest(request: CallableRequest): Promise<AuthenticatedUser> {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '인증이 필요합니다.');
  }

  const email = request.auth.token.email;
  if (typeof email !== 'string' || !email) {
    throw new HttpsError('unauthenticated', 'email_missing');
  }

  const domain = email.split('@')[1];
  if (domain !== ALLOWED_DOMAIN) {
    throw new HttpsError('permission-denied', 'invalid_domain');
  }

  const role = request.auth.token.role;
  if (role !== 'super_admin' && role !== 'admin' && role !== 'teacher') {
    throw new HttpsError('failed-precondition', 'role_not_assigned');
  }

  // Google OAuth access token 은 우선 body (`data._googleAccessToken`) 에서 읽고,
  // 없으면 헤더 (`X-Google-Access-Token`) 로 fallback. firebase-functions v6 의
  // onCall 에서 `request.rawRequest.headers` 로 커스텀 헤더가 안 전달되는 케이스가
  // 있어서 body 를 primary transport 로 사용.
  const bodyData = request.data as { _googleAccessToken?: string } | undefined;
  const bodyToken =
    bodyData && typeof bodyData._googleAccessToken === 'string' ? bodyData._googleAccessToken : '';

  const rawHeaders = request.rawRequest?.headers ?? {};
  const rawToken = rawHeaders['x-google-access-token'] ?? rawHeaders['X-Google-Access-Token'];
  const headerToken = Array.isArray(rawToken) ? rawToken[0] : rawToken;

  const googleAccessToken =
    bodyToken || (typeof headerToken === 'string' ? headerToken : '');

  if (!googleAccessToken) {
    throw new HttpsError('unauthenticated', 'missing_google_access_token');
  }

  let scopes: readonly string[] = [];

  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    // TODO(v1.1): tokeninfo mock server 도입.
    // 에뮬레이터 환경에서는 Google tokeninfo 네트워크 호출을 건너뛰고 헤더의 access token 을 신뢰한다.
    // 스코프는 `X-Google-Scopes` 헤더(공백 구분) 로 테스트가 명시 지정한다.
    const rawScopes = rawHeaders['x-google-scopes'] ?? rawHeaders['X-Google-Scopes'];
    const scopeStr = Array.isArray(rawScopes) ? rawScopes[0] : rawScopes;
    scopes = typeof scopeStr === 'string' ? scopeStr.split(/\s+/).filter(Boolean) : [];
  } else {
    try {
      const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(googleAccessToken)}`);
      if (!res.ok) {
        throw new HttpsError('unauthenticated', 'invalid_google_access_token');
      }
      const tokenInfo = (await res.json()) as { email?: string; scope?: string };
      if (tokenInfo.email !== email) {
        throw new HttpsError('unauthenticated', 'token_subject_mismatch');
      }
      scopes = typeof tokenInfo.scope === 'string'
        ? tokenInfo.scope.split(/\s+/).filter(Boolean)
        : [];
    } catch (err) {
      if (err instanceof HttpsError) {
        throw err;
      }
      throw new HttpsError('unauthenticated', 'invalid_google_access_token');
    }
  }

  return {
    email,
    role,
    googleAccessToken,
    scopes,
  };
}

/**
 * Google OAuth 액세스 토큰이 요구 스코프를 모두 포함하는지 검증한다.
 * `any` 로 하나라도 만족하면 통과할지, `all` 로 전부 요구할지는 호출자가 정한다.
 * 기본은 `all` — 요구된 모든 스코프가 있어야 통과.
 */
export function assertHasScopes(
  user: AuthenticatedUser,
  required: readonly string[],
  mode: 'all' | 'any' = 'all',
): void {
  const present = new Set(user.scopes);
  const missing = required.filter((s) => !present.has(s));
  const ok = mode === 'all' ? missing.length === 0 : missing.length < required.length;
  if (!ok) {
    throw new HttpsError('permission-denied', `insufficient_scope:${missing.join(',')}`);
  }
}

export function assertHasCap(
  user: { role: Role } | Role,
  cap: Capability,
): void {
  const role = typeof user === 'string' ? user : user.role;
  if (!userHasCap(role, cap)) {
    throw new HttpsError('permission-denied', cap);
  }
}
