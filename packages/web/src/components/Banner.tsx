// v0.228: 상태 배너 공통 컴포넌트 (v0.227 SuccessBanner 확장).
// - variant: 'success' | 'error' | 'warning'.
// - 각 variant 는 UI_SYSTEM state 색상 (state-success/danger/warning) + role/aria-live 로 스크린 리더 알림.
//   error/warning 은 role=alert + aria-live=assertive (즉시 알림 필요).
//   success 는 role=status + aria-live=polite (기존 v0.227 유지).
// - message 가 null 이면 미렌더.

import type { ReactNode } from 'react';

export type BannerVariant = 'success' | 'error' | 'warning';

export interface BannerProps {
  variant: BannerVariant;
  message: ReactNode | null;
  testId: string;
}

const VARIANT_CLASSES: Record<BannerVariant, string> = {
  success: 'border border-state-success bg-surface p-4 text-small text-state-success',
  error: 'border border-state-danger bg-surface p-4 text-small text-state-danger',
  warning: 'border border-state-warning bg-surface p-4 text-small text-state-warning',
};

const VARIANT_ARIA: Record<
  BannerVariant,
  { role: 'status' | 'alert'; ariaLive: 'polite' | 'assertive' }
> = {
  success: { role: 'status', ariaLive: 'polite' },
  error: { role: 'alert', ariaLive: 'assertive' },
  warning: { role: 'alert', ariaLive: 'assertive' },
};

export function Banner({ variant, message, testId }: BannerProps) {
  if (message === null || message === undefined) return null;
  const aria = VARIANT_ARIA[variant];
  return (
    <div
      className={VARIANT_CLASSES[variant]}
      role={aria.role}
      aria-live={aria.ariaLive}
      data-testid={testId}
    >
      {message}
    </div>
  );
}
