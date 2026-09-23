// v0.270: bulk 다이얼로그 done phase 「실패 항목 리스트」 shared component.
// 20+ 사이트 반복 markup 통합.
//
// - items.length === 0 이면 미렌더 (호출측 conditional 제거 가능).
// - 스크롤 max-h-40 · overflow-y-auto (긴 목록 대응).
// - text-state-danger + space-y-1 컨테이너.
// - getKey/renderItem 은 caller 제공 (실패 item shape 이 dialog 마다 다름).

import type { ReactNode } from 'react';

export interface BulkFailureListProps<T> {
  items: T[];
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  testId: string;
}

export function BulkFailureList<T>({ items, getKey, renderItem, testId }: BulkFailureListProps<T>) {
  if (items.length === 0) return null;
  return (
    <ul
      className="text-small text-state-danger space-y-1 max-h-40 overflow-y-auto"
      data-testid={testId}
    >
      {items.map((item) => (
        <li key={getKey(item)}>{renderItem(item)}</li>
      ))}
    </ul>
  );
}
