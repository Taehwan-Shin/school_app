// v0.261: bulk 다이얼로그 confirm phase 「대상 5건 미리보기 + '외 N' 요약」
// shared component. 11 site 반복 markup 통합.
//
// - items 를 최대 `limit` 개 (기본 5) font-mono 로 노출, 나머지는 「... 외 N{unit}」.
// - 스크롤 max-h-40 · overflow-y-auto (긴 목록 대응).
// - getKey/renderItem 은 caller 제공 (item shape 이 dialog 마다 다름).

import type { ReactNode } from 'react';

export interface PreviewListProps<T> {
  items: T[];
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  unit?: string;
  limit?: number;
}

export function PreviewList<T>({
  items,
  getKey,
  renderItem,
  unit = '건',
  limit = 5,
}: PreviewListProps<T>) {
  const shown = items.slice(0, limit);
  const rest = items.length - limit;
  return (
    <ul className="text-small text-fg-secondary max-h-40 overflow-y-auto space-y-1">
      {shown.map((item) => (
        <li key={getKey(item)} className="font-mono">
          {renderItem(item)}
        </li>
      ))}
      {rest > 0 && <li className="text-fg-muted">... 외 {rest}{unit}</li>}
    </ul>
  );
}
