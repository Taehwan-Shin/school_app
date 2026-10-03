import { useEffect, useState } from 'react';

// v0.326: Google access token 만료 안내.
// Firebase 로그인은 유지되지만 Google OAuth access token (sessionStorage) 은 약 1시간 뒤 만료되고,
// 새 탭에는 아예 없다. 그때 서버는 invalid_google_access_token / missing_google_access_token 으로
// 거부해 화면마다 알 수 없는 오류가 뜨던 문제를 「다시 로그인」 배너 하나로 모은다.
// (lib/auth.tsx 와 분리: 여러 테스트가 lib/auth 를 부분 mock 하므로 callCallable 이 의존해도 안전하게.)

const EVENT = 'school-app:google-session-expired';
const ISSUED_KEY = 'googleAccessTokenIssuedAt';

/** Google access token 수명 (3600s) 보다 조금 일찍 안내. */
export const GOOGLE_TOKEN_STALE_MS = 55 * 60 * 1000;

export const SESSION_EXPIRED_ERRORS: ReadonlySet<string> = new Set([
  'invalid_google_access_token',
  'missing_google_access_token',
]);

export type SessionExpiredReason = 'stale' | 'invalid_google_access_token' | 'missing_google_access_token';

export function markGoogleTokenIssued(now = Date.now()): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(ISSUED_KEY, String(now));
}

export function clearGoogleTokenIssued(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(ISSUED_KEY);
}

/** 발급 시각이 기록돼 있고 55분이 지났으면 true. 기록이 없으면 (이전 버전 세션) 판단하지 않는다. */
export function isGoogleTokenStale(now = Date.now()): boolean {
  if (typeof window === 'undefined') return false;
  const raw = window.sessionStorage.getItem(ISSUED_KEY);
  if (!raw) return false;
  const issued = Number(raw);
  return Number.isFinite(issued) && now - issued > GOOGLE_TOKEN_STALE_MS;
}

export function notifyGoogleSessionExpired(reason: SessionExpiredReason): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<SessionExpiredReason>(EVENT, { detail: reason }));
}

/** 서버 오류 메시지가 세션 만료 계열이면 알린다 (callCallable 이 호출). */
export function maybeNotifySessionExpired(message: string): void {
  if (SESSION_EXPIRED_ERRORS.has(message)) {
    notifyGoogleSessionExpired(message as SessionExpiredReason);
  }
}

export function useGoogleSessionExpired(pollMs = 60_000) {
  const [reason, setReason] = useState<SessionExpiredReason | null>(() =>
    isGoogleTokenStale() ? 'stale' : null,
  );

  useEffect(() => {
    const onExpired = (e: Event) => setReason((e as CustomEvent<SessionExpiredReason>).detail);
    window.addEventListener(EVENT, onExpired);
    const timer = window.setInterval(() => {
      if (isGoogleTokenStale()) setReason((prev) => prev ?? 'stale');
    }, pollMs);
    return () => {
      window.removeEventListener(EVENT, onExpired);
      window.clearInterval(timer);
    };
  }, [pollMs]);

  return { reason, clear: () => setReason(null) };
}
