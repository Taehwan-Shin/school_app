import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ClassroomCourse } from './classroomList';
import { callCallable } from './callCallable';

export interface ClassroomPatchRequest {
  id: string;
  courseState?: 'ACTIVE' | 'ARCHIVED';
  name?: string;
  section?: string;
}

export interface ClassroomPatchResponse {
  course: ClassroomCourse;
}

export async function callClassroomPatch(data: ClassroomPatchRequest): Promise<ClassroomPatchResponse> {
  return callCallable<ClassroomPatchRequest, ClassroomPatchResponse>(
    'classroomPatch',
    data,
    { scopes: 'https://www.googleapis.com/auth/classroom.courses' },
  );
}

export function useClassroomPatch() {
  const queryClient = useQueryClient();
  return useMutation<ClassroomPatchResponse, Error, ClassroomPatchRequest>({
    mutationFn: (data) => callClassroomPatch(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classroom', 'list'] });
    },
  });
}
