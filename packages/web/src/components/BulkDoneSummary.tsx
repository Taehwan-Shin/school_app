// v0.264: bulk 다이얼로그 done phase 「완료: N{unit} 성공 · M{unit} 실패」 summary
// shared component. 20+ 사이트 반복 markup 통합.
//
// - label 기본 「완료:」. 커스텀 문구 (예: BulkUpdateRole 「「{role}」 로 변경 완료:」,
//   BulkTransfer 「「{owner}」 로 이관 완료:」) 는 label prop 으로 override.
// - failureCount === 0 이면 실패 부분 미노출.
// - success 는 state-success, failure 는 state-danger 색상.
// v0.268: 3-category (성공 + skipped + 실패) 지원. AutoInvite/AutoCreateGroups/
//   AutoCreateDeptGroups 처럼 「이미 멤버 (skip)」 · 「이미 존재 (skip)」 등 중간
//   집계가 필요한 사이트 대응. `skippedCount` > 0 이면 성공 뒤·실패 앞에 삽입.
//   `skippedSuffix` 로 각 사이트 문구 커스텀 (예: 「이미 멤버 (skip)」).
//   `skippedVariant` 기본 'warning'.

import type { ReactNode } from 'react';

export type SkippedVariant = 'warning' | 'danger';

export interface BulkDoneSummaryProps {
  successCount: number;
  failureCount: number;
  unit: string;
  label?: ReactNode;
  skippedCount?: number;
  skippedSuffix?: string;
  skippedVariant?: SkippedVariant;
}

const SKIPPED_COLOR: Record<SkippedVariant, string> = {
  warning: 'text-state-warning',
  danger: 'text-state-danger',
};

export function BulkDoneSummary({
  successCount,
  failureCount,
  unit,
  label = '완료:',
  skippedCount,
  skippedSuffix,
  skippedVariant = 'warning',
}: BulkDoneSummaryProps) {
  const showSkipped = typeof skippedCount === 'number' && skippedCount > 0;
  return (
    <p className="text-body text-fg-primary">
      {label} <strong className="text-state-success font-mono">{successCount}</strong>
      {unit} 성공
      {showSkipped && (
        <>
          {' '}
          ·{' '}
          <strong className={`${SKIPPED_COLOR[skippedVariant]} font-mono`}>{skippedCount}</strong>
          {unit}
          {skippedSuffix ? ` ${skippedSuffix}` : ' skip'}
        </>
      )}
      {failureCount > 0 && (
        <>
          {' '}
          ·{' '}
          <strong className="text-state-danger font-mono">{failureCount}</strong>
          {unit} 실패
        </>
      )}
    </p>
  );
}
