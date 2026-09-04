import { describe, it, expect } from 'vitest';
import { isValidBasicDataYear } from '../src/index.js';

describe('isValidBasicDataYear', () => {
  it('returns true for a valid BasicDataYear object', () => {
    const valid = {
      year: 2026,
      grades: [
        { grade: 1, classes: ['1', '2', '3'] },
        { grade: 2, classes: ['A', 'B'] },
      ],
    };
    expect(isValidBasicDataYear(valid)).toBe(true);
  });

  it('returns true for a valid object with empty grades array', () => {
    expect(isValidBasicDataYear({ year: 2026, grades: [] })).toBe(true);
  });

  it('returns false for null, undefined, or primitives', () => {
    expect(isValidBasicDataYear(null)).toBe(false);
    expect(isValidBasicDataYear(undefined)).toBe(false);
    expect(isValidBasicDataYear(2026)).toBe(false);
    expect(isValidBasicDataYear('2026')).toBe(false);
  });

  it('returns false when year is invalid, out of range, or non-integer', () => {
    expect(isValidBasicDataYear({ year: '2026', grades: [] })).toBe(false);
    expect(isValidBasicDataYear({ year: 1899, grades: [] })).toBe(false);
    expect(isValidBasicDataYear({ year: 2201, grades: [] })).toBe(false);
    expect(isValidBasicDataYear({ year: NaN, grades: [] })).toBe(false);
    expect(isValidBasicDataYear({ year: Infinity, grades: [] })).toBe(false);
    expect(isValidBasicDataYear({ year: 2026.5, grades: [] })).toBe(false);
  });

  it('returns false when grades is not an array or elements are invalid', () => {
    expect(isValidBasicDataYear({ year: 2026, grades: null })).toBe(false);
    expect(isValidBasicDataYear({ year: 2026, grades: 'grades' })).toBe(false);
    expect(isValidBasicDataYear({ year: 2026, grades: [null] })).toBe(false);
    expect(isValidBasicDataYear({ year: 2026, grades: [{ grade: '1', classes: ['A'] }] })).toBe(false);
    expect(isValidBasicDataYear({ year: 2026, grades: [{ grade: 1.5, classes: ['A'] }] })).toBe(false);
    expect(isValidBasicDataYear({ year: 2026, grades: [{ grade: 1, classes: null }] })).toBe(false);
    expect(isValidBasicDataYear({ year: 2026, grades: [{ grade: 1, classes: [''] }] })).toBe(false);
    expect(isValidBasicDataYear({ year: 2026, grades: [{ grade: 1, classes: [123] }] })).toBe(false);
  });

  it('returns true for a valid object with departments array', () => {
    expect(
      isValidBasicDataYear({
        year: 2026,
        grades: [],
        departments: ['국어과', '수학과'],
      }),
    ).toBe(true);
    expect(
      isValidBasicDataYear({
        year: 2026,
        grades: [],
        departments: [],
      }),
    ).toBe(true);
  });

  it('returns false when departments contains empty, whitespace-only or non-string element', () => {
    expect(
      isValidBasicDataYear({
        year: 2026,
        grades: [],
        departments: ['국어과', ''],
      }),
    ).toBe(false);
    expect(
      isValidBasicDataYear({
        year: 2026,
        grades: [],
        departments: ['국어과', '   '],
      }),
    ).toBe(false);
    expect(
      isValidBasicDataYear({
        year: 2026,
        grades: [],
        departments: ['국어과', 123 as any],
      }),
    ).toBe(false);
  });

  it('returns false when departments is not an array', () => {
    expect(
      isValidBasicDataYear({
        year: 2026,
        grades: [],
        departments: 'notArray' as any,
      }),
    ).toBe(false);
  });
});
