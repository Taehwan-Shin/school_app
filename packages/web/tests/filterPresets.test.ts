import { describe, it, expect, beforeEach } from 'vitest';
import {
  listPresets,
  savePreset,
  deletePreset,
} from '../src/routes/super_admin/filterPresets';

describe('filterPresets storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('빈 localStorage → 빈 리스트', () => {
    expect(listPresets()).toEqual([]);
  });

  it('savePreset 후 listPresets 로 조회', () => {
    savePreset('내 필터', 'action=users.read');
    expect(listPresets()).toEqual([{ name: '내 필터', params: 'action=users.read' }]);
  });

  it('같은 이름 preset 은 갱신 (append 아님)', () => {
    savePreset('a', 'result=ok');
    savePreset('a', 'result=error');
    const list = listPresets();
    expect(list).toHaveLength(1);
    expect(list[0]).toEqual({ name: 'a', params: 'result=error' });
  });

  it('name 은 trim + 최대 60자', () => {
    const long = 'x'.repeat(100);
    savePreset(`  ${long}  `, 'q=1');
    const list = listPresets();
    expect(list[0].name).toHaveLength(60);
    expect(list[0].name).toBe('x'.repeat(60));
  });

  it('빈 이름 (trim 후) 은 저장 안 됨', () => {
    savePreset('   ', 'q=1');
    expect(listPresets()).toEqual([]);
  });

  it('MAX_PRESETS (20) 상한 — 21번째는 저장 안 됨', () => {
    for (let i = 0; i < 20; i++) {
      savePreset(`p${i}`, `q=${i}`);
    }
    expect(listPresets()).toHaveLength(20);
    savePreset('p20', 'q=20');
    // 상한 초과, 새 preset 무시.
    expect(listPresets()).toHaveLength(20);
    expect(listPresets().some((p) => p.name === 'p20')).toBe(false);
  });

  it('deletePreset 은 이름 매치로 제거', () => {
    savePreset('a', 'x=1');
    savePreset('b', 'x=2');
    deletePreset('a');
    const list = listPresets();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('b');
  });

  it('malformed localStorage 값 → 빈 리스트로 fallback', () => {
    localStorage.setItem('audit_filter_presets_v1', 'not json');
    expect(listPresets()).toEqual([]);
    // 이후 save 도 정상 동작 (새 배열로 덮어씀).
    savePreset('x', 'q=1');
    expect(listPresets()).toEqual([{ name: 'x', params: 'q=1' }]);
  });

  it('array 아닌 JSON → 빈 리스트', () => {
    localStorage.setItem('audit_filter_presets_v1', '{"not":"array"}');
    expect(listPresets()).toEqual([]);
  });
});
