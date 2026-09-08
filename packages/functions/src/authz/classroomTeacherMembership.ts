import { HttpsError } from 'firebase-functions/v2/https';
import type { Role } from '@school-app/shared';
import type { ClassroomClient } from '../google/classroomClient.js';

// app-role `teacher` 로 온 요청이 실제로 대상 코스의 교사인지 사전 검증한다.
// Google Workspace 관리자 계정이 app-role 만 teacher 로 매핑된 경우 Google API 는
// permission-denied 를 돌려주지 않으므로, 앱 층에서 「본인 코스만」 경계를 지킨다.
// admin/super_admin 은 광범위한 권한을 위해 이 검증을 우회한다.
export async function assertTeacherInCourseIfTeacherRole(
  classroom: ClassroomClient,
  role: Role,
  courseId: string,
): Promise<void> {
  if (role !== 'teacher') return;
  try {
    await classroom.courses.teachers.get({ courseId, userId: 'me' });
  } catch (err) {
    const status: number | undefined =
      (err as { response?: { status?: number }; code?: number })?.response?.status ??
      (typeof (err as { code?: number })?.code === 'number'
        ? (err as { code: number }).code
        : undefined);
    if (status === 404) {
      throw new HttpsError('permission-denied', 'teacher_not_in_course');
    }
    throw err;
  }
}
