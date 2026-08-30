import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth, signInWithGoogle, signInWithEmulator } from '../lib/auth';
import { getRouteForRole } from './routeMap';
import { Button } from '../components/ui/button';

export function LoginPage() {
  const { user, role, loading } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [emulatorEmail, setEmulatorEmail] = useState('test@cam-t.kr');

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-slate-600 text-sm">로딩 중...</p>
      </div>
    );
  }

  if (user) {
    return <Navigate to={getRouteForRole(role)} replace />;
  }

  const handleLogin = async () => {
    setSigningIn(true);
    setErrorMessage(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setErrorMessage(err.message || '로그인에 실패했습니다.');
    } finally {
      setSigningIn(false);
    }
  };

  const handleEmulatorLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSigningIn(true);
    setErrorMessage(null);
    try {
      await signInWithEmulator(emulatorEmail);
    } catch (err: any) {
      setErrorMessage(err.message || '에뮬레이터 로그인에 실패했습니다.');
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-sm border border-slate-200 p-8 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-slate-900">학교 워크스페이스 관리</h1>
          <p className="text-sm text-slate-600">
            Google 계정(@cam-t.kr)으로 로그인하세요.
          </p>
        </div>

        {errorMessage && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-md">
            {errorMessage}
          </div>
        )}

        <div className="space-y-4">
          <Button
            onClick={handleLogin}
            disabled={signingIn}
            className="w-full flex items-center justify-center gap-2"
          >
            <span>Google 계정으로 로그인</span>
          </Button>
          <p className="text-xs text-slate-500 text-center">
            허용된 도메인(@cam-t.kr) 이외의 계정은 자동으로 삭제됩니다.
          </p>
        </div>

        {import.meta.env.DEV && (
          <div className="pt-4 border-t border-slate-200 space-y-3">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
              개발 환경 에뮬레이터 로그인
            </p>
            <form onSubmit={handleEmulatorLogin} className="space-y-2">
              <input
                type="email"
                value={emulatorEmail}
                onChange={(e) => setEmulatorEmail(e.target.value)}
                placeholder="test@cam-t.kr"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400"
                required
              />
              <Button
                type="submit"
                variant="outline"
                disabled={signingIn}
                className="w-full text-sm"
              >
                에뮬레이터로 로그인
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
