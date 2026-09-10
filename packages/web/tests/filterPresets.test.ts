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

  // v0.114b F69: savePreset 이 SavePresetResult 반환.
  it('v0.114b F69: savePreset ok status + 갱신된 presets 반환', () => {
    const r = savePreset('a', 'q=1');
    expect(r.status).toBe('ok');
    expect(r.presets).toEqual([{ name: 'a', params: 'q=1' }]);
  });

  it('v0.114b F69: invalid_name status (빈 이름)', () => {
    const r = savePreset('   ', 'q=1');
    expect(r.status).toBe('invalid_name');
    expect(r.presets).toEqual([]);
  });

  it('v0.114b F69: limit_exceeded status', () => {
    for (let i = 0; i < 20; i++) savePreset(`p${i}`, 'q');
    const r = savePreset('extra', 'q');
    expect(r.status).toBe('limit_exceeded');
    expect(r.presets).toHaveLength(20);
    expect(r.presets.some((p) => p.name === 'extra')).toBe(false);
  });

  it('v0.114b F69: storage_error status (setItem throws) → presets 는 pre-write 상태', () => {
    savePreset('existing', 'q=0');
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('quota exceeded');
    };
    try {
      const r = savePreset('newone', 'q=1');
      expect(r.status).toBe('storage_error');
      // presets 는 pre-write persisted 상태 (existing 만).
      expect(r.presets).toEqual([{ name: 'existing', params: 'q=0' }]);
    } finally {
      Storage.prototype.setItem = original;
    }
  });

  // v0.114b F70: readStorage 정규화 · dedup · 상한.
  it('v0.114b F70: 손상 데이터 — 긴 이름은 60자 자름', () => {
    const bad = [{ name: 'x'.repeat(100), params: 'q=1' }];
    localStorage.setItem('audit_filter_presets_v1', JSON.stringify(bad));
    const list = listPresets();
    expect(list).toHaveLength(1);
    expect(list[0].name).toHaveLength(60);
  });

  it('v0.114b F70: 손상 데이터 — 빈 이름 (trim 후) 은 제외', () => {
    const bad = [
      { name: '   ', params: 'q=1' },
      { name: 'valid', params: 'q=2' },
    ];
    localStorage.setItem('audit_filter_presets_v1', JSON.stringify(bad));
    const list = listPresets();
    expect(list).toEqual([{ name: 'valid', params: 'q=2' }]);
  });

  it('v0.114b F70: 손상 데이터 — 이름 중복은 last-write-wins 로 dedup', () => {
    const bad = [
      { name: 'a', params: 'q=1' },
      { name: 'a', params: 'q=2' },
    ];
    localStorage.setItem('audit_filter_presets_v1', JSON.stringify(bad));
    const list = listPresets();
    expect(list).toEqual([{ name: 'a', params: 'q=2' }]);
  });

  it('v0.114b F70: 손상 데이터 — 21+ 는 20 개로 자름', () => {
    const bad = Array.from({ length: 30 }, (_, i) => ({
      name: `p${i}`,
      params: `q=${i}`,
    }));
    localStorage.setItem('audit_filter_presets_v1', JSON.stringify(bad));
    expect(listPresets()).toHaveLength(20);
  });

  // v0.114b F71: 이름 정규화가 UI/유틸 일치 — 61자 이름은 유틸 안에서 60자로 컷되므로
  // 20 개 상태에서 기존 60자 이름과 충돌하면 「갱신」 이 됨 (limit 초과 아님).
  it('v0.114b F71: 20개 상태에서 61자 입력이 기존 60자 이름과 충돌 → 갱신 (ok)', () => {
    const sixty = 'x'.repeat(60);
    // 처음엔 60자 preset 하나. 그다음 19 개 채워서 20 개.
    savePreset(sixty, 'q=first');
    for (let i = 0; i < 19; i++) savePreset(`p${i}`, `q=${i}`);
    expect(listPresets()).toHaveLength(20);
    // 61자 입력 (trim 후 60자로 컷되어 sixty 와 동일) → 갱신.
    const r = savePreset('x'.repeat(61), 'q=updated');
    expect(r.status).toBe('ok');
    const found = listPresets().find((p) => p.name === sixty);
    expect(found?.params).toBe('q=updated');
  });
});
