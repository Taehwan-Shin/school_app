import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocalStorageState } from '../src/lib/useLocalStorageState';

describe('useLocalStorageState (v0.219)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('mount 시 localStorage 값 없으면 defaultValue', () => {
    const { result } = renderHook(() => useLocalStorageState<number>('k1', 25));
    expect(result.current[0]).toBe(25);
  });

  it('mount 시 localStorage 저장값 (JSON) 을 hydrate', () => {
    localStorage.setItem('k2', '50');
    const { result } = renderHook(() => useLocalStorageState<number>('k2', 25));
    expect(result.current[0]).toBe(50);
  });

  it('setValue 는 state 갱신 + localStorage 저장', () => {
    const { result } = renderHook(() => useLocalStorageState<number>('k3', 25));
    act(() => result.current[1](100));
    expect(result.current[0]).toBe(100);
    expect(localStorage.getItem('k3')).toBe('100');
  });

  it('손상된 JSON → defaultValue', () => {
    localStorage.setItem('k4', '{invalid json');
    const { result } = renderHook(() => useLocalStorageState<number>('k4', 25));
    expect(result.current[0]).toBe(25);
  });

  it('deserialize 반환 undefined → defaultValue', () => {
    localStorage.setItem('k5', 'raw-value');
    const { result } = renderHook(() =>
      useLocalStorageState<number>(
        'k5',
        25,
        (v) => String(v),
        (raw) => {
          const n = Number.parseInt(raw, 10);
          return Number.isNaN(n) ? undefined : n;
        },
      ),
    );
    expect(result.current[0]).toBe(25);
  });

  it('커스텀 serialize/deserialize — 숫자를 raw string 으로 저장', () => {
    const { result } = renderHook(() =>
      useLocalStorageState<number>(
        'k6',
        25,
        (v) => String(v),
        (raw) => {
          const n = Number.parseInt(raw, 10);
          return Number.isNaN(n) ? undefined : n;
        },
      ),
    );
    act(() => result.current[1](50));
    expect(result.current[0]).toBe(50);
    // JSON.stringify(50) 이 아니라 '50' 로 저장.
    expect(localStorage.getItem('k6')).toBe('50');
  });

  it('JSON 배열 저장 (default serialize)', () => {
    const { result } = renderHook(() =>
      useLocalStorageState<string[]>('k7', []),
    );
    act(() => result.current[1](['a', 'b']));
    expect(result.current[0]).toEqual(['a', 'b']);
    expect(localStorage.getItem('k7')).toBe('["a","b"]');
  });

  it('localStorage.setItem 예외 → state 갱신은 유지 · 저장만 실패', () => {
    const original = localStorage.setItem;
    (localStorage as { setItem: unknown }).setItem = () => {
      throw new Error('quota exceeded');
    };
    const { result } = renderHook(() => useLocalStorageState<number>('k8', 25));
    act(() => result.current[1](100));
    // state 는 갱신됨.
    expect(result.current[0]).toBe(100);
    localStorage.setItem = original;
  });
});
