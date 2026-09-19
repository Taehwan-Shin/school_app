import { describe, it, expect } from 'vitest';
import { COURSE_DESCRIPTION_MAX } from '../src/lib/classroomLimits';

describe('classroomLimits', () => {
  it('COURSE_DESCRIPTION_MAX matches Google Classroom courses.description 상한 (30,000자)', () => {
    expect(COURSE_DESCRIPTION_MAX).toBe(30000);
  });
});
