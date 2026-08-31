import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth, signInWithGoogle, signInWithEmulator } from '../lib/auth';
import { getRouteForRole } from './routeMap';

export function LoginPage() {
  const { user, role, loading } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [emulatorEmail, setEmulatorEmail] = useState('test@cam.hs.kr');

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <p className="text-small text-fg-secondary">로딩 중...</p>
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
    <div className="min-h-screen bg-canvas flex items-center justify-center px-6">
      <div className="w-full max-w-md p-8 bg-elevated border border-border-subtle">
        <div>
          <h1 className="text-h2 font-bold text-fg-primary">학교 워크스페이스 관리</h1>
          <p className="text-small text-fg-secondary mt-2">
            Google 계정(cam.hs.kr)으로 로그인하세요
          </p>
        </div>

        {errorMessage && (
          <div className="mt-4 px-4 py-3 border border-state-danger text-state-danger text-small">
            {errorMessage}
          </div>
        )}

        <div className="mt-8 space-y-4">
          <button
            type="button"
            onClick={handleLogin}
            disabled={signingIn}
            className="w-full px-6 py-3 bg-accent-primary text-accent-on-primary text-body font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity text-center block"
          >
            구글 계정으로 로그인 →
          </button>
          <p className="text-small text-fg-muted mt-4 text-center">
            허용된 도메인(cam.hs.kr) 이외의 계정은 로그인이 차단됩니다.
          </p>
        </div>

        {import.meta.env.DEV && (
          <div className="mt-6 pt-6 border-t border-border-subtle space-y-3">
            <p className="text-micro font-medium uppercase tracking-wide text-fg-secondary">
              개발 환경 에뮬레이터 로그인
            </p>
            <form onSubmit={handleEmulatorLogin} className="space-y-3">
              <input
                type="email"
                value={emulatorEmail}
                onChange={(e) => setEmulatorEmail(e.target.value)}
                placeholder="test@cam.hs.kr"
                className="w-full px-3 py-2 text-body border border-border-subtle bg-canvas text-fg-primary focus:outline-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
                required
              />
              <button
                type="submit"
                disabled={signingIn}
                className="w-full border border-border-subtle text-fg-primary px-4 py-2 text-body hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                에뮬레이터로 로그인
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

