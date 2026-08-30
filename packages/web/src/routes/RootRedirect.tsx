import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { getRouteForRole } from './routeMap';

export function RootRedirect() {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-slate-600 text-sm">인증 확인 중...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const targetPath = getRouteForRole(role);
  return <Navigate to={targetPath} replace />;
}
