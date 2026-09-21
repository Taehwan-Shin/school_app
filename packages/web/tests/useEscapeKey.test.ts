import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useEscapeKey } from '../src/lib/useEscapeKey';

describe('useEscapeKey', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('enabled=false 이면 Escape 눌러도 handler 미호출', () => {
    const handler = vi.fn();
    renderHook(() => useEscapeKey(handler, false));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(handler).not.toHaveBeenCalled();
  });

  it('enabled=true + Escape → handler 호출', () => {
    const handler = vi.fn();
    renderHook(() => useEscapeKey(handler, true));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('다른 키 (Enter, Space) → handler 미호출', () => {
    const handler = vi.fn();
    renderHook(() => useEscapeKey(handler, true));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    expect(handler).not.toHaveBeenCalled();
  });

  it('unmount 시 리스너 제거', () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() => useEscapeKey(handler, true));
    unmount();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(handler).not.toHaveBeenCalled();
  });
});
