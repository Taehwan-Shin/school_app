import { useMutation, useQueryClient } from '@tanstack/react-query';
import { callCallable } from './callCallable';

export interface ClassroomTeachersDeleteRequest {
  courseId: string;
  userId: string;
}

export interface ClassroomTeachersDeleteResponse {
  ok: true;
}

export async function callClassroomTeachersDelete(
  data: ClassroomTeachersDeleteRequest,
): Promise<ClassroomTeachersDeleteResponse> {
  return callCallable<ClassroomTeachersDeleteRequest, ClassroomTeachersDeleteResponse>(
    'classroomTeachersDelete',
    data,
    { scopes: 'https://www.googleapis.com/auth/classroom.rosters' },
  );
}

export function useClassroomTeachersDelete() {
  const qc = useQueryClient();
  return useMutation<ClassroomTeachersDeleteResponse, Error, ClassroomTeachersDeleteRequest>({
    mutationFn: (data) => callClassroomTeachersDelete(data),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['classroom', 'teachers', variables.courseId] });
    },
  });
}
