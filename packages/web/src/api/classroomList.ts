import { useQuery } from '@tanstack/react-query';
import { callCallable } from './callCallable';

export interface ClassroomCourse {
  id: string;
  name?: string;
  section?: string;
  descriptionHeading?: string;
  description?: string;
  room?: string;
  ownerId?: string;
  creationTime?: string;
  updateTime?: string;
  enrollmentCode?: string;
  courseState?: string;
  alternateLink?: string;
  teacherGroupEmail?: string;
  courseGroupEmail?: string;
  guardiansEnabled?: boolean;
}

export interface ClassroomListResponse {
  courses: ClassroomCourse[];
}

export async function callClassroomList(): Promise<ClassroomListResponse> {
  return callCallable<Record<string, never>, ClassroomListResponse>(
    'classroomList',
    {},
    { scopes: 'https://www.googleapis.com/auth/classroom.courses' },
  );
}

export function useClassroomList(enabled = true) {
  return useQuery<ClassroomListResponse, Error>({
    queryKey: ['classroom', 'list'],
    queryFn: () => callClassroomList(),
    enabled,
    staleTime: 60_000,
    retry: (failureCount, error) => {
      const status = (error as Error & { status?: number }).status;
      if (status !== undefined && status >= 400 && status < 500) return false;
      return failureCount < 2;
    },
  });
}
