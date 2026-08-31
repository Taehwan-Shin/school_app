#!/usr/bin/env node
// 특정 사용자의 role 을 승격/변경 (custom claim + Firestore users 문서).
//
// 사용법:
//   cd packages/functions
//   node scripts/promote-user.mjs <email> [role]
//
// 예시:
//   node scripts/promote-user.mjs admin2@cam.hs.kr super_admin
//
// role 기본값: super_admin. 허용 값: super_admin / admin / teacher.
//
// 실행 조건:
// - Cloud Shell 또는 gcloud application default credentials 가 설정된 환경
// - 실행 계정이 Firestore write + Firebase Auth admin 권한을 가져야 함
//   (프로젝트 owner 나 editor 면 충분)
//
// 승격 후: 대상 사용자는 로그아웃 후 재로그인 해야 새 role 이 ID 토큰에 반영됨.

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const VALID_ROLES = ['super_admin', 'admin', 'teacher'];

const email = process.argv[2];
const role = process.argv[3] || 'super_admin';

if (!email) {
  console.error('사용법: node scripts/promote-user.mjs <email> [role]');
  console.error('예시:  node scripts/promote-user.mjs admin2@cam.hs.kr super_admin');
  process.exit(1);
}

if (!VALID_ROLES.includes(role)) {
  console.error(`유효하지 않은 role: ${role}. 다음 중 하나여야 합니다: ${VALID_ROLES.join(', ')}`);
  process.exit(1);
}

const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'school-app-5a636';

initializeApp({
  credential: applicationDefault(),
  projectId,
});

try {
  const user = await getAuth().getUserByEmail(email);
  await getAuth().setCustomUserClaims(user.uid, { role });
  await getFirestore().doc(`users/${user.uid}`).set(
    { role, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
  console.log(`✅ ${email} (uid=${user.uid}) → role=${role}`);
  console.log(`⚠️  대상 사용자는 로그아웃 후 재로그인해야 새 role 이 반영됩니다.`);
} catch (err) {
  console.error(`❌ 실패: ${err.message}`);
  if (err.code) {
    console.error(`   에러 코드: ${err.code}`);
  }
  process.exit(1);
}
