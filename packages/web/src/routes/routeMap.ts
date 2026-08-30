import type { Role } from '@school-app/shared';

export const ROLE_ROUTE_MAP: Record<Role, string> = {
  super_admin: '/super_admin',
  admin: '/admin',
  teacher: '/teacher',
};

export function getRouteForRole(role: Role | null | undefined): string {
  if (!role || !(role in ROLE_ROUTE_MAP)) {
    return '/login';
  }
  return ROLE_ROUTE_MAP[role as Role];
}
