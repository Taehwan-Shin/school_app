import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ClassroomCourse } from './classroomList';
import { callCallable } from './callCallable';

export interface ClassroomTransferOwnershipRequest {
  courseId: string;
  newOwnerEmail: string;
}

export interface ClassroomTransferOwnershipResponse {
  course: ClassroomCourse;
  addedAsTeacher: boolean;
}

export async function callClassroomTransferOwnership(
  data: ClassroomTransferOwnershipRequest,
): Promise<ClassroomTransferOwnershipResponse> {
  return callCallable<ClassroomTransferOwnershipRequest, ClassroomTransferOwnershipResponse>(
    'classroomTransferOwnership',
    data,
    {
      scopes:
        'https://www.googleapis.com/auth/classroom.courses https://www.googleapis.com/auth/classroom.rosters',
    },
  );
}

export function useClassroomTransferOwnership() {
  const queryClient = useQueryClient();
  return useMutation<
    ClassroomTransferOwnershipResponse,
    Error,
    ClassroomTransferOwnershipRequest
  >({
    mutationFn: (data) => callClassroomTransferOwnership(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classroom', 'list'] });
    },
  });
}
