import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { getRouteForRole } from './routeMap';
import type { Role } from '@school-app/shared';

interface RoleGuardProps {
  /**
   * 정확히 이 role 만 통과. 단일 값 편의 문법.
   * `expectedRoles` 와 함께 쓰지 마라 (두 값이 있으면 `expectedRoles` 가 이긴다).
   */
  expectedRole?: Role;
  /**
   * 이 role 목록 안에 있으면 통과 — 「이상」 개념 없이 명시 집합.
   * 예: `/admin` 라우트는 `['super_admin', 'admin']`.
   */
  expectedRoles?: readonly Role[];
}

export function RoleGuard({ expectedRole, expectedRoles }: RoleGuardProps) {
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

  const allowed = expectedRoles ?? (expectedRole ? [expectedRole] : []);
  if (!role || !allowed.includes(role)) {
    const correctRoute = getRouteForRole(role);
    return <Navigate to={correctRoute} replace />;
  }

  return <Outlet />;
}
