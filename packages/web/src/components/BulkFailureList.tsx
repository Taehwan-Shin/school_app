// v0.270: bulk 다이얼로그 done phase 「실패 항목 리스트」 shared component.
// 20+ 사이트 반복 markup 통합.
//
// - items.length === 0 이면 미렌더 (호출측 conditional 제거 가능).
// - 스크롤 max-h-40 · overflow-y-auto (긴 목록 대응).
// - text-state-danger + space-y-1 컨테이너.
// - getKey/renderItem 은 caller 제공 (실패 item shape 이 dialog 마다 다름).
// v0.273: `getKey` 두 번째 인자로 index 제공. AutoInvite/AutoCreateDeptGroups
//   처럼 `${groupEmail}-${memberEmail}-${index}` 복합 key 가 필요한 사이트 대응.
//   기존 소비자 (item 만 사용) backward compat.

import type { ReactNode } from 'react';

export interface BulkFailureListProps<T> {
  items: T[];
  getKey: (item: T, index: number) => string;
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
      {items.map((item, index) => (
        <li key={getKey(item, index)}>{renderItem(item)}</li>
      ))}
    </ul>
  );
}
