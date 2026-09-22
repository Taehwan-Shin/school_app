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

  // v0.219 R1 F-A: `SetStateAction<T>` (functional updater) 지원.
  it('R1 F-A: functional updater 지원 (setValue(prev => ...))', () => {
    localStorage.setItem('k9', '10');
    const { result } = renderHook(() => useLocalStorageState<number>('k9', 0));
    expect(result.current[0]).toBe(10);
    act(() => result.current[1]((prev) => prev + 5));
    expect(result.current[0]).toBe(15);
    expect(localStorage.getItem('k9')).toBe('15');
    act(() => result.current[1]((prev) => prev * 2));
    expect(result.current[0]).toBe(30);
    expect(localStorage.getItem('k9')).toBe('30');
  });

  // v0.219 R1 F-C: key prop 변경 시 새 key 로 재 hydrate.
  it('R1 F-C: key 변경 시 새 key 값 재 hydrate', () => {
    localStorage.setItem('k10-a', '100');
    localStorage.setItem('k10-b', '200');
    const { result, rerender } = renderHook(
      ({ key }) => useLocalStorageState<number>(key, 25),
      { initialProps: { key: 'k10-a' } },
    );
    expect(result.current[0]).toBe(100);
    rerender({ key: 'k10-b' });
    expect(result.current[0]).toBe(200);
    // 새 key setter 는 새 key 에 저장.
    act(() => result.current[1](500));
    expect(localStorage.getItem('k10-b')).toBe('500');
    expect(localStorage.getItem('k10-a')).toBe('100');
  });

  it('R1 F-C: key 를 저장값 없는 key 로 변경 → defaultValue fallback', () => {
    localStorage.setItem('k11-a', '100');
    const { result, rerender } = renderHook(
      ({ key }) => useLocalStorageState<number>(key, 25),
      { initialProps: { key: 'k11-a' } },
    );
    expect(result.current[0]).toBe(100);
    rerender({ key: 'k11-b' });
    // k11-b 에 저장값 없음 → default 25.
    expect(result.current[0]).toBe(25);
  });

  // v0.219 R1 F-D: getItem 예외 (SecurityError · SSR 등) → defaultValue fallback.
  it('R1 F-D: localStorage.getItem 예외 → defaultValue fallback', () => {
    const original = localStorage.getItem;
    (localStorage as { getItem: unknown }).getItem = () => {
      throw new Error('SecurityError');
    };
    const { result } = renderHook(() => useLocalStorageState<number>('k12', 25));
    expect(result.current[0]).toBe(25);
    localStorage.getItem = original;
  });

  // v0.219 R2 F-E: custom serializer 를 undefined 로 되돌리면 기본 JSON serializer 로 복원.
  it('R2 F-E: serializer prop 을 undefined 로 되돌리면 기본 JSON serializer 사용', () => {
    const custom = (v: number) => `X:${v}`;
    const { result, rerender } = renderHook(
      ({ ser }: { ser: ((v: number) => string) | undefined }) =>
        useLocalStorageState<number>('k13', 0, ser),
      { initialProps: { ser: custom as ((v: number) => string) | undefined } },
    );
    act(() => result.current[1](5));
    expect(localStorage.getItem('k13')).toBe('X:5');
    rerender({ ser: undefined });
    act(() => result.current[1](15));
    // 기본 JSON serializer 로 복원됨.
    expect(localStorage.getItem('k13')).toBe('15');
  });

  // v0.219 R2 F-G: custom serializer 를 다른 custom 으로 변경하면 새 함수로 저장.
  it('R2 F-G: serializer 를 A → B 로 변경하면 새 serializer 사용', () => {
    const sA = (v: number) => `A:${v}`;
    const sB = (v: number) => `B:${v}`;
    const { result, rerender } = renderHook(
      ({ ser }: { ser: (v: number) => string }) =>
        useLocalStorageState<number>('k14', 0, ser),
      { initialProps: { ser: sA } },
    );
    act(() => result.current[1](10));
    expect(localStorage.getItem('k14')).toBe('A:10');
    rerender({ ser: sB });
    act(() => result.current[1](20));
    expect(localStorage.getItem('k14')).toBe('B:20');
  });

  // v0.219 R2 F-F: mount 초기값 · key 전환 hydrate 는 저장하지 않음 (setter 호출 시에만).
  it('R2 F-F: mount 시 defaultValue 를 자동 저장하지 않음', () => {
    const { result } = renderHook(() => useLocalStorageState<number>('k15', 42));
    expect(result.current[0]).toBe(42);
    // setter 호출 안 함 → localStorage 무변경.
    expect(localStorage.getItem('k15')).toBeNull();
  });

  it('R2 F-F: key 전환 시 새 key 로 저장 트리거하지 않음', () => {
    localStorage.setItem('k16-a', '100');
    const { rerender } = renderHook(
      ({ key }) => useLocalStorageState<number>(key, 25),
      { initialProps: { key: 'k16-a' } },
    );
    expect(localStorage.getItem('k16-b')).toBeNull();
    rerender({ key: 'k16-b' });
    // k16-b hydrate (default 25) 만 · 저장 skip → 여전히 null.
    expect(localStorage.getItem('k16-b')).toBeNull();
  });
});
