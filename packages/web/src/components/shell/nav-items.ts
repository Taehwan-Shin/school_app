import type { Role } from '@school-app/shared';

export interface NavItem {
  label: string;
  to: string;
}

export const NAV_ITEMS_BY_ROLE: Record<Role, NavItem[]> = {
  super_admin: [
    { label: '대시보드', to: '/super_admin' },
    { label: '계정', to: '/admin' },
    { label: '그룹', to: '/super_admin/groups' },
    { label: '챗방', to: '/super_admin/chat' },
    { label: '클래스룸', to: '/super_admin/classrooms' },
    { label: '감사 로그', to: '/super_admin/audit' },
    { label: '시스템 설정', to: '/super_admin/settings' },
  ],
  admin: [
    { label: '대시보드', to: '/admin' },
    { label: '계정', to: '/admin' },
    { label: '그룹', to: '/admin/groups' },
    { label: '챗방', to: '/admin/chat' },
    { label: '클래스룸', to: '/admin/classrooms' },
  ],
  teacher: [
    { label: '대시보드', to: '/teacher' },
    { label: '내 클래스룸', to: '/teacher/classrooms' },
  ],
};

export function getNavItemsForRole(role: Role | null | undefined): NavItem[] {
  if (!role || !(role in NAV_ITEMS_BY_ROLE)) {
    return [];
  }
  return NAV_ITEMS_BY_ROLE[role as Role];
}
