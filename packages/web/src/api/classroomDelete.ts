import { useMutation, useQueryClient } from '@tanstack/react-query';
import { callCallable } from './callCallable';

export interface ClassroomDeleteRequest {
  id: string;
}

export interface ClassroomDeleteResponse {
  ok: true;
}

export async function callClassroomDelete(data: ClassroomDeleteRequest): Promise<ClassroomDeleteResponse> {
  return callCallable<ClassroomDeleteRequest, ClassroomDeleteResponse>(
    'classroomDelete',
    data,
    { scopes: 'https://www.googleapis.com/auth/classroom.courses' },
  );
}

export function useClassroomDelete() {
  const queryClient = useQueryClient();
  return useMutation<ClassroomDeleteResponse, Error, ClassroomDeleteRequest>({
    mutationFn: (data) => callClassroomDelete(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classroom', 'list'] });
    },
  });
}
