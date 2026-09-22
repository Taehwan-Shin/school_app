import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutoDismissBanner } from '../src/lib/useAutoDismissBanner';

describe('useAutoDismissBanner (v0.226)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('초기값 null', () => {
    const { result } = renderHook(() => useAutoDismissBanner());
    expect(result.current.message).toBeNull();
  });

  it('show → message 설정 · ms 후 null', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useAutoDismissBanner());
    act(() => result.current.show('완료됨'));
    expect(result.current.message).toBe('완료됨');
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.message).toBeNull();
  });

  it('커스텀 ms', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useAutoDismissBanner());
    act(() => result.current.show('짧게', 500));
    expect(result.current.message).toBe('짧게');
    act(() => vi.advanceTimersByTime(499));
    expect(result.current.message).toBe('짧게');
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.message).toBeNull();
  });

  it('중복 show → 이전 timer 취소 · 새 message 로 대체', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useAutoDismissBanner());
    act(() => result.current.show('첫 번째'));
    act(() => vi.advanceTimersByTime(1000));
    // 1000ms 지난 상태에서 새 show → 새 timer 로 리셋.
    act(() => result.current.show('두 번째'));
    expect(result.current.message).toBe('두 번째');
    // 이전 timer 로 1500ms 더 (총 2500ms) 도달해도 두 번째는 유지 (자체 timer 는 500ms).
    act(() => vi.advanceTimersByTime(1500));
    expect(result.current.message).toBe('두 번째');
    // 두 번째의 자체 timer 2000ms 만료 → null.
    act(() => vi.advanceTimersByTime(500));
    expect(result.current.message).toBeNull();
  });

  it('clear() → 즉시 dismiss + pending timer 취소', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useAutoDismissBanner());
    act(() => result.current.show('취소 대상'));
    expect(result.current.message).toBe('취소 대상');
    act(() => result.current.clear());
    expect(result.current.message).toBeNull();
    // 남은 pending timer 는 취소됐어야.
    act(() => vi.advanceTimersByTime(3000));
    expect(result.current.message).toBeNull();
  });

  it('unmount → pending timer 정리 (state update 안 함)', () => {
    vi.useFakeTimers();
    const { result, unmount } = renderHook(() => useAutoDismissBanner());
    act(() => result.current.show('unmount 전'));
    expect(result.current.message).toBe('unmount 전');
    // unmount 후 timer 발화 (실제로는 clearTimeout 됨).
    unmount();
    // vi.advanceTimersByTime 실행 시 React setState-on-unmounted 경고 없이 진행.
    expect(() => {
      vi.advanceTimersByTime(3000);
    }).not.toThrow();
  });
});
