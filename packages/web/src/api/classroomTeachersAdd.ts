import { useMutation, useQueryClient } from '@tanstack/react-query';
import { callCallable } from './callCallable';
import type { ClassroomTeacher } from './classroomTeachersList';

export type { ClassroomTeacher };

// v0.311: callCallable helper 이식. signature 유지.

export interface ClassroomTeachersAddRequest {
  courseId: string;
  userId: string;
}

export interface ClassroomTeachersAddResponse {
  teacher: ClassroomTeacher;
}

export async function callClassroomTeachersAdd(
  data: ClassroomTeachersAddRequest,
): Promise<ClassroomTeachersAddResponse> {
  return callCallable<ClassroomTeachersAddRequest, ClassroomTeachersAddResponse>(
    'classroomTeachersAdd',
    data,
    { scopes: 'https://www.googleapis.com/auth/classroom.rosters' },
  );
}

export function useClassroomTeachersAdd() {
  const qc = useQueryClient();
  return useMutation<ClassroomTeachersAddResponse, Error, ClassroomTeachersAddRequest>({
    mutationFn: (data) => callClassroomTeachersAdd(data),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['classroom', 'teachers', variables.courseId] });
    },
  });
}
