import { auth } from '../lib/firebase';
import { getGoogleAccessTokenFromSession } from '../lib/auth';

// v0.309: Firebase Callable Function 호출 공통 boilerplate shared.
// - 기존 15+ api/*.ts 파일이 각각 반복하던 ~40 라인 (auth check · idToken · Google access token ·
//   URL 구성 · requestId · fetch POST · error 처리 · body.result 언랩) 을 흡수.
// - 이번 슬라이스는 helper 만 추가 · 실 이식은 후속 슬라이스 (파일당 검증 회귀 필요).
// - `functionName`: Cloud Function 이름 (예: `classroomStudentsList`)
// - `data`: 요청 body. `_googleAccessToken` 은 자동 병합됨 (v0.a86 body-based token · core memory).
// - `scopes`: X-Google-Scopes header 값 (space-delimited OAuth scope list · optional).
//
// 반환: `body.result ?? body` 언랩된 응답 (Firebase Callable spec).
// 에러: `Error & { status?: number }` throw · 4xx/5xx 상태코드 포함.

export interface CallCallableOptions {
  scopes?: string;
}

export async function callCallable<TRequest, TResponse>(
  functionName: string,
  data: TRequest,
  options: CallCallableOptions = {},
): Promise<TResponse> {
  const user = auth.currentUser;
  if (!user) throw new Error('not_authenticated');
  const idToken = await user.getIdToken();
  const googleAccessToken = getGoogleAccessTokenFromSession() || '';

  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'school-app-5a636';
  const url = import.meta.env.DEV
    ? `http://127.0.0.1:5001/${projectId}/asia-northeast3/${functionName}`
    : `https://asia-northeast3-${projectId}.cloudfunctions.net/${functionName}`;

  const requestId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${idToken}`,
    'X-Google-Access-Token': googleAccessToken,
    'X-Request-Id': requestId,
  };
  if (options.scopes) {
    headers['X-Google-Scopes'] = options.scopes;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      data: {
        ...data,
        _googleAccessToken: googleAccessToken,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = body.error?.message ?? `http_${res.status}`;
    const err = new Error(message) as Error & {
      status?: number;
      details?: unknown;
    };
    err.status = res.status;
    // v0.116c F77 대칭: server 는 partial 실패 (예: transferClassroomOwnership 에서 교사 추가 후
    // patch 실패) 시 details 에 { addedTeacherButPatchFailed, rollback, newOwnerEmail } 등을 실어 보낸다.
    // UI 는 rollback=skipped/failed 시 「교사가 남아 있을 수 있음」 안내에 사용 → 반드시 보존.
    err.details = body.error?.details;
    throw err;
  }

  const body = await res.json();
  return (body.result ?? body) as TResponse;
}
