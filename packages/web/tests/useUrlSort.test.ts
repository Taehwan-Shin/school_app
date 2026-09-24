import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useUrlSort, type SetSearchParamsFn } from '../src/lib/useUrlSort';

// v0.295: useUrlSort hook — URL 기반 sort state + localStorage hydrate/persist + handleSort shared.

type Col = 'name' | 'email' | 'age';
const VALID: readonly Col[] = ['name', 'email', 'age'];
const KEY = 'test.sort.v295';

describe('useUrlSort', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('sortColumn 파생: whitelist 안이면 그 값, 밖이면 null', () => {
    const setSearchParams: SetSearchParamsFn = vi.fn();
    const { result: r1 } = renderHook(() =>
      useUrlSort<Col>({
        storageKey: KEY,
        validColumns: VALID,
        searchParams: new URLSearchParams('sort=email'),
        setSearchParams,
      }),
    );
    expect(r1.current.sortColumn).toBe('email');

    const { result: r2 } = renderHook(() =>
      useUrlSort<Col>({
        storageKey: KEY,
        validColumns: VALID,
        searchParams: new URLSearchParams('sort=invalid'),
        setSearchParams,
      }),
    );
    expect(r2.current.sortColumn).toBeNull();

    const { result: r3 } = renderHook(() =>
      useUrlSort<Col>({
        storageKey: KEY,
        validColumns: VALID,
        searchParams: new URLSearchParams(),
        setSearchParams,
      }),
    );
    expect(r3.current.sortColumn).toBeNull();
  });

  it('sortDirection 파생: dir=desc 면 desc, 그 외는 asc', () => {
    const setSearchParams: SetSearchParamsFn = vi.fn();
    const { result: r1 } = renderHook(() =>
      useUrlSort<Col>({
        storageKey: KEY,
        validColumns: VALID,
        searchParams: new URLSearchParams('sort=name&dir=desc'),
        setSearchParams,
      }),
    );
    expect(r1.current.sortDirection).toBe('desc');

    const { result: r2 } = renderHook(() =>
      useUrlSort<Col>({
        storageKey: KEY,
        validColumns: VALID,
        searchParams: new URLSearchParams('sort=name&dir=asc'),
        setSearchParams,
      }),
    );
    expect(r2.current.sortDirection).toBe('asc');

    const { result: r3 } = renderHook(() =>
      useUrlSort<Col>({
        storageKey: KEY,
        validColumns: VALID,
        searchParams: new URLSearchParams('sort=name'),
        setSearchParams,
      }),
    );
    expect(r3.current.sortDirection).toBe('asc');
  });

  it('Mount hydrate: URL 비어 있고 localStorage 저장값 있으면 URL 로 이식', () => {
    localStorage.setItem(KEY, JSON.stringify({ sort: 'email', dir: 'desc' }));
    const setSearchParams = vi.fn();
    renderHook(() =>
      useUrlSort<Col>({
        storageKey: KEY,
        validColumns: VALID,
        searchParams: new URLSearchParams(),
        setSearchParams,
      }),
    );
    expect(setSearchParams).toHaveBeenCalledOnce();
    const [next, opts] = setSearchParams.mock.calls[0];
    expect((next as URLSearchParams).get('sort')).toBe('email');
    expect((next as URLSearchParams).get('dir')).toBe('desc');
    expect(opts).toEqual({ replace: true });
  });

  it('Mount hydrate: URL 에 이미 sort 있으면 localStorage 무시 (URL authoritative)', () => {
    localStorage.setItem(KEY, JSON.stringify({ sort: 'email', dir: 'desc' }));
    const setSearchParams = vi.fn();
    renderHook(() =>
      useUrlSort<Col>({
        storageKey: KEY,
        validColumns: VALID,
        searchParams: new URLSearchParams('sort=name&dir=asc'),
        setSearchParams,
      }),
    );
    // URL 에 sort 있으면 setSearchParams 는 persist effect 로 인해 나중에 호출되지만,
    // mount hydrate 는 안 함. persist effect 는 setStoredSort 만 호출.
    // → setSearchParams 는 아예 호출 안 됨.
    expect(setSearchParams).not.toHaveBeenCalled();
  });

  it('Mount hydrate: localStorage 저장값의 sort 가 whitelist 밖이면 무시', () => {
    localStorage.setItem(KEY, JSON.stringify({ sort: 'invalid', dir: 'desc' }));
    const setSearchParams = vi.fn();
    renderHook(() =>
      useUrlSort<Col>({
        storageKey: KEY,
        validColumns: VALID,
        searchParams: new URLSearchParams(),
        setSearchParams,
      }),
    );
    // sort 는 whitelist 밖 → 안 이식. dir 은 유효 → 이식.
    if (setSearchParams.mock.calls.length > 0) {
      const next = setSearchParams.mock.calls[0][0] as URLSearchParams;
      expect(next.has('sort')).toBe(false);
      expect(next.get('dir')).toBe('desc');
    }
  });

  it('Persist effect: sortColumn 있으면 { sort, dir } 저장', () => {
    const setSearchParams = vi.fn();
    renderHook(() =>
      useUrlSort<Col>({
        storageKey: KEY,
        validColumns: VALID,
        searchParams: new URLSearchParams('sort=email&dir=desc'),
        setSearchParams,
      }),
    );
    expect(localStorage.getItem(KEY)).toBe(JSON.stringify({ sort: 'email', dir: 'desc' }));
  });

  it('Persist effect: sortColumn null 이면 「null」 저장', () => {
    const setSearchParams = vi.fn();
    renderHook(() =>
      useUrlSort<Col>({
        storageKey: KEY,
        validColumns: VALID,
        searchParams: new URLSearchParams(),
        setSearchParams,
      }),
    );
    expect(localStorage.getItem(KEY)).toBe('null');
  });

  it('handleSort: 같은 컬럼이면 dir 토글 (asc → desc, desc → asc)', () => {
    const setSearchParams = vi.fn();
    const { result } = renderHook(() =>
      useUrlSort<Col>({
        storageKey: KEY,
        validColumns: VALID,
        searchParams: new URLSearchParams('sort=name&dir=asc'),
        setSearchParams,
      }),
    );
    act(() => result.current.handleSort('name'));
    const [next] = setSearchParams.mock.calls[setSearchParams.mock.calls.length - 1];
    expect((next as URLSearchParams).get('sort')).toBe('name');
    expect((next as URLSearchParams).get('dir')).toBe('desc');
  });

  it('handleSort: 다른 컬럼이면 그 컬럼으로 asc', () => {
    const setSearchParams = vi.fn();
    const { result } = renderHook(() =>
      useUrlSort<Col>({
        storageKey: KEY,
        validColumns: VALID,
        searchParams: new URLSearchParams('sort=name&dir=desc'),
        setSearchParams,
      }),
    );
    act(() => result.current.handleSort('email'));
    const [next, opts] = setSearchParams.mock.calls[setSearchParams.mock.calls.length - 1];
    expect((next as URLSearchParams).get('sort')).toBe('email');
    expect((next as URLSearchParams).get('dir')).toBe('asc');
    expect(opts).toEqual({ replace: false });
  });

  it('handleSort: 처음 클릭 (sortColumn=null) → 그 컬럼으로 asc', () => {
    const setSearchParams = vi.fn();
    const { result } = renderHook(() =>
      useUrlSort<Col>({
        storageKey: KEY,
        validColumns: VALID,
        searchParams: new URLSearchParams(),
        setSearchParams,
      }),
    );
    act(() => result.current.handleSort('age'));
    const [next] = setSearchParams.mock.calls[setSearchParams.mock.calls.length - 1];
    expect((next as URLSearchParams).get('sort')).toBe('age');
    expect((next as URLSearchParams).get('dir')).toBe('asc');
  });

  it('handleSort: 기존 param (page 등) 보존', () => {
    const setSearchParams = vi.fn();
    const { result } = renderHook(() =>
      useUrlSort<Col>({
        storageKey: KEY,
        validColumns: VALID,
        searchParams: new URLSearchParams('sort=name&dir=asc&page=3&q=test'),
        setSearchParams,
      }),
    );
    act(() => result.current.handleSort('email'));
    const [next] = setSearchParams.mock.calls[setSearchParams.mock.calls.length - 1];
    expect((next as URLSearchParams).get('page')).toBe('3');
    expect((next as URLSearchParams).get('q')).toBe('test');
  });
});
