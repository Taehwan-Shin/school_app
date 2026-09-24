import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useVisibleColumns } from '../src/lib/useVisibleColumns';
import {
  serializeVisibleColumns,
  makeVisibleColumnsDeserializer,
} from '../src/lib/visibleColumnsStorage';

// v0.292: useVisibleColumns hook — 컬럼 표시 여부 (Set<K>) + 4 helper shared.

type Col = 'a' | 'b' | 'c';
const COLUMNS = [
  { key: 'a' as Col, label: 'Alpha' },
  { key: 'b' as Col, label: 'Bravo' },
  { key: 'c' as Col, label: 'Charlie' },
];
const KEY = 'test.visibleColumns.v292';

const deserialize = makeVisibleColumnsDeserializer<Col>(['a', 'b', 'c']);

describe('useVisibleColumns', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('초기값: defaults 로 hydrate · localStorage 없을 때', () => {
    const { result } = renderHook(() =>
      useVisibleColumns<Col>({
        storageKey: KEY,
        columns: COLUMNS,
        defaults: ['a'],
        serialize: serializeVisibleColumns,
        deserialize,
      }),
    );
    expect(result.current.visibleColumns).toEqual(new Set<Col>(['a']));
  });

  it('localStorage 값이 있으면 그 값으로 hydrate', () => {
    localStorage.setItem(KEY, JSON.stringify(['b', 'c']));
    const { result } = renderHook(() =>
      useVisibleColumns<Col>({
        storageKey: KEY,
        columns: COLUMNS,
        defaults: ['a'],
        serialize: serializeVisibleColumns,
        deserialize,
      }),
    );
    expect(result.current.visibleColumns).toEqual(new Set<Col>(['b', 'c']));
  });

  it('toggleColumn: 없으면 추가, 있으면 제거', () => {
    const { result } = renderHook(() =>
      useVisibleColumns<Col>({
        storageKey: KEY,
        columns: COLUMNS,
        defaults: ['a'],
        serialize: serializeVisibleColumns,
        deserialize,
      }),
    );
    act(() => result.current.toggleColumn('b'));
    expect(result.current.visibleColumns).toEqual(new Set<Col>(['a', 'b']));
    act(() => result.current.toggleColumn('a'));
    expect(result.current.visibleColumns).toEqual(new Set<Col>(['b']));
  });

  it('setAllVisible(true): 모든 columns 표시', () => {
    const { result } = renderHook(() =>
      useVisibleColumns<Col>({
        storageKey: KEY,
        columns: COLUMNS,
        defaults: ['a'],
        serialize: serializeVisibleColumns,
        deserialize,
      }),
    );
    act(() => result.current.setAllVisible(true));
    expect(result.current.visibleColumns).toEqual(new Set<Col>(['a', 'b', 'c']));
  });

  it('setAllVisible(false): 모두 숨김', () => {
    const { result } = renderHook(() =>
      useVisibleColumns<Col>({
        storageKey: KEY,
        columns: COLUMNS,
        defaults: ['a', 'b', 'c'],
        serialize: serializeVisibleColumns,
        deserialize,
      }),
    );
    act(() => result.current.setAllVisible(false));
    expect(result.current.visibleColumns).toEqual(new Set<Col>());
  });

  it('applyMinimalPreset: minimalKeys 로 정확히 셋팅', () => {
    const { result } = renderHook(() =>
      useVisibleColumns<Col>({
        storageKey: KEY,
        columns: COLUMNS,
        defaults: ['a', 'b', 'c'],
        serialize: serializeVisibleColumns,
        deserialize,
        minimalKeys: ['a'],
      }),
    );
    act(() => result.current.applyMinimalPreset());
    expect(result.current.visibleColumns).toEqual(new Set<Col>(['a']));
  });

  it('isMinimalActive: visibleColumns 가 정확히 minimalKeys 와 일치할 때 true', () => {
    const { result } = renderHook(() =>
      useVisibleColumns<Col>({
        storageKey: KEY,
        columns: COLUMNS,
        defaults: ['a'],
        serialize: serializeVisibleColumns,
        deserialize,
        minimalKeys: ['a'],
      }),
    );
    expect(result.current.isMinimalActive).toBe(true);
    act(() => result.current.toggleColumn('b'));
    expect(result.current.isMinimalActive).toBe(false);
  });

  it('minimalKeys 미전달: applyMinimalPreset 은 no-op · isMinimalActive 항상 false', () => {
    const { result } = renderHook(() =>
      useVisibleColumns<Col>({
        storageKey: KEY,
        columns: COLUMNS,
        defaults: ['a'],
        serialize: serializeVisibleColumns,
        deserialize,
      }),
    );
    const before = new Set(result.current.visibleColumns);
    act(() => result.current.applyMinimalPreset());
    expect(result.current.visibleColumns).toEqual(before);
    expect(result.current.isMinimalActive).toBe(false);
  });

  it('setVisibleColumns: 직접 state 갱신 지원 (localStorage 반영)', () => {
    const { result } = renderHook(() =>
      useVisibleColumns<Col>({
        storageKey: KEY,
        columns: COLUMNS,
        defaults: ['a'],
        serialize: serializeVisibleColumns,
        deserialize,
      }),
    );
    act(() => result.current.setVisibleColumns(new Set<Col>(['a', 'b', 'c'])));
    expect(result.current.visibleColumns).toEqual(new Set<Col>(['a', 'b', 'c']));
  });

  it('helper 함수 참조는 render 사이 안정 (useCallback · stable deps)', () => {
    // 실 caller (admin 4 테이블) 는 module-scope 상수를 사용 → 참조 안정. 여기서도 그 조건을 재현.
    const stableDefaults: readonly Col[] = ['a'];
    const stableMinimal: readonly Col[] = ['a'];
    const { result, rerender } = renderHook(() =>
      useVisibleColumns<Col>({
        storageKey: KEY,
        columns: COLUMNS,
        defaults: stableDefaults,
        serialize: serializeVisibleColumns,
        deserialize,
        minimalKeys: stableMinimal,
      }),
    );
    const t0 = result.current.toggleColumn;
    const s0 = result.current.setAllVisible;
    const m0 = result.current.applyMinimalPreset;
    rerender();
    expect(result.current.toggleColumn).toBe(t0);
    expect(result.current.setAllVisible).toBe(s0);
    expect(result.current.applyMinimalPreset).toBe(m0);
  });

  it('minimalKeys 가 2개 이상: 정확히 그 집합일 때만 isMinimalActive=true', () => {
    const { result } = renderHook(() =>
      useVisibleColumns<Col>({
        storageKey: KEY,
        columns: COLUMNS,
        defaults: ['a', 'b'],
        serialize: serializeVisibleColumns,
        deserialize,
        minimalKeys: ['a', 'b'],
      }),
    );
    expect(result.current.isMinimalActive).toBe(true);
    act(() => result.current.toggleColumn('c'));
    expect(result.current.isMinimalActive).toBe(false);
  });
});
