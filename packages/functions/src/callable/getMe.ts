import { onCall, HttpsError } from 'firebase-functions/v2/https';
import type { Role } from '@school-app/shared';

export interface GetMeResponse {
  email: string;
  role: Role;
}

export const getMe = onCall({ region: 'asia-northeast3' }, async (request): Promise<GetMeResponse> => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '인증이 필요합니다.');
  }

  const email = request.auth.token.email || '';
  const role = (request.auth.token.role as Role) || 'teacher';

  return {
    email,
    role,
  };
});
