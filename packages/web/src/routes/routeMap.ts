import type { Role } from '@school-app/shared';

export const ROLE_ROUTE_MAP: Record<Role, string> = {
  super_admin: '/super_admin',
  admin: '/admin',
  // v0.325: 교사는 우선 「메시지 발송」 만 사용 (bliss00 결정 2026-10-03).
  teacher: '/teacher/messages',
};

export function getRouteForRole(role: Role | null | undefined): string {
  if (!role || !(role in ROLE_ROUTE_MAP)) {
    return '/login';
  }
  return ROLE_ROUTE_MAP[role as Role];
}
