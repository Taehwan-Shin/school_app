import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { getRouteForRole } from './routeMap';
import type { Role } from '@school-app/shared';

interface RoleGuardProps {
  expectedRole: Role;
}

export function RoleGuard({ expectedRole }: RoleGuardProps) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-slate-600 text-sm">권한 확인 중...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (role !== expectedRole) {
    const correctRoute = getRouteForRole(role);
    return <Navigate to={correctRoute} replace />;
  }

  return <Outlet />;
}
