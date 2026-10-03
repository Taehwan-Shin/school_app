import { useContext, useState } from 'react';
import { QueryClientContext } from '@tanstack/react-query';
import { Button } from '../ui/button';
import { signInWithGoogle } from '../../lib/auth';
import { useGoogleSessionExpired } from '../../lib/googleSession';

// v0.326: Google 로그인 (access token) 만료 시 모든 화면 상단에 「다시 로그인」 안내.
// 다시 로그인은 같은 계정 팝업 (signInWithGoogle) — 페이지 상태 유지 · 성공 후 데이터 다시 불러오기.
export function SessionExpiredBanner() {
  const { reason, clear } = useGoogleSessionExpired();
  const queryClient = useContext(QueryClientContext);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!reason) return null;

  const text =
    reason === 'missing_google_access_token'
      ? '이 탭에는 Google 로그인 정보가 없습니다. 다시 로그인하면 이어서 작업할 수 있어요.'
      : 'Google 로그인이 만료되었습니다 (약 1시간). 다시 로그인하면 이어서 작업할 수 있어요.';

  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 border border-state-warning bg-elevated px-4 py-3 mb-6"
      data-testid="session-expired-banner"
    >
      <p className="text-small text-fg-primary">
        {text}
        {error && <span className="ml-2 text-state-danger">({error})</span>}
      </p>
      <Button
        size="sm"
        disabled={busy}
        data-testid="session-expired-relogin"
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await signInWithGoogle();
            clear();
            await queryClient?.invalidateQueries();
          } catch (e) {
            // 팝업 차단 · 취소 → 배너 유지.
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? '로그인 중...' : '다시 로그인'}
      </Button>
    </div>
  );
}
