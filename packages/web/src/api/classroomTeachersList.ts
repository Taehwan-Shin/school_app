import { useQuery } from '@tanstack/react-query';
import { callCallable } from './callCallable';

// v0.312: v0.309 callCallable helper 이식 (batch). 기존 signature 유지 · 내부만 shared helper.

export interface ClassroomTeacher {
  courseId: string;
  userId: string;
  profile?: {
    id?: string;
    name?: { fullName?: string; givenName?: string; familyName?: string };
    emailAddress?: string;
    photoUrl?: string;
  };
}

export interface ClassroomTeachersListRequest {
  courseId: string;
}

export interface ClassroomTeachersListResponse {
  teachers: ClassroomTeacher[];
}

export async function callClassroomTeachersList(
  data: ClassroomTeachersListRequest,
): Promise<ClassroomTeachersListResponse> {
  return callCallable<ClassroomTeachersListRequest, ClassroomTeachersListResponse>(
    'classroomTeachersList',
    data,
    { scopes: 'https://www.googleapis.com/auth/classroom.rosters' },
  );
}

export function useClassroomTeachersList(courseId: string | null, enabled = true) {
  return useQuery<ClassroomTeachersListResponse, Error>({
    queryKey: ['classroom', 'teachers', courseId],
    queryFn: () => callClassroomTeachersList({ courseId: courseId! }),
    enabled: enabled && !!courseId,
    staleTime: 60_000,
    retry: (failureCount, error) => {
      const status = (error as Error & { status?: number }).status;
      if (status !== undefined && status >= 400 && status < 500) return false;
      return failureCount < 2;
    },
  });
}
