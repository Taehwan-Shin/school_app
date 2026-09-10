import type { Role } from '@school-app/shared';
import {
  LayoutDashboard,
  Users as UsersIcon,
  UsersRound,
  MessagesSquare,
  GraduationCap,
  ClipboardList,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /**
   * 이 슬라이스에서 아직 라우트가 없는 항목은 `disabled: true` 로 표시한다.
   * Sidebar 는 disabled 항목을 클릭 불가·회색 텍스트로 렌더한다.
   */
  disabled?: boolean;
}

export const NAV_ITEMS_BY_ROLE: Record<Role, NavItem[]> = {
  super_admin: [
    { label: '대시보드', to: '/super_admin', icon: LayoutDashboard },
    { label: '계정', to: '/admin', icon: UsersIcon },
    { label: '그룹', to: '/admin/groups', icon: UsersRound },
    { label: '챗방', to: '/super_admin/chat', icon: MessagesSquare },
    { label: '클래스룸', to: '/super_admin/classrooms', icon: GraduationCap },
    { label: '감사 로그', to: '/super_admin/audit', icon: ClipboardList },
    { label: '시스템 설정', to: '/super_admin/settings', icon: Settings, disabled: true },
  ],
  admin: [
    { label: '계정', to: '/admin', icon: UsersIcon },
    { label: '그룹', to: '/admin/groups', icon: UsersRound },
    { label: '챗방', to: '/admin/chat', icon: MessagesSquare },
    { label: '클래스룸', to: '/admin/classrooms', icon: GraduationCap },
  ],
  teacher: [
    { label: '대시보드', to: '/teacher', icon: LayoutDashboard },
    {
      label: '내 클래스룸',
      to: '/teacher/classrooms',
      icon: GraduationCap,
      disabled: true,
    },
  ],
};

export function getNavItemsForRole(role: Role | null | undefined): NavItem[] {
  if (!role || !(role in NAV_ITEMS_BY_ROLE)) {
    return [];
  }
  return NAV_ITEMS_BY_ROLE[role as Role];
}
