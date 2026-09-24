import React, { useEffect } from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act, render, renderHook, fireEvent } from '@testing-library/react';
import { useColumnMenu, type UseColumnMenuReturn } from '../src/lib/useColumnMenu';

// v0.289: useColumnMenu hook (admin 컬럼 표시 popover menu · 8줄 shared).
// - state/callback 계약: renderHook 기반 (배선 개별 hook 은 각자의 unit test 로 이미 커버).
// - v0.289 R1 F-A: 배선 4개 hook 모두를 실제 DOM 을 통해 강제 (menuRef 를 진짜 DOM 노드에 붙임).
//   - useFocusTrap: open 진입 시 첫 focusable 자동 focus.
//   - useMenuArrowNav: ArrowDown/ArrowUp 이 focus 이동.
//   - useClickOutside/useEscapeKey: 외부 mousedown / Escape 로 close.
describe('useColumnMenu', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('초기 isOpen 은 false · buttonRef/menuRef 는 null', () => {
    const { result } = renderHook(() => useColumnMenu());
    expect(result.current.isOpen).toBe(false);
    expect(result.current.buttonRef.current).toBeNull();
    expect(result.current.menuRef.current).toBeNull();
  });

  it('open() 은 isOpen=true 로 만든다', () => {
    const { result } = renderHook(() => useColumnMenu());
    act(() => result.current.open());
    expect(result.current.isOpen).toBe(true);
  });

  it('close() 는 isOpen=false 로 만든다', () => {
    const { result } = renderHook(() => useColumnMenu());
    act(() => result.current.open());
    act(() => result.current.close());
    expect(result.current.isOpen).toBe(false);
  });

  it('toggle() 은 isOpen 을 반전 (false → true → false)', () => {
    const { result } = renderHook(() => useColumnMenu());
    act(() => result.current.toggle());
    expect(result.current.isOpen).toBe(true);
    act(() => result.current.toggle());
    expect(result.current.isOpen).toBe(false);
  });

  it('open/close/toggle 함수 참조는 render 사이 안정 (useCallback)', () => {
    const { result, rerender } = renderHook(() => useColumnMenu());
    const initialOpen = result.current.open;
    const initialClose = result.current.close;
    const initialToggle = result.current.toggle;
    rerender();
    expect(result.current.open).toBe(initialOpen);
    expect(result.current.close).toBe(initialClose);
    expect(result.current.toggle).toBe(initialToggle);
  });

  it('buttonRef / menuRef 는 render 사이 안정 (useRef)', () => {
    const { result, rerender } = renderHook(() => useColumnMenu());
    const initialButton = result.current.buttonRef;
    const initialMenu = result.current.menuRef;
    rerender();
    expect(result.current.buttonRef).toBe(initialButton);
    expect(result.current.menuRef).toBe(initialMenu);
  });

  it('배선된 useClickOutside 동작: 외부 mousedown 이 close 호출', () => {
    const outside = document.createElement('div');
    document.body.appendChild(outside);
    const { result } = renderHook(() => useColumnMenu());
    act(() => result.current.open());
    expect(result.current.isOpen).toBe(true);
    act(() => {
      outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(result.current.isOpen).toBe(false);
  });

  it('배선된 useEscapeKey 동작: Escape 가 close 호출', () => {
    const { result } = renderHook(() => useColumnMenu());
    act(() => result.current.open());
    expect(result.current.isOpen).toBe(true);
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(result.current.isOpen).toBe(false);
  });

  it('isOpen=false 이면 외부 mousedown / Escape 무시 (배선 hook enabled 전달)', () => {
    const outside = document.createElement('div');
    document.body.appendChild(outside);
    const { result } = renderHook(() => useColumnMenu());
    expect(result.current.isOpen).toBe(false);
    act(() => {
      outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(result.current.isOpen).toBe(false);
  });

  // v0.289 R1 F-A: 4개 배선 강제 (useFocusTrap · useMenuArrowNav 실제 DOM 회귀).
  // menuRef 를 실제 DOM 컨테이너에 attach 하고 hook 을 통과시켜 자동 focus + 방향키 이동 검증.
  function TestMenuHost({
    onReady,
  }: {
    onReady?: (menu: UseColumnMenuReturn) => void;
  }) {
    const menu = useColumnMenu();
    useEffect(() => {
      onReady?.(menu);
    }, [menu, onReady]);
    return (
      <div>
        <button
          ref={menu.buttonRef}
          data-testid="trigger"
          onClick={menu.toggle}
        >
          trigger
        </button>
        {menu.isOpen && (
          <div ref={menu.menuRef} data-testid="menu">
            <button data-testid="item-a">A</button>
            <button data-testid="item-b">B</button>
            <button data-testid="item-c">C</button>
          </div>
        )}
      </div>
    );
  }

  it('배선된 useFocusTrap 동작: open 진입 시 menu 내 첫 focusable 자동 focus', () => {
    let controls: UseColumnMenuReturn | null = null;
    render(<TestMenuHost onReady={(m) => (controls = m)} />);
    expect(controls).not.toBeNull();
    act(() => controls!.open());
    // useFocusTrap 이 배선 됐다면 open 후 첫 item 이 focus 됨.
    expect(document.activeElement?.getAttribute('data-testid')).toBe('item-a');
  });

  it('배선된 useMenuArrowNav 동작: ArrowDown 이 다음 focusable 로 이동', () => {
    let controls: UseColumnMenuReturn | null = null;
    const { getByTestId } = render(<TestMenuHost onReady={(m) => (controls = m)} />);
    act(() => controls!.open());
    (getByTestId('item-a') as HTMLButtonElement).focus();
    expect(document.activeElement?.getAttribute('data-testid')).toBe('item-a');
    act(() => {
      fireEvent.keyDown(document, { key: 'ArrowDown' });
    });
    expect(document.activeElement?.getAttribute('data-testid')).toBe('item-b');
  });
});
