import { describe, it, expect } from 'vitest';
import { findOverlyLongPlanRows } from '../src/routes/admin/NeisCsvImportDialog';
import { COURSE_NAME_MAX } from '../src/lib/classroomLimits';

// v0.182: NEIS CSV import 미리보기 단계에서 courseName 이 COURSE_NAME_MAX (750자)
// 를 초과한 row 를 사전 감지. 실행 버튼 disabled + 경고 배너에 사용된다.
describe('NeisCsvImportDialog.findOverlyLongPlanRows', () => {
  it('모두 상한 이내면 빈 배열', () => {
    const plan = [
      { rowIndex: 4, courseName: '1학년 1반 수학' },
      { rowIndex: 5, courseName: 'A'.repeat(COURSE_NAME_MAX) }, // 정확 750
    ];
    expect(findOverlyLongPlanRows(plan)).toEqual([]);
  });

  it('초과 row 만 반환 · 원본 순서 유지', () => {
    const plan = [
      { rowIndex: 4, courseName: '1학년 1반 수학' },
      { rowIndex: 5, courseName: 'X'.repeat(COURSE_NAME_MAX + 1) }, // 751
      { rowIndex: 6, courseName: '1학년 3반 국어' },
      { rowIndex: 7, courseName: 'Y'.repeat(1000) },
    ];
    const result = findOverlyLongPlanRows(plan);
    expect(result).toHaveLength(2);
    expect(result[0].rowIndex).toBe(5);
    expect(result[1].rowIndex).toBe(7);
  });

  it('빈 plan → 빈 배열', () => {
    expect(findOverlyLongPlanRows([])).toEqual([]);
  });

  it('max 인자로 커스텀 상한 사용 가능', () => {
    const plan = [
      { rowIndex: 4, courseName: '1234567890' },
      { rowIndex: 5, courseName: '12345678901' },
    ];
    expect(findOverlyLongPlanRows(plan, 10)).toHaveLength(1);
    expect(findOverlyLongPlanRows(plan, 10)[0].rowIndex).toBe(5);
  });
});
