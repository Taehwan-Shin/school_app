import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createRef } from 'react';
import { useClickOutside } from '../src/lib/useClickOutside';

describe('useClickOutside', () => {
  let container: HTMLElement;
  let inside: HTMLElement;
  let outside: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    inside = document.createElement('button');
    outside = document.createElement('div');
    container.appendChild(inside);
    document.body.appendChild(container);
    document.body.appendChild(outside);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('enabled=false 이면 handler 호출 안 함', () => {
    const ref = createRef<HTMLElement>();
    (ref as { current: HTMLElement | null }).current = inside;
    const handler = vi.fn();
    renderHook(() => useClickOutside([ref], handler, false));
    outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(handler).not.toHaveBeenCalled();
  });

  it('내부 클릭 → handler 호출 안 함', () => {
    const ref = createRef<HTMLElement>();
    (ref as { current: HTMLElement | null }).current = inside;
    const handler = vi.fn();
    renderHook(() => useClickOutside([ref], handler, true));
    inside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(handler).not.toHaveBeenCalled();
  });

  it('외부 클릭 → handler 호출', () => {
    const ref = createRef<HTMLElement>();
    (ref as { current: HTMLElement | null }).current = inside;
    const handler = vi.fn();
    renderHook(() => useClickOutside([ref], handler, true));
    outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('여러 ref 중 하나라도 내부면 handler 호출 안 함', () => {
    const ref1 = createRef<HTMLElement>();
    const ref2 = createRef<HTMLElement>();
    (ref1 as { current: HTMLElement | null }).current = inside;
    // 두 번째 ref 는 outside 를 감싸는 것으로 (그래서 outside 클릭도 「내부」 로 판정).
    (ref2 as { current: HTMLElement | null }).current = outside;
    const handler = vi.fn();
    renderHook(() => useClickOutside([ref1, ref2], handler, true));
    outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(handler).not.toHaveBeenCalled();
    // 완전 외부.
    const other = document.createElement('div');
    document.body.appendChild(other);
    other.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('unmount 시 리스너 제거 → 이후 클릭에 handler 미호출', () => {
    const ref = createRef<HTMLElement>();
    (ref as { current: HTMLElement | null }).current = inside;
    const handler = vi.fn();
    const { unmount } = renderHook(() => useClickOutside([ref], handler, true));
    unmount();
    outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(handler).not.toHaveBeenCalled();
  });
});
