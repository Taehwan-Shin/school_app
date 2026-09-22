// v0.227: 성공 상태 배너 재사용 component.
// - 3 admin 테이블 (Accounts/Groups/Classroom) 에서 동일 markup 반복 → 단일 컴포넌트.
// - `message` 가 null 이면 미렌더 (기존 `{message && <div>...</div>}` 패턴 대체).
// - `testId` 는 테이블별 회귀 추적용 (accounts-success-banner 등 유지).
// - `useAutoDismissBanner` (v0.226) hook 의 message 값을 그대로 넘김.

export interface SuccessBannerProps {
  message: string | null;
  testId: string;
}

export function SuccessBanner({ message, testId }: SuccessBannerProps) {
  if (!message) return null;
  return (
    <div
      className="border border-state-success bg-surface p-4 text-small text-state-success"
      role="status"
      aria-live="polite"
      data-testid={testId}
    >
      {message}
    </div>
  );
}
