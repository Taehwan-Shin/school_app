import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onIdTokenChanged,
  User,
} from 'firebase/auth';
import { auth } from './firebase';
import type { Role } from '@school-app/shared';

export function getGoogleAccessTokenFromSession(): string | null {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage.getItem('googleAccessToken');
}

export function setGoogleAccessTokenToSession(token: string): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem('googleAccessToken', token);
}

export function clearGoogleAccessTokenFromSession(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem('googleAccessToken');
}

/**
 * `users.list` callable 이 서버에서 요구하는 스코프. 로그인 시 사용자에게 동의를 받아
 * 발급된 access token 에 이 스코프가 포함되도록 한다.
 * 새 관리 기능이 늘어나면 여기에 추가한다.
 */
export const GOOGLE_LOGIN_SCOPES = [
  'https://www.googleapis.com/auth/admin.directory.user.readonly',
  'https://www.googleapis.com/auth/admin.directory.user',
  'https://www.googleapis.com/auth/admin.directory.group.readonly',
  'https://www.googleapis.com/auth/admin.directory.group',
  'https://www.googleapis.com/auth/admin.directory.group.member.readonly',
  'https://www.googleapis.com/auth/admin.directory.group.member',
  'https://www.googleapis.com/auth/admin.directory.user.security',
  // v0.146: OU 조회/생성. v0.119 (orgunitsList) · v0.121 (orgunitsCreate) 도입
  // 시 로그인 스코프에 추가하지 못해 재로그인해도 insufficient_scope 발생.
  'https://www.googleapis.com/auth/admin.directory.orgunit.readonly',
  'https://www.googleapis.com/auth/admin.directory.orgunit',
  'https://www.googleapis.com/auth/chat.spaces',
  'https://www.googleapis.com/auth/chat.memberships',
  'https://www.googleapis.com/auth/classroom.courses',
  'https://www.googleapis.com/auth/classroom.rosters',
] as const;

export async function signInWithGoogle(options?: { forceConsent?: boolean }) {
  const provider = new GoogleAuthProvider();
  for (const scope of GOOGLE_LOGIN_SCOPES) {
    provider.addScope(scope);
  }
  // v0.147: forceConsent=true 일 때 prompt='consent' 로 Google 재동의 화면을
  // 강제. Google 은 기본적으로 이미 승인된 scope 는 재동의 화면을 skip 하는데,
  // 사용자의 이전 access token 에 우리 앱이 요구하는 최신 scope 가 없으면
  // 다음 로그인에서도 그대로 부족한 채 로그인 완료돼 문제 반복.
  provider.setCustomParameters({
    hd: 'cam.hs.kr',
    prompt: options?.forceConsent ? 'consent' : 'select_account',
  });
  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (credential?.accessToken) {
    setGoogleAccessTokenToSession(credential.accessToken);
  }
  return result;
}

// v0.147: 스코프 부족 등으로 재인증이 필요한 경우 한 번의 호출로 (1) 세션 토큰
// 삭제 (2) Firebase 로그아웃 (3) Google 재동의 강제 재로그인.
export async function reauthorizeWithGoogle() {
  clearGoogleAccessTokenFromSession();
  await firebaseSignOut(auth);
  return signInWithGoogle({ forceConsent: true });
}

export async function signInWithEmulator(email: string): Promise<void> {
  if (!import.meta.env.DEV) {
    throw new Error('signInWithEmulator is only available in development mode.');
  }
  try {
    await signInWithEmailAndPassword(auth, email, 'password');
  } catch {
    await createUserWithEmailAndPassword(auth, email, 'password');
  }
  setGoogleAccessTokenToSession('emulator-fake-token');
}

export async function signOut() {
  clearGoogleAccessTokenFromSession();
  return firebaseSignOut(auth);
}

export interface AuthState {
  user: User | null;
  role: Role | null;
  loading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthState>({
  user: null,
  role: null,
  loading: true,
  error: null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (currentUser) => {
      try {
        if (currentUser) {
          // 서버(beforeUserCreated 트리거)만 role 을 심을 수 있고, getMe 도
          // role 미부여 시 failed-precondition 을 던진다. 여기서도 강제 검증:
          // 알 수 없는 role 은 null 로 남겨 로그인 페이지로 되돌린다.
          const tokenResult = await currentUser.getIdTokenResult();
          const raw = tokenResult.claims.role;
          const claimRole =
            raw === 'super_admin' || raw === 'admin' || raw === 'teacher'
              ? (raw as Role)
              : null;
          setUser(currentUser);
          setRole(claimRole);
        } else {
          setUser(null);
          setRole(null);
        }
      } catch (err: any) {
        setError(err.message || '인증 상태 확인 실패');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, loading, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
