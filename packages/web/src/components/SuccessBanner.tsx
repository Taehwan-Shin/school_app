// v0.227: 성공 상태 배너 재사용 component.
// v0.228: shared `Banner` (variant=success) 로 구현 통합 · 기존 API/testId 그대로 유지.

import { Banner } from './Banner';

export interface SuccessBannerProps {
  message: string | null;
  testId: string;
}

export function SuccessBanner({ message, testId }: SuccessBannerProps) {
  return <Banner variant="success" message={message} testId={testId} />;
}
