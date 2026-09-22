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

  // v0.219 R3 F-H: same-value setter 후 key 전환 시 persist flag 잔류로 인한 새 key 오염 없음.
  //                이전 flag 방식은 same-value setter → render skip → flag 남음 → 다음 key
  //                전환에서 이전 값을 새 key 에 저장하는 버그. 버전 카운터로 해결.
  it('R3 F-H: same-value setter 후 key 전환 시 새 key 오염 없음', () => {
    localStorage.setItem('k17-a', '100');
    const { result, rerender } = renderHook(
      ({ key }) => useLocalStorageState<number>(key, 100),
      { initialProps: { key: 'k17-a' } },
    );
    expect(result.current[0]).toBe(100);
    // Same-value setter (state 100 → 100 · React re-render 는 skip 되지만 effect fires).
    act(() => result.current[1](100));
    // k17-a 는 setter 로 저장됨.
    expect(localStorage.getItem('k17-a')).toBe('100');
    // key 전환. hydrate 만 · 저장 skip.
    rerender({ key: 'k17-b' });
    expect(localStorage.getItem('k17-b')).toBeNull();
  });

  // v0.219 R3 F-J: custom deserializer 를 A → B 로 변경 후 key 전환 hydrate 는 새 deserializer 사용.
  it('R3 F-J: deserializer A → B 변경 후 key 전환 hydrate 는 새 deserializer 사용', () => {
    const dA = (raw: string) => Number.parseInt(raw, 10) * 2; // custom A: doubles
    const dB = (raw: string) => Number.parseInt(raw, 10) * 3; // custom B: triples
    localStorage.setItem('k18-a', '5');
    localStorage.setItem('k18-b', '10');
    const { result, rerender } = renderHook(
      ({ des, key }: { des: (raw: string) => number | undefined; key: string }) =>
        useLocalStorageState<number>(key, 0, undefined, des),
      { initialProps: { des: dA, key: 'k18-a' } },
    );
    // dA: 5*2 = 10.
    expect(result.current[0]).toBe(10);
    // deserializer B 로 변경 + key 전환.
    rerender({ des: dB, key: 'k18-b' });
    // dB: 10*3 = 30.
    expect(result.current[0]).toBe(30);
  });

  // v0.219 R3 F-J: custom deserializer 를 undefined 로 되돌리면 다음 hydrate 에서 기본 JSON.parse.
  it('R3 F-J: deserializer 를 undefined 로 되돌리면 기본 JSON.parse 로 hydrate', () => {
    const custom = (raw: string) => Number.parseInt(raw, 10) * 2;
    localStorage.setItem('k19-a', '5');
    localStorage.setItem('k19-b', '15');
    const { result, rerender } = renderHook(
      ({
        des,
        key,
      }: {
        des: ((raw: string) => number | undefined) | undefined;
        key: string;
      }) => useLocalStorageState<number>(key, 0, undefined, des),
      {
        initialProps: {
          des: custom as ((raw: string) => number | undefined) | undefined,
          key: 'k19-a',
        },
      },
    );
    // custom: 5*2 = 10.
    expect(result.current[0]).toBe(10);
    // deserializer undefined + key 전환 → 기본 JSON.parse.
    rerender({ des: undefined, key: 'k19-b' });
    // JSON.parse('15') = 15.
    expect(result.current[0]).toBe(15);
  });

  // v0.219 R4 F-K: setter 와 key 변경이 한 배치일 때, setter 값은 setter 호출 시점의 key 에 저장.
  //                이전 구현은 effect 에서 최신 key/value closure 를 사용해 새 key 에 이전 값을
  //                오저장했음. pendingWriteRef 로 setter 호출 시점 snapshot 사용.
  it('R4 F-K: setter + key 변경이 한 배치 → setter 값은 이전 key 에 저장', () => {
    localStorage.setItem('k20-a', '10');
    localStorage.setItem('k20-b', '99');
    const { result, rerender } = renderHook(
      ({ key }) => useLocalStorageState<number>(key, 0),
      { initialProps: { key: 'k20-a' } },
    );
    expect(result.current[0]).toBe(10);
    // Setter (setter 시점 key = 'k20-a') · 곧이어 key 변경. 같은 act 안에 두 update.
    act(() => {
      result.current[1](200);
      rerender({ key: 'k20-b' });
    });
    // setter 는 이전 key 에 저장.
    expect(localStorage.getItem('k20-a')).toBe('200');
    // 새 key 는 오염되지 않음.
    expect(localStorage.getItem('k20-b')).toBe('99');
    // 최종 value 는 새 key 의 hydrated 값.
    expect(result.current[0]).toBe(99);
  });

  // v0.219 R4 F-K: setter 만 있고 key 변경 없어도 정상 동작 (regression 방지).
  it('R4 F-K: setter 만 (key 변경 없음) 는 여전히 현재 key 에 저장', () => {
    const { result } = renderHook(() => useLocalStorageState<number>('k21', 0));
    act(() => result.current[1](300));
    expect(localStorage.getItem('k21')).toBe('300');
    expect(result.current[0]).toBe(300);
  });
});
