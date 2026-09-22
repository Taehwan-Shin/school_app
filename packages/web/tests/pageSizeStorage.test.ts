import { describe, it, expect } from 'vitest';
import {
  serializePageSize,
  makePageSizeDeserializer,
} from '../src/lib/pageSizeStorage';

// v0.220 R1 F-A: shared page-size serializer/deserializer. Number.parseInt 대신
// Number + Number.isInteger 로 엄격 검증 — "25junk" 같은 partial-parse 를 거부.
describe('pageSizeStorage', () => {
  const OPTIONS = [25, 50, 100, 200] as const;
  const parse = makePageSizeDeserializer(OPTIONS);

  describe('serializePageSize', () => {
    it('숫자를 raw string 으로', () => {
      expect(serializePageSize(25)).toBe('25');
      expect(serializePageSize(200)).toBe('200');
    });
  });

  describe('makePageSizeDeserializer', () => {
    it('whitelist 정수 문자열 → 값', () => {
      expect(parse('25')).toBe(25);
      expect(parse('50')).toBe(50);
      expect(parse('100')).toBe(100);
      expect(parse('200')).toBe(200);
    });

    it('whitelist 밖 정수 → undefined', () => {
      expect(parse('0')).toBeUndefined();
      expect(parse('1')).toBeUndefined();
      expect(parse('75')).toBeUndefined();
      expect(parse('500')).toBeUndefined();
    });

    // v0.220 R1 F-A: parseInt partial-parse ("25junk"→25) 회피 확인.
    it('partial-parse 문자열 → undefined (F-A)', () => {
      expect(parse('25junk')).toBeUndefined();
      expect(parse('50abc')).toBeUndefined();
      expect(parse('100xyz')).toBeUndefined();
      expect(parse('200.5')).toBeUndefined(); // 부동소수 도 거부.
      expect(parse('25 ')).toBe(25); // Number("25 ") = 25 · trailing 공백은 허용.
    });

    it('완전히 잘못된 문자열 → undefined', () => {
      expect(parse('abc')).toBeUndefined();
      expect(parse('')).toBeUndefined();
      expect(parse('null')).toBeUndefined();
      expect(parse('undefined')).toBeUndefined();
    });

    it('부동소수 → undefined (Number.isInteger 검증)', () => {
      expect(parse('25.0')).toBe(25); // 25.0 == 25 · isInteger 통과.
      expect(parse('25.5')).toBeUndefined();
      expect(parse('99.999')).toBeUndefined();
    });

    it('다른 option 배열 (AuditLog [25,50,100]) 대칭', () => {
      const parseAudit = makePageSizeDeserializer([25, 50, 100] as const);
      expect(parseAudit('25')).toBe(25);
      expect(parseAudit('200')).toBeUndefined(); // 이 배열엔 없음.
    });
  });
});
