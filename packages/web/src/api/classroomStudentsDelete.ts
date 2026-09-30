import { useMutation, useQueryClient } from '@tanstack/react-query';
import { callCallable } from './callCallable';

export interface ClassroomStudentsDeleteRequest {
  courseId: string;
  userId: string;
}

export interface ClassroomStudentsDeleteResponse {
  ok: true;
}

export async function callClassroomStudentsDelete(
  data: ClassroomStudentsDeleteRequest,
): Promise<ClassroomStudentsDeleteResponse> {
  return callCallable<ClassroomStudentsDeleteRequest, ClassroomStudentsDeleteResponse>(
    'classroomStudentsDelete',
    data,
    { scopes: 'https://www.googleapis.com/auth/classroom.rosters' },
  );
}

export function useClassroomStudentsDelete() {
  const qc = useQueryClient();
  return useMutation<ClassroomStudentsDeleteResponse, Error, ClassroomStudentsDeleteRequest>({
    mutationFn: (data) => callClassroomStudentsDelete(data),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['classroom', 'students', variables.courseId] });
    },
  });
}
