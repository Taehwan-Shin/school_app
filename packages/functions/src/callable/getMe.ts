import { onCall, HttpsError } from 'firebase-functions/v2/https';
import type { Role } from '@school-app/shared';
import { ALLOWED_DOMAIN } from '../auth/onUserCreate.js';

export interface GetMeResponse {
  email: string;
  role: Role;
}

export interface GetMeAuthContext {
  auth?: {
    token: {
      email?: string;
      role?: unknown;
      [k: string]: unknown;
    };
  } | null;
}

const KNOWN_ROLES: readonly Role[] = ['super_admin', 'admin', 'teacher'] as const;

function isKnownRole(value: unknown): value is Role {
  return typeof value === 'string' && (KNOWN_ROLES as readonly string[]).includes(value);
}

export function handleGetMe(request: GetMeAuthContext): GetMeResponse {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '인증이 필요합니다.');
  }

  const email = request.auth.token.email;
  if (typeof email !== 'string' || email.split('@')[1] !== ALLOWED_DOMAIN) {
    throw new HttpsError('permission-denied', '허용되지 않은 도메인의 계정입니다.');
  }

  const claimRole = request.auth.token.role;
  if (!isKnownRole(claimRole)) {
    throw new HttpsError('failed-precondition', '역할이 아직 부여되지 않았습니다. 잠시 후 다시 시도해 주세요.');
  }

  return { email, role: claimRole };
}

export const getMe = onCall({ region: 'asia-northeast3' }, async (request): Promise<GetMeResponse> => {
  return handleGetMe(request);
});
