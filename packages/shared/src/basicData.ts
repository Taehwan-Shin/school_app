export interface BasicDataGradeClass {
  grade: number; // 1, 2, 3, ...
  classes: string[]; // ['A', 'B', 'C', ...]
}

export interface BasicDataYear {
  year: number; // 예: 2026
  grades: BasicDataGradeClass[];
  departments?: string[]; // 신규: 부서 이름 배열 (예: ['국어과', '수학과'])
  updatedAt?: number; // ms since epoch (서버 timestamp)
  updatedBy?: string; // actor email
}

export function isValidBasicDataYear(input: unknown): input is BasicDataYear {
  if (!input || typeof input !== 'object') return false;
  const obj = input as any;
  if (
    typeof obj.year !== 'number' ||
    !Number.isFinite(obj.year) ||
    !Number.isInteger(obj.year) ||
    obj.year < 1900 ||
    obj.year > 2200
  ) {
    return false;
  }
  if (!Array.isArray(obj.grades)) return false;
  for (const g of obj.grades) {
    if (!g || typeof g !== 'object') return false;
    if (typeof g.grade !== 'number' || !Number.isFinite(g.grade) || !Number.isInteger(g.grade)) {
      return false;
    }
    if (!Array.isArray(g.classes)) return false;
    if (!g.classes.every((c: unknown) => typeof c === 'string' && c.length > 0)) return false;
  }
  if (obj.departments !== undefined) {
    if (!Array.isArray(obj.departments)) return false;
    if (!obj.departments.every((d: unknown) => typeof d === 'string' && d.trim().length > 0)) return false;
  }
  return true;
}
