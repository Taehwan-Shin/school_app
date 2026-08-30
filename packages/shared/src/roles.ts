export type Role = 'super_admin' | 'admin' | 'teacher';

export const ROLES: readonly Role[] = ['super_admin', 'admin', 'teacher'] as const;

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: '슈퍼 관리자',
  admin: '관리자',
  teacher: '교사',
};
