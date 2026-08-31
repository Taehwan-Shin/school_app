import type { Role } from '@school-app/shared';

export interface NavItem {
  label: string;
  to: string;
  /**
   * 이 슬라이스에서 아직 라우트가 없는 항목은 `disabled: true` 로 표시한다.
   * Sidebar 는 disabled 항목을 클릭 불가·회색 텍스트로 렌더한다.
   * 라우트가 붙는 다음 슬라이스에서 이 플래그를 제거.
   */
  disabled?: boolean;
}

export const NAV_ITEMS_BY_ROLE: Record<Role, NavItem[]> = {
  super_admin: [
    { label: '대시보드', to: '/super_admin' },
    { label: '계정', to: '/admin' },
    { label: '그룹', to: '/super_admin/groups', disabled: true },
    { label: '챗방', to: '/super_admin/chat', disabled: true },
    { label: '클래스룸', to: '/super_admin/classrooms', disabled: true },
    { label: '감사 로그', to: '/super_admin/audit', disabled: true },
    { label: '시스템 설정', to: '/super_admin/settings', disabled: true },
  ],
  admin: [
    { label: '계정', to: '/admin' },
    { label: '그룹', to: '/admin/groups', disabled: true },
    { label: '챗방', to: '/admin/chat', disabled: true },
    { label: '클래스룸', to: '/admin/classrooms', disabled: true },
  ],
  teacher: [
    { label: '대시보드', to: '/teacher' },
    { label: '내 클래스룸', to: '/teacher/classrooms', disabled: true },
  ],
};

export function getNavItemsForRole(role: Role | null | undefined): NavItem[] {
  if (!role || !(role in NAV_ITEMS_BY_ROLE)) {
    return [];
  }
  return NAV_ITEMS_BY_ROLE[role as Role];
}
