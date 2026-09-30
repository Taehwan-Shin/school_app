import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ClassroomCourse } from './classroomList';
import { callCallable } from './callCallable';

export interface ClassroomCreateRequest {
  id?: string;
  name: string;
  section?: string;
  description?: string;
  room?: string;
  ownerId?: string;
  courseState?: 'PROVISIONED' | 'ACTIVE';
}

export interface ClassroomCreateResponse {
  course: ClassroomCourse;
}

export async function callClassroomCreate(
  data: ClassroomCreateRequest,
): Promise<ClassroomCreateResponse> {
  return callCallable<ClassroomCreateRequest, ClassroomCreateResponse>(
    'classroomCreate',
    data,
    { scopes: 'https://www.googleapis.com/auth/classroom.courses' },
  );
}

export function useClassroomCreate() {
  const qc = useQueryClient();
  return useMutation<ClassroomCreateResponse, Error, ClassroomCreateRequest>({
    mutationFn: callClassroomCreate,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['classroom', 'list'] });
    },
  });
}
