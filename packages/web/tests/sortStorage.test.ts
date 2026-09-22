import { describe, it, expect } from 'vitest';
import { deserializeSort } from '../src/lib/sortStorage';

// v0.221 R1 F-A: shared `deserializeSort` 엄격 검증.
describe('deserializeSort', () => {
  it('valid object with sort + dir → 반환', () => {
    expect(deserializeSort('{"sort":"email","dir":"asc"}')).toEqual({
      sort: 'email',
      dir: 'asc',
    });
  });

  it('valid object with sort only → sort 만 반환', () => {
    expect(deserializeSort('{"sort":"name"}')).toEqual({
      sort: 'name',
      dir: undefined,
    });
  });

  it('valid object with dir only → dir 만 반환', () => {
    expect(deserializeSort('{"dir":"desc"}')).toEqual({
      sort: undefined,
      dir: 'desc',
    });
  });

  it('명시적 null → null (reset semantic)', () => {
    expect(deserializeSort('null')).toBeNull();
  });

  it('malformed JSON → undefined (default fallback)', () => {
    expect(deserializeSort('not-json{{')).toBeUndefined();
    expect(deserializeSort('')).toBeUndefined();
  });

  // v0.221 R1 F-A: 배열 · 기본형 · 필드 타입 오류 · empty object 모두 undefined.
  it('array → undefined (invalid shape)', () => {
    expect(deserializeSort('[]')).toBeUndefined();
    expect(deserializeSort('[1,2,3]')).toBeUndefined();
    expect(deserializeSort('["email","asc"]')).toBeUndefined();
  });

  it('primitive (숫자/문자열/boolean) → undefined', () => {
    expect(deserializeSort('42')).toBeUndefined();
    expect(deserializeSort('"email"')).toBeUndefined();
    expect(deserializeSort('true')).toBeUndefined();
  });

  it('empty object → undefined (invalid shape)', () => {
    expect(deserializeSort('{}')).toBeUndefined();
  });

  it('sort/dir 필드 타입 오류 → undefined', () => {
    expect(deserializeSort('{"sort":123,"dir":"asc"}')).toBeUndefined();
    expect(deserializeSort('{"sort":"email","dir":true}')).toBeUndefined();
    expect(deserializeSort('{"sort":null,"dir":null}')).toBeUndefined();
  });

  it('unknown extra fields 는 무시 (valid sort/dir 만 반환)', () => {
    expect(deserializeSort('{"sort":"email","dir":"asc","extra":"foo"}')).toEqual({
      sort: 'email',
      dir: 'asc',
    });
  });
});
