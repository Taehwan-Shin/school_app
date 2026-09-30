import { useQuery } from '@tanstack/react-query';
import { callCallable } from './callCallable';

export interface ClassroomStudent {
  courseId: string;
  userId: string;
  profile?: {
    id?: string;
    name?: { fullName?: string; givenName?: string; familyName?: string };
    emailAddress?: string;
    photoUrl?: string;
  };
}

export interface ClassroomStudentsListRequest {
  courseId: string;
}

export interface ClassroomStudentsListResponse {
  students: ClassroomStudent[];
}

export async function callClassroomStudentsList(
  data: ClassroomStudentsListRequest,
): Promise<ClassroomStudentsListResponse> {
  return callCallable<ClassroomStudentsListRequest, ClassroomStudentsListResponse>(
    'classroomStudentsList',
    data,
    { scopes: 'https://www.googleapis.com/auth/classroom.rosters' },
  );
}

export function useClassroomStudentsList(courseId: string | null, enabled = true) {
  return useQuery<ClassroomStudentsListResponse, Error>({
    queryKey: ['classroom', 'students', courseId],
    queryFn: () => callClassroomStudentsList({ courseId: courseId! }),
    enabled: enabled && !!courseId,
    staleTime: 60_000,
    retry: (failureCount, error) => {
      const status = (error as Error & { status?: number }).status;
      if (status !== undefined && status >= 400 && status < 500) return false;
      return failureCount < 2;
    },
  });
}
