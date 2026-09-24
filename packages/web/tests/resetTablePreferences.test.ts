import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  resetTablePreferences,
  RESET_TABLE_PREFERENCES_CONFIRM_MESSAGE,
  RESET_TABLE_PREFERENCES_BANNER_MESSAGE,
} from '../src/lib/resetTablePreferences';

// v0.294: resetTablePreferences helper 계약 회귀.
// - window.confirm 취소 시 no-op · 승인 시 localStorage / URL / resetState / onAfterReset 순
// - localStorage.removeItem 예외는 조용히 무시
// - URLSearchParams: 'sort' + 'dir' 만 삭제 (다른 param 보존)
// - onAfterReset optional
// - 반환값: 승인 true · 취소 false

describe('resetTablePreferences', () => {
  const originalConfirm = window.confirm;

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    window.confirm = originalConfirm;
  });

  it('confirm 취소 시 아무 것도 안 함 · false 반환', () => {
    window.confirm = vi.fn(() => false);
    const setSearchParams = vi.fn();
    const resetState = vi.fn();
    const onAfterReset = vi.fn();
    localStorage.setItem('sort.v1', '{"key":"name"}');

    const result = resetTablePreferences({
      sortStorageKey: 'sort.v1',
      searchParams: new URLSearchParams('sort=name&dir=asc&other=keep'),
      setSearchParams,
      resetState,
      onAfterReset,
    });

    expect(result).toBe(false);
    expect(setSearchParams).not.toHaveBeenCalled();
    expect(resetState).not.toHaveBeenCalled();
    expect(onAfterReset).not.toHaveBeenCalled();
    expect(localStorage.getItem('sort.v1')).toBe('{"key":"name"}');
  });

  it('confirm 승인 시 localStorage 제거 → resetState → URL cleanup → onAfterReset 순서', () => {
    window.confirm = vi.fn(() => true);
    const calls: string[] = [];
    const setSearchParams = vi.fn(() => calls.push('setSearchParams'));
    const resetState = vi.fn(() => calls.push('resetState'));
    const onAfterReset = vi.fn(() => calls.push('onAfterReset'));
    localStorage.setItem('sort.v1', '{"key":"name"}');

    const result = resetTablePreferences({
      sortStorageKey: 'sort.v1',
      searchParams: new URLSearchParams('sort=name&dir=asc'),
      setSearchParams,
      resetState,
      onAfterReset,
    });

    expect(result).toBe(true);
    expect(localStorage.getItem('sort.v1')).toBeNull();
    expect(calls).toEqual(['resetState', 'setSearchParams', 'onAfterReset']);
  });

  it('setSearchParams: sort/dir 만 삭제 · 다른 param 은 보존', () => {
    window.confirm = vi.fn(() => true);
    const setSearchParams = vi.fn();
    resetTablePreferences({
      sortStorageKey: 'sort.v1',
      searchParams: new URLSearchParams('sort=name&dir=asc&page=3&filter=admin'),
      setSearchParams,
      resetState: () => {},
    });
    const [next, opts] = setSearchParams.mock.calls[0];
    expect(next).toBeInstanceOf(URLSearchParams);
    expect((next as URLSearchParams).has('sort')).toBe(false);
    expect((next as URLSearchParams).has('dir')).toBe(false);
    expect((next as URLSearchParams).get('page')).toBe('3');
    expect((next as URLSearchParams).get('filter')).toBe('admin');
    expect(opts).toEqual({ replace: false });
  });

  it('localStorage.removeItem 예외는 조용히 무시 · 나머지 진행', () => {
    window.confirm = vi.fn(() => true);
    const origRemove = Storage.prototype.removeItem;
    Storage.prototype.removeItem = vi.fn(() => {
      throw new Error('localStorage disabled');
    });
    const setSearchParams = vi.fn();
    const resetState = vi.fn();
    try {
      const result = resetTablePreferences({
        sortStorageKey: 'sort.v1',
        searchParams: new URLSearchParams(),
        setSearchParams,
        resetState,
      });
      expect(result).toBe(true);
      expect(resetState).toHaveBeenCalledOnce();
      expect(setSearchParams).toHaveBeenCalledOnce();
    } finally {
      Storage.prototype.removeItem = origRemove;
    }
  });

  it('onAfterReset 미전달: 나머지 정상 실행', () => {
    window.confirm = vi.fn(() => true);
    const setSearchParams = vi.fn();
    const resetState = vi.fn();
    const result = resetTablePreferences({
      sortStorageKey: 'sort.v1',
      searchParams: new URLSearchParams(),
      setSearchParams,
      resetState,
    });
    expect(result).toBe(true);
    expect(resetState).toHaveBeenCalledOnce();
    expect(setSearchParams).toHaveBeenCalledOnce();
  });

  it('confirm 은 고정 CONFIRM_MESSAGE 로 호출됨', () => {
    const spy = vi.fn(() => false);
    window.confirm = spy;
    resetTablePreferences({
      sortStorageKey: 'sort.v1',
      searchParams: new URLSearchParams(),
      setSearchParams: () => {},
      resetState: () => {},
    });
    expect(spy).toHaveBeenCalledWith(RESET_TABLE_PREFERENCES_CONFIRM_MESSAGE);
  });

  it('CONFIRM/BANNER 메시지 상수: 한글 문구 노출', () => {
    expect(RESET_TABLE_PREFERENCES_CONFIRM_MESSAGE).toContain('저장된 선호');
    expect(RESET_TABLE_PREFERENCES_CONFIRM_MESSAGE).toContain('기본값으로 초기화');
    expect(RESET_TABLE_PREFERENCES_BANNER_MESSAGE).toContain('초기화');
  });
});
