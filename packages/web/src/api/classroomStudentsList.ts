import { useQuery } from '@tanstack/react-query';
import { auth } from '../lib/firebase';
import { getGoogleAccessTokenFromSession } from '../lib/auth';

export interface ClassroomStudent {
  courseId: string;
  userId: string;
  profile?: {
    id?: string;
    name?: { fullName?: string; givenName?: string; familyName?: string };
    emailAddress?: string;
    photoUrl?: string;
  };
}

export interface ClassroomStudentsListRequest {
  courseId: string;
}

export interface ClassroomStudentsListResponse {
  students: ClassroomStudent[];
}

export async function callClassroomStudentsList(
  data: ClassroomStudentsListRequest,
): Promise<ClassroomStudentsListResponse> {
  const user = auth.currentUser;
  if (!user) throw new Error('not_authenticated');
  const idToken = await user.getIdToken();
  const googleAccessToken = getGoogleAccessTokenFromSession() || '';

  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'school-app-5a636';
  const url = import.meta.env.DEV
    ? `http://127.0.0.1:5001/${projectId}/asia-northeast3/classroomStudentsList`
    : `https://asia-northeast3-${projectId}.cloudfunctions.net/classroomStudentsList`;

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
      'X-Google-Scopes': 'https://www.googleapis.com/auth/classroom.rosters',
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
  return (body.result ?? body) as ClassroomStudentsListResponse;
}

export function useClassroomStudentsList(courseId: string | null, enabled = true) {
  return useQuery<ClassroomStudentsListResponse, Error>({
    queryKey: ['classroom', 'students', courseId],
    queryFn: () => callClassroomStudentsList({ courseId: courseId! }),
    enabled: enabled && !!courseId,
    staleTime: 60_000,
    retry: (failureCount, error) => {
      const status = (error as Error & { status?: number }).status;
      if (status !== undefined && status >= 400 && status < 500) return false;
      return failureCount < 2;
    },
  });
}
