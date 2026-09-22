import { describe, it, expect } from 'vitest';
import {
  serializeVisibleColumns,
  makeVisibleColumnsDeserializer,
} from '../src/lib/visibleColumnsStorage';

// v0.221: shared visible-columns storage factory.
describe('serializeVisibleColumns', () => {
  it('Set<string> → JSON array string', () => {
    expect(serializeVisibleColumns(new Set(['a', 'b']))).toBe('["a","b"]');
    expect(serializeVisibleColumns(new Set())).toBe('[]');
  });
});

describe('makeVisibleColumnsDeserializer', () => {
  const VALID = ['name', 'orgUnitPath', 'admin', 'suspended'] as const;
  const DEFAULT = ['name', 'orgUnitPath', 'admin', 'suspended'] as const;
  const deserialize = makeVisibleColumnsDeserializer(VALID, DEFAULT);

  it('valid subset → Set(subset)', () => {
    const s = deserialize('["name","admin"]');
    expect(s).toEqual(new Set(['name', 'admin']));
  });

  it('all valid → Set(all)', () => {
    const s = deserialize('["name","orgUnitPath","admin","suspended"]');
    expect(s?.size).toBe(4);
  });

  it('명시적 empty array `[]` → Set() (사용자 전체 숨김 유지)', () => {
    const s = deserialize('[]');
    expect(s).toEqual(new Set());
    expect(s?.size).toBe(0);
  });

  it('valid + invalid 혼재 → valid 만 필터', () => {
    const s = deserialize('["name","bogus","admin"]');
    expect(s).toEqual(new Set(['name', 'admin']));
  });

  it('all unknown → default 복구 (v0.216 R1 F-A)', () => {
    const s = deserialize('["bogus1","bogus2"]');
    expect(s).toEqual(new Set(DEFAULT));
  });

  it('non-array → undefined (hook 이 default fallback)', () => {
    expect(deserialize('"some string"')).toBeUndefined();
    expect(deserialize('42')).toBeUndefined();
    expect(deserialize('{"a":1}')).toBeUndefined();
  });

  it('손상된 JSON → undefined (hook 이 default fallback)', () => {
    expect(deserialize('{invalid')).toBeUndefined();
    expect(deserialize('')).toBeUndefined();
  });

  it('string 아닌 요소 (숫자·객체) 필터', () => {
    const s = deserialize('[1, {"x":2}, "name"]');
    expect(s).toEqual(new Set(['name']));
  });
});
