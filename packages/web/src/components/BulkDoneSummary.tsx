// v0.264: bulk 다이얼로그 done phase 「완료: N{unit} 성공 · M{unit} 실패」 summary
// shared component. 20+ 사이트 반복 markup 통합.
//
// - label 기본 「완료:」. 커스텀 문구 (예: BulkUpdateRole 「「{role}」 로 변경 완료:」,
//   BulkTransfer 「「{owner}」 로 이관 완료:」) 는 label prop 으로 override.
// - failureCount === 0 이면 실패 부분 미노출.
// - success 는 state-success, failure 는 state-danger 색상.

import type { ReactNode } from 'react';

export interface BulkDoneSummaryProps {
  successCount: number;
  failureCount: number;
  unit: string;
  label?: ReactNode;
}

export function BulkDoneSummary({
  successCount,
  failureCount,
  unit,
  label = '완료:',
}: BulkDoneSummaryProps) {
  return (
    <p className="text-body text-fg-primary">
      {label} <strong className="text-state-success font-mono">{successCount}</strong>
      {unit} 성공
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
