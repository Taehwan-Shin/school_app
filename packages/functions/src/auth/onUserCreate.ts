import { beforeUserCreated, HttpsError } from 'firebase-functions/v2/identity';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import type { Role } from '@school-app/shared';

export const ALLOWED_DOMAIN = 'cam.hs.kr';

export interface UserRecordLike {
  uid: string;
  email?: string | null;
  displayName?: string | null;
}

export interface HandleUserCreateResult {
  action: 'created' | 'rejected';
  reason?: string;
  role?: Role;
  customClaims?: { role: Role };
}

/**
 * Blocking Auth 트리거의 순수 핸들러. 도메인이 허용되지 않으면 HttpsError 를 던져
 * 사용자 생성 자체를 막고, 허용되면 `users/{uid}` 문서를 생성한 뒤 반환값으로
 * custom claim 을 설정한다. 계정 사후 삭제(v1 방식) 는 하지 않는다.
 */
export async function handleUserCreate(user: UserRecordLike): Promise<HandleUserCreateResult> {
  const email = user.email || '';
  const domain = email.split('@')[1];

  if (domain !== ALLOWED_DOMAIN) {
    throw new HttpsError('permission-denied', 'invalid_domain');
  }

  const defaultRole: Role = 'teacher';

  const db = getFirestore();
  await db.collection('users').doc(user.uid).create({
    email,
    displayName: user.displayName || '',
    role: defaultRole,
    createdAt: FieldValue.serverTimestamp(),
    lastSeenAt: FieldValue.serverTimestamp(),
  });

  return {
    action: 'created',
    role: defaultRole,
    customClaims: { role: defaultRole },
  };
}

export const onUserCreate = beforeUserCreated(
  { region: 'asia-northeast3' },
  async (event) => {
    const user = event.data;
    if (!user) {
      throw new HttpsError('failed-precondition', 'no_user_data');
    }
    const result = await handleUserCreate({
      uid: user.uid,
      email: user.email ?? null,
      displayName: user.displayName ?? null,
    });
    return { customClaims: result.customClaims };
  },
);
