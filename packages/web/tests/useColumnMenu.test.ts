import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useColumnMenu } from '../src/lib/useColumnMenu';

// v0.289: useColumnMenu hook (admin 컬럼 표시 popover menu · 8줄 shared).
// - initial isOpen=false · open/close/toggle 계약 · ref 안정성 · 4 hook 배선 통합 검증.
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
});
