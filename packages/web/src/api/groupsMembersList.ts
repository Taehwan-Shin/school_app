import { useState, useEffect, useCallback, useRef } from 'react';
import { auth } from '../lib/firebase';
import { getGoogleAccessTokenFromSession } from '../lib/auth';

export interface GroupMemberItem {
  email: string;
  role: 'OWNER' | 'MANAGER' | 'MEMBER';
  type: 'USER' | 'GROUP' | 'CUSTOMER' | 'EXTERNAL';
  status: string;
}

export interface GroupsMembersListRequest {
  groupEmail: string;
  pageToken?: string;
  maxResults?: number;
}

export interface GroupsMembersListResponse {
  members: GroupMemberItem[];
  nextPageToken: string | null;
}

export async function callGroupsMembersList(
  data: GroupsMembersListRequest
): Promise<GroupsMembersListResponse> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('not_authenticated');
  }
  const idToken = await user.getIdToken();
  const googleAccessToken = getGoogleAccessTokenFromSession() || '';

  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'school-app-5a636';
  const url = import.meta.env.DEV
    ? `http://127.0.0.1:5001/${projectId}/asia-northeast3/groupsMembersList`
    : `https://asia-northeast3-${projectId}.cloudfunctions.net/groupsMembersList`;

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
      'X-Google-Scopes': 'https://www.googleapis.com/auth/admin.directory.group.member.readonly',
      'X-Request-Id': requestId,
    },
    body: JSON.stringify({ data: { ...data, _googleAccessToken: googleAccessToken } }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = body.error?.message ?? `http_${res.status}`;
    const err = new Error(message) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  const body = await res.json();
  return (body.result ?? body) as GroupsMembersListResponse;
}

export function useGroupMembersList(
  groupEmail: string,
  pageSize = 100
): {
  members: GroupMemberItem[];
  loading: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => void;
  reload: () => void;
} {
  const [members, setMembers] = useState<GroupMemberItem[]>([]);
  const [loading, setLoading] = useState(Boolean(groupEmail));
  const [error, setError] = useState<Error | null>(null);
  const [pageToken, setPageToken] = useState<string | null | undefined>(undefined);
  const [fetchTrigger, setFetchTrigger] = useState(0);

  const pageTokenRef = useRef(pageToken);
  pageTokenRef.current = pageToken;
  const loadingRef = useRef(loading);
  loadingRef.current = loading;

  const fetchPage = useCallback(
    async (targetPageToken?: string, isReload = false) => {
      if (!groupEmail) {
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await callGroupsMembersList({
          groupEmail,
          maxResults: pageSize,
          pageToken: targetPageToken,
        });
        if (isReload) {
          setMembers(res.members);
        } else {
          setMembers((prev) =>
            targetPageToken !== undefined ? [...prev, ...res.members] : res.members
          );
        }
        setPageToken(res.nextPageToken);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    },
    [groupEmail, pageSize]
  );

  useEffect(() => {
    let cancelled = false;
    if (!groupEmail) {
      setMembers([]);
      setLoading(false);
      setError(null);
      setPageToken(null);
      return;
    }
    setLoading(true);
    setError(null);
    callGroupsMembersList({ groupEmail, maxResults: pageSize })
      .then((res) => {
        if (!cancelled) {
          setMembers(res.members);
          setPageToken(res.nextPageToken);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [groupEmail, pageSize, fetchTrigger]);

  const loadMore = useCallback(() => {
    if (loadingRef.current || !pageTokenRef.current) {
      return;
    }
    fetchPage(pageTokenRef.current, false);
  }, [fetchPage]);

  const reload = useCallback(() => {
    setFetchTrigger((c) => c + 1);
  }, []);

  const hasMore = Boolean(pageToken);

  return {
    members,
    loading,
    error,
    hasMore,
    loadMore,
    reload,
  };
}
