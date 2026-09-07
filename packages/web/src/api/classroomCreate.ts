import { useMutation, useQueryClient } from '@tanstack/react-query';
import { auth } from '../lib/firebase';
import { getGoogleAccessTokenFromSession } from '../lib/auth';
import type { ClassroomCourse } from './classroomList';

export interface ClassroomCreateRequest {
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
  const user = auth.currentUser;
  if (!user) {
    throw new Error('not_authenticated');
  }
  const idToken = await user.getIdToken();
  const googleAccessToken = getGoogleAccessTokenFromSession() || '';

  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'school-app-5a636';
  const url = import.meta.env.DEV
    ? `http://127.0.0.1:5001/${projectId}/asia-northeast3/classroomCreate`
    : `https://asia-northeast3-${projectId}.cloudfunctions.net/classroomCreate`;

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
      'X-Google-Scopes': 'https://www.googleapis.com/auth/classroom.courses',
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
  return (body.result ?? body) as ClassroomCreateResponse;
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
