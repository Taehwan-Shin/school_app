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

  it('returns true when rosters is undefined (backward compatibility)', () => {
    expect(
      isValidBasicDataYear({
        year: 2026,
        grades: [{ grade: 1, classes: ['1'] }],
      }),
    ).toBe(true);
  });

  it('returns true for a valid object with rosters', () => {
    expect(
      isValidBasicDataYear({
        year: 2026,
        grades: [
          { grade: 1, classes: ['A'] },
          { grade: 2, classes: ['B'] },
        ],
        rosters: {
          '1': { A: ['s1@cam.hs.kr', 's2@cam.hs.kr'] },
          '2': { B: [] },
        },
      }),
    ).toBe(true);
    expect(
      isValidBasicDataYear({
        year: 2026,
        grades: [],
        rosters: {},
      }),
    ).toBe(true);
  });

  it('returns false when rosters is not an object, is null, or is an array', () => {
    expect(
      isValidBasicDataYear({
        year: 2026,
        grades: [],
        rosters: 'notObject' as any,
      }),
    ).toBe(false);
    expect(
      isValidBasicDataYear({
        year: 2026,
        grades: [],
        rosters: null as any,
      }),
    ).toBe(false);
    expect(
      isValidBasicDataYear({
        year: 2026,
        grades: [],
        rosters: [] as any,
      }),
    ).toBe(false);
  });

  it('returns false when grade key in rosters is not a digit string', () => {
    expect(
      isValidBasicDataYear({
        year: 2026,
        grades: [],
        rosters: {
          invalid_key: {},
        } as any,
      }),
    ).toBe(false);
    expect(
      isValidBasicDataYear({
        year: 2026,
        grades: [],
        rosters: {
          '1a': {},
        } as any,
      }),
    ).toBe(false);
  });

  it('returns false when grade roster value is not an object or is null or array', () => {
    expect(
      isValidBasicDataYear({
        year: 2026,
        grades: [],
        rosters: {
          '1': null as any,
        },
      }),
    ).toBe(false);
    expect(
      isValidBasicDataYear({
        year: 2026,
        grades: [],
        rosters: {
          '1': [] as any,
        },
      }),
    ).toBe(false);
  });

  it('returns false when class key is empty string', () => {
    expect(
      isValidBasicDataYear({
        year: 2026,
        grades: [],
        rosters: {
          '1': { '': ['s@cam.hs.kr'] },
        },
      }),
    ).toBe(false);
  });

  it('returns false when students is not an array or contains empty, whitespace-only or non-string element', () => {
    expect(
      isValidBasicDataYear({
        year: 2026,
        grades: [],
        rosters: {
          '1': { A: 's@cam.hs.kr' as any },
        },
      }),
    ).toBe(false);
    expect(
      isValidBasicDataYear({
        year: 2026,
        grades: [],
        rosters: {
          '1': { A: [''] },
        },
      }),
    ).toBe(false);
    expect(
      isValidBasicDataYear({
        year: 2026,
        grades: [],
        rosters: {
          '1': { A: ['   '] },
        },
      }),
    ).toBe(false);
    expect(
      isValidBasicDataYear({
        year: 2026,
        grades: [],
        rosters: {
          '1': { A: [123 as any] },
        },
      }),
    ).toBe(false);
  });
});

