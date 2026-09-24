import React, { useRef, useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { ColumnMenu, type ColumnMenuColumn } from '../src/components/ColumnMenu';

// v0.291: ColumnMenu 컴포넌트 (4 site 흡수: admin 3 + AuditLog).
// - testId prefix propagation
// - minimalPreset · onResetPreferences optional (admin=있음, audit-log=없음)
// - 트리거 라벨 「컬럼 표시 (N / M)」
// - 「전체 표시」 disabled 조건 = 전부 visible
// - 「전체 숨김」 disabled 조건 = 전부 hidden
// - 「간결」 disabled = isMinimalActive
// - checkbox aria-checked / testid 규범
// - onToggleColumn 콜백

type Col = 'a' | 'b' | 'c';

interface HostProps {
  prefix: string;
  initiallyOpen?: boolean;
  initialVisible?: Col[];
  withMinimalPreset?: boolean;
  withResetPreferences?: boolean;
  onResetSpy?: () => void;
  onToggleSpy?: (key: Col) => void;
  onShowAllSpy?: () => void;
  onHideAllSpy?: () => void;
  onMinimalSpy?: () => void;
  buttonSize?: 'sm' | 'default' | 'lg';
  className?: string;
}

const COLUMNS: readonly ColumnMenuColumn<Col>[] = [
  { key: 'a', label: 'Alpha' },
  { key: 'b', label: 'Bravo' },
  { key: 'c', label: 'Charlie' },
];

function Host({
  prefix,
  initiallyOpen = true,
  initialVisible = ['a', 'b', 'c'],
  withMinimalPreset = false,
  withResetPreferences = false,
  onResetSpy,
  onToggleSpy,
  onShowAllSpy,
  onHideAllSpy,
  onMinimalSpy,
  buttonSize,
  className,
}: HostProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(initiallyOpen);
  const [visible, setVisible] = useState<Set<Col>>(new Set(initialVisible));
  return (
    <ColumnMenu
      buttonRef={buttonRef}
      menuRef={menuRef}
      isOpen={isOpen}
      onToggle={() => setIsOpen((prev) => !prev)}
      columns={COLUMNS}
      visibleColumns={visible}
      onToggleColumn={(key) => {
        onToggleSpy?.(key);
        setVisible((prev) => {
          const next = new Set(prev);
          if (next.has(key)) next.delete(key);
          else next.add(key);
          return next;
        });
      }}
      onShowAll={() => {
        onShowAllSpy?.();
        setVisible(new Set(COLUMNS.map((c) => c.key)));
      }}
      onHideAll={() => {
        onHideAllSpy?.();
        setVisible(new Set());
      }}
      minimalPreset={
        withMinimalPreset
          ? { onApply: () => onMinimalSpy?.(), isActive: visible.size === 1 && visible.has('a') }
          : undefined
      }
      onResetPreferences={
        withResetPreferences ? (onResetSpy ?? (() => {})) : undefined
      }
      testIdPrefix={prefix}
      buttonSize={buttonSize}
      className={className}
    />
  );
}

describe('ColumnMenu', () => {
  it('트리거 버튼 라벨은 「컬럼 표시 (N / M)」 (기본)', () => {
    const { getByTestId } = render(<Host prefix="accounts" />);
    expect(getByTestId('accounts-column-menu-btn').textContent).toBe('컬럼 표시 (3 / 3)');
  });

  it('testIdPrefix 가 button/menu/toggle/reset 에 전파 (accounts)', () => {
    const { getByTestId } = render(<Host prefix="accounts" withMinimalPreset withResetPreferences />);
    expect(getByTestId('accounts-column-menu-btn')).toBeTruthy();
    expect(getByTestId('accounts-column-menu')).toBeTruthy();
    expect(getByTestId('accounts-column-show-all')).toBeTruthy();
    expect(getByTestId('accounts-column-hide-all')).toBeTruthy();
    expect(getByTestId('accounts-column-preset-minimal')).toBeTruthy();
    expect(getByTestId('accounts-reset-user-prefs')).toBeTruthy();
    expect(getByTestId('accounts-column-toggle-a')).toBeTruthy();
  });

  it('testIdPrefix=audit-log 은 audit-log-column-* 로 전파', () => {
    const { getByTestId, queryByTestId } = render(<Host prefix="audit-log" />);
    expect(getByTestId('audit-log-column-menu-btn')).toBeTruthy();
    expect(getByTestId('audit-log-column-menu')).toBeTruthy();
    expect(getByTestId('audit-log-column-show-all')).toBeTruthy();
    expect(getByTestId('audit-log-column-hide-all')).toBeTruthy();
    // 미전달이므로 minimal preset · reset user prefs 노드 없음.
    expect(queryByTestId('audit-log-column-preset-minimal')).toBeNull();
    expect(queryByTestId('audit-log-reset-user-prefs')).toBeNull();
  });

  it('isOpen=false 이면 팝오버 미렌더 (트리거만 노출)', () => {
    const { queryByTestId, getByTestId } = render(<Host prefix="groups" initiallyOpen={false} />);
    expect(getByTestId('groups-column-menu-btn')).toBeTruthy();
    expect(queryByTestId('groups-column-menu')).toBeNull();
  });

  it('전체 표시 quick action 은 이미 전부 visible 시 disabled', () => {
    const { getByTestId } = render(<Host prefix="classroom" initialVisible={['a', 'b', 'c']} />);
    expect(getByTestId('classroom-column-show-all').hasAttribute('disabled')).toBe(true);
  });

  it('전체 숨김 quick action 은 이미 전부 hidden 시 disabled', () => {
    const { getByTestId } = render(<Host prefix="classroom" initialVisible={[]} />);
    expect(getByTestId('classroom-column-hide-all').hasAttribute('disabled')).toBe(true);
  });

  it('간결 preset (minimalPreset.isActive=true) 은 disabled', () => {
    // Host 의 isActive 계산: visible=[a] 일 때 true.
    const { getByTestId } = render(
      <Host prefix="accounts" withMinimalPreset initialVisible={['a']} />,
    );
    expect(getByTestId('accounts-column-preset-minimal').hasAttribute('disabled')).toBe(true);
  });

  it('컬럼 체크박스 aria-checked 와 checked 는 visibleColumns 반영', () => {
    const { getByTestId } = render(<Host prefix="groups" initialVisible={['a']} />);
    const a = getByTestId('groups-column-toggle-a') as HTMLInputElement;
    const b = getByTestId('groups-column-toggle-b') as HTMLInputElement;
    expect(a.checked).toBe(true);
    expect(a.getAttribute('aria-checked')).toBe('true');
    expect(b.checked).toBe(false);
    expect(b.getAttribute('aria-checked')).toBe('false');
  });

  it('onToggleColumn 은 체크박스 onChange 시 key 를 인자로 호출', () => {
    const spy = vi.fn();
    const { getByTestId } = render(<Host prefix="groups" onToggleSpy={spy} />);
    fireEvent.click(getByTestId('groups-column-toggle-b'));
    expect(spy).toHaveBeenCalledWith('b');
  });

  it('onShowAll / onHideAll / minimalPreset.onApply / onResetPreferences 콜백', () => {
    const showAll = vi.fn();
    const hideAll = vi.fn();
    const minimal = vi.fn();
    const reset = vi.fn();
    const { getByTestId, rerender } = render(
      <Host
        prefix="accounts"
        withMinimalPreset
        withResetPreferences
        onShowAllSpy={showAll}
        onHideAllSpy={hideAll}
        onMinimalSpy={minimal}
        onResetSpy={reset}
        initialVisible={['a']}
      />,
    );
    // hide-all 은 initialVisible=['a'] 라 활성. 클릭 후 다시 렌더링 하여 show-all 은 initially [a] 이므로 활성.
    fireEvent.click(getByTestId('accounts-column-hide-all'));
    expect(hideAll).toHaveBeenCalledOnce();
    // 「간결」 은 initialVisible=['a'] 일 때 isActive=true 로 disabled → 다른 initial 로 rerender.
    rerender(
      <Host
        prefix="accounts"
        withMinimalPreset
        withResetPreferences
        onShowAllSpy={showAll}
        onHideAllSpy={hideAll}
        onMinimalSpy={minimal}
        onResetSpy={reset}
        initialVisible={['a', 'b']}
      />,
    );
    fireEvent.click(getByTestId('accounts-column-preset-minimal'));
    expect(minimal).toHaveBeenCalledOnce();
    fireEvent.click(getByTestId('accounts-column-show-all'));
    expect(showAll).toHaveBeenCalledOnce();
    fireEvent.click(getByTestId('accounts-reset-user-prefs'));
    expect(reset).toHaveBeenCalledOnce();
  });

  it('트리거 버튼 aria-expanded 는 isOpen 반영 · 초기 false + 클릭 후 true', () => {
    const { getByTestId } = render(<Host prefix="accounts" initiallyOpen={false} />);
    const btn = getByTestId('accounts-column-menu-btn');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
  });

  it('WAI-ARIA role 규범: menu / menuitem / menuitemcheckbox', () => {
    const { getByTestId, getAllByRole } = render(
      <Host prefix="accounts" withMinimalPreset withResetPreferences />,
    );
    expect(getByTestId('accounts-column-menu').getAttribute('role')).toBe('menu');
    // menuitem: 전체 표시 · 간결 · 전체 숨김 · 선호 초기화 = 4개.
    expect(getAllByRole('menuitem').length).toBe(4);
    expect(getAllByRole('menuitemcheckbox').length).toBe(COLUMNS.length);
  });

  it('className prop 은 wrapper 의 `relative` 뒤에 append (audit-log ml-2 케이스)', () => {
    const { getByTestId } = render(
      <Host prefix="audit-log" className="ml-2" initiallyOpen={false} />,
    );
    const wrapper = getByTestId('audit-log-column-menu-btn').parentElement;
    expect(wrapper?.className).toBe('relative ml-2');
  });

  it('buttonSize=sm 은 트리거 버튼 크기 (AuditLog 케이스, 하지만 기본은 default)', () => {
    // Button 크기 스타일은 sizeStyles.sm = "px-3 py-1.5 text-small" 임을 신뢰. 여기서는 prop 이 button 에
    // 전달되는지만 확인 (className 이 sm 스타일 포함).
    const { getByTestId } = render(<Host prefix="audit-log" buttonSize="sm" initiallyOpen={false} />);
    const btn = getByTestId('audit-log-column-menu-btn');
    expect(btn.className).toMatch(/px-3/);
    expect(btn.className).toMatch(/py-1\.5/);
  });
});
