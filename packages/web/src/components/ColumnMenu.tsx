import type { RefObject } from 'react';
import { Button } from './ui/button';

// v0.291: admin 4 테이블 (Accounts/Groups/Classroom/AuditLog) 컬럼 표시 popover shared.
// - 트리거 버튼 「컬럼 표시 (N / M)」 + 팝오버 (전체 표시 · [간결?] · 전체 숨김 quick actions +
//   컬럼 체크박스 목록 + [선호 초기화?])
// - useColumnMenu hook 반환값 (isOpen/toggle/buttonRef/menuRef) 을 그대로 props 로 받음.
// - testIdPrefix: 'accounts' | 'groups' | 'classroom' | 'audit-log'
//   → data-testid 는 `${prefix}-column-menu-btn` · `${prefix}-column-menu` ·
//     `${prefix}-column-show-all` · `${prefix}-column-hide-all` ·
//     `${prefix}-column-toggle-${key}` 로 규범화.
//   반드시 「선호 초기화」 는 `${prefix}-reset-user-prefs` (column- 접두사 없음, admin 3 기존과 일치).
// - minimalPreset · onResetPreferences 는 optional. admin 3 (v0.205/v0.207) 은 둘 다 전달,
//   AuditLog 는 둘 다 미전달 (원본 v0.216 이후 미도입).
// - WAI-ARIA: 트리거 button 은 aria-expanded · aria-haspopup="menu" · title, menu container 는
//   role="menu" · aria-label · quick actions role="menuitem", 컬럼 체크박스 role="menuitemcheckbox".
//   방향키·Escape·focus trap 은 useColumnMenu 의 배선 hook 이 담당.

export interface ColumnMenuColumn<K extends string> {
  key: K;
  label: string;
}

export interface ColumnMenuMinimalPreset {
  onApply: () => void;
  isActive: boolean;
}

export interface ColumnMenuProps<K extends string> {
  buttonRef: RefObject<HTMLButtonElement>;
  menuRef: RefObject<HTMLDivElement>;
  isOpen: boolean;
  onToggle: () => void;
  columns: readonly ColumnMenuColumn<K>[];
  visibleColumns: Set<K>;
  onToggleColumn: (key: K) => void;
  onShowAll: () => void;
  onHideAll: () => void;
  minimalPreset?: ColumnMenuMinimalPreset;
  onResetPreferences?: () => void;
  testIdPrefix: string;
  buttonSize?: 'sm' | 'default' | 'lg';
  className?: string;
}

export function ColumnMenu<K extends string>({
  buttonRef,
  menuRef,
  isOpen,
  onToggle,
  columns,
  visibleColumns,
  onToggleColumn,
  onShowAll,
  onHideAll,
  minimalPreset,
  onResetPreferences,
  testIdPrefix,
  buttonSize,
  className,
}: ColumnMenuProps<K>) {
  const allVisible = visibleColumns.size === columns.length;
  const allHidden = visibleColumns.size === 0;
  const wrapperClass = className ? `relative ${className}` : 'relative';
  return (
    <div className={wrapperClass}>
      <Button
        ref={buttonRef}
        variant="secondary"
        size={buttonSize}
        onClick={onToggle}
        data-testid={`${testIdPrefix}-column-menu-btn`}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        title="컬럼 표시 여부 선택"
      >
        컬럼 표시 ({visibleColumns.size} / {columns.length})
      </Button>
      {isOpen && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="컬럼 표시"
          data-testid={`${testIdPrefix}-column-menu`}
          className="absolute right-0 mt-1 z-10 border border-border-subtle bg-canvas shadow-lg py-2 min-w-40"
        >
          <div className="flex flex-wrap gap-1 px-3 pb-2 border-b border-border-subtle mb-1">
            <button
              type="button"
              role="menuitem"
              onClick={onShowAll}
              disabled={allVisible}
              data-testid={`${testIdPrefix}-column-show-all`}
              className="text-micro text-fg-primary underline hover:text-fg-secondary disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline"
            >
              전체 표시
            </button>
            {minimalPreset && (
              <>
                <span className="text-micro text-fg-muted" aria-hidden="true">
                  ·
                </span>
                <button
                  type="button"
                  role="menuitem"
                  onClick={minimalPreset.onApply}
                  disabled={minimalPreset.isActive}
                  data-testid={`${testIdPrefix}-column-preset-minimal`}
                  className="text-micro text-fg-primary underline hover:text-fg-secondary disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline"
                  title="이름 컬럼만 표시 (다른 선택 컬럼 숨김)"
                >
                  간결
                </button>
              </>
            )}
            <span className="text-micro text-fg-muted" aria-hidden="true">
              ·
            </span>
            <button
              type="button"
              role="menuitem"
              onClick={onHideAll}
              disabled={allHidden}
              data-testid={`${testIdPrefix}-column-hide-all`}
              className="text-micro text-fg-primary underline hover:text-fg-secondary disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline"
            >
              전체 숨김
            </button>
          </div>
          {columns.map(({ key, label }) => (
            <label
              key={key}
              className="flex items-center gap-2 px-3 py-1 text-small text-fg-primary cursor-pointer hover:bg-surface"
            >
              <input
                type="checkbox"
                role="menuitemcheckbox"
                aria-checked={visibleColumns.has(key)}
                checked={visibleColumns.has(key)}
                onChange={() => onToggleColumn(key)}
                data-testid={`${testIdPrefix}-column-toggle-${key}`}
                className="cursor-pointer"
              />
              {label}
            </label>
          ))}
          {onResetPreferences && (
            <div className="border-t border-border-subtle mt-1 pt-2 px-3">
              <button
                type="button"
                role="menuitem"
                onClick={onResetPreferences}
                data-testid={`${testIdPrefix}-reset-user-prefs`}
                className="text-micro text-fg-primary underline hover:text-fg-secondary"
                title="이 테이블의 정렬 · 페이지 크기 · 컬럼 표시 선호를 모두 기본값으로"
              >
                선호 초기화
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
