import { CallableRequest, HttpsError } from 'firebase-functions/v2/https';
import type { Role, Capability } from '@school-app/shared';
import { userHasCap } from '@school-app/shared';
import { ALLOWED_DOMAIN } from '../auth/onUserCreate.js';

export interface AuthenticatedUser {
  email: string;
  role: Role;
  googleAccessToken: string;
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

  const rawHeaders = request.rawRequest?.headers ?? {};
  const rawToken = rawHeaders['x-google-access-token'] ?? rawHeaders['X-Google-Access-Token'];
  const googleAccessToken = Array.isArray(rawToken) ? rawToken[0] : rawToken;

  if (!googleAccessToken || typeof googleAccessToken !== 'string') {
    throw new HttpsError('unauthenticated', 'missing_google_access_token');
  }

  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    // TODO(v1.1): tokeninfo mock server 도입.
    // 에뮬레이터 환경에서는 Google tokeninfo 네트워크 호출을 건너뛰고 헤더의 access token을 신뢰합니다.
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
  };
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
