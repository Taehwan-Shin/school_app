// v0.256: bulk 다이얼로그 running phase 「진행 중: N / M」 + 진행 막대 shared component.
// - 21+ 사이트 반복 markup 통합.
// - label 기본 「진행 중:」. 커스텀 문구 (예: BulkTransferClassroomOwner 의
//   「진행 중 (「Owner」 로 이관):」) 는 label prop 으로 override.
// - width % 계산 은 컴포넌트 내부 (total === 0 일 때 0% 안전).

import type { ReactNode } from 'react';

export interface BulkProgressProps {
  progress: number;
  total: number;
  testId: string;
  label?: ReactNode;
}

export function BulkProgress({ progress, total, testId, label = '진행 중:' }: BulkProgressProps) {
  const percent = total > 0 ? (progress / total) * 100 : 0;
  return (
    <div className="py-8 text-center space-y-3" data-testid={testId}>
      <div className="text-body text-fg-primary">
        {label} <strong className="font-mono">{progress}</strong> /{' '}
        <strong className="font-mono">{total}</strong>
      </div>
      <div className="w-full bg-canvas h-2 border border-border-subtle">
        <div
          className="bg-fg-primary h-full transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
