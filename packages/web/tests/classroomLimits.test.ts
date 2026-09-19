import { describe, it, expect } from 'vitest';
import {
  COURSE_DESCRIPTION_MAX,
  COURSE_NAME_MAX,
  COURSE_ROOM_MAX,
  COURSE_SECTION_MAX,
} from '../src/lib/classroomLimits';

describe('classroomLimits', () => {
  it('COURSE_DESCRIPTION_MAX matches Google Classroom courses.description 상한 (30,000자)', () => {
    expect(COURSE_DESCRIPTION_MAX).toBe(30000);
  });

  it('COURSE_NAME_MAX matches courses.name 상한 (750자)', () => {
    expect(COURSE_NAME_MAX).toBe(750);
  });

  it('COURSE_SECTION_MAX matches courses.section 상한 (2,800자)', () => {
    expect(COURSE_SECTION_MAX).toBe(2800);
  });

  it('COURSE_ROOM_MAX matches courses.room 상한 (650자)', () => {
    expect(COURSE_ROOM_MAX).toBe(650);
  });
});
