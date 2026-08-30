import * as functions from 'firebase-functions/v1';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import type { Role } from '@school-app/shared';

export const ALLOWED_DOMAIN = 'cam-t.kr';

export interface UserRecordLike {
  uid: string;
  email?: string | null;
  displayName?: string | null;
}

export interface HandleUserCreateResult {
  action: 'created' | 'deleted';
  reason?: string;
  role?: Role;
}

export async function handleUserCreate(user: UserRecordLike): Promise<HandleUserCreateResult> {
  const email = user.email || '';
  const domain = email.split('@')[1];

  if (domain !== ALLOWED_DOMAIN) {
    // 신규 사용자의 이메일 도메인이 cam-t.kr 이 아니면 계정 즉시 삭제
    await getAuth().deleteUser(user.uid);
    return { action: 'deleted', reason: 'invalid_domain' };
  }

  const defaultRole: Role = 'teacher';

  // 1. role: "teacher" custom claim 설정
  await getAuth().setCustomUserClaims(user.uid, { role: defaultRole });

  // 2. users/{uid} 문서 create
  const db = getFirestore();
  await db.collection('users').doc(user.uid).create({
    email,
    displayName: user.displayName || '',
    role: defaultRole,
    createdAt: FieldValue.serverTimestamp(),
    lastSeenAt: FieldValue.serverTimestamp(),
  });

  return { action: 'created', role: defaultRole };
}

export const onUserCreate = functions.region('asia-northeast3').auth.user().onCreate(async (user) => {
  await handleUserCreate(user);
});
