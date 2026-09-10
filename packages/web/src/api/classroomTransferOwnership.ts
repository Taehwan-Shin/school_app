import { useMutation, useQueryClient } from '@tanstack/react-query';
import { auth } from '../lib/firebase';
import { getGoogleAccessTokenFromSession } from '../lib/auth';
import type { ClassroomCourse } from './classroomList';

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
  const user = auth.currentUser;
  if (!user) {
    throw new Error('not_authenticated');
  }
  const idToken = await user.getIdToken();
  const googleAccessToken = getGoogleAccessTokenFromSession() || '';

  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'school-app-5a636';
  const url = import.meta.env.DEV
    ? `http://127.0.0.1:5001/${projectId}/asia-northeast3/classroomTransferOwnership`
    : `https://asia-northeast3-${projectId}.cloudfunctions.net/classroomTransferOwnership`;

  const requestId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
      'X-Google-Access-Token': googleAccessToken,
      'X-Google-Scopes':
        'https://www.googleapis.com/auth/classroom.courses https://www.googleapis.com/auth/classroom.rosters',
      'X-Request-Id': requestId,
    },
    body: JSON.stringify({
      data: {
        ...data,
        _googleAccessToken: googleAccessToken,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = body.error?.message ?? `http_${res.status}`;
    const err = new Error(message) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  const body = await res.json();
  return (body.result ?? body) as ClassroomTransferOwnershipResponse;
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
