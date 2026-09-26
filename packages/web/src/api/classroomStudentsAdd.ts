import { useMutation, useQueryClient } from '@tanstack/react-query';
import { callCallable } from './callCallable';
import type { ClassroomStudent } from './classroomStudentsList';

export type { ClassroomStudent };

// v0.311: callCallable helper 이식. signature 유지.

export interface ClassroomStudentsAddRequest {
  courseId: string;
  userId: string;
}

export interface ClassroomStudentsAddResponse {
  student: ClassroomStudent;
}

export async function callClassroomStudentsAdd(
  data: ClassroomStudentsAddRequest,
): Promise<ClassroomStudentsAddResponse> {
  return callCallable<ClassroomStudentsAddRequest, ClassroomStudentsAddResponse>(
    'classroomStudentsAdd',
    data,
    { scopes: 'https://www.googleapis.com/auth/classroom.rosters' },
  );
}

export function useClassroomStudentsAdd() {
  const qc = useQueryClient();
  return useMutation<ClassroomStudentsAddResponse, Error, ClassroomStudentsAddRequest>({
    mutationFn: (data) => callClassroomStudentsAdd(data),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['classroom', 'students', variables.courseId] });
    },
  });
}
