import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SuperAdminPage } from '../src/routes/super_admin/index';
import type { AuditLogEntryRead } from '../src/api/auditLogList';
import type { UserItem } from '../src/api/usersList';
import type { GroupItem } from '../src/api/groupsList';

const mockUseUsersList = vi.fn();
const mockUseGroupsList = vi.fn();
const mockUseAuditLogList = vi.fn();

vi.mock('../src/lib/auth', () => ({
  useAuth: () => ({
    user: { email: 'super@cam.hs.kr' },
    role: 'super_admin',
    loading: false,
  }),
  signOut: vi.fn(),
}));

vi.mock('../src/lib/theme', () => ({
  useTheme: () => ({
    theme: 'light',
    toggleTheme: vi.fn(),
    setTheme: vi.fn(),
  }),
}));

vi.mock('../src/api/usersList', () => ({
  useUsersList: () => mockUseUsersList(),
}));

vi.mock('../src/api/groupsList', () => ({
  useGroupsList: () => mockUseGroupsList(),
}));

vi.mock('../src/api/auditLogList', () => ({
  useAuditLogList: (limit?: number) => mockUseAuditLogList(limit),
}));

function renderWithRouter(ui: React.ReactElement, initialEntries: string[] = ['/super_admin']) {
  return render(<MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>);
}

describe('SuperAdminPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('scenario 1: renders KPI row with 3 cards (total users, total groups, recent 24h events)', () => {
    const mockUsers: UserItem[] = [
      { email: 'u1@cam.hs.kr', firstName: '일', lastName: '김', orgUnitPath: '/', isAdmin: false, isSuspended: false },
      { email: 'u2@cam.hs.kr', firstName: '이', lastName: '김', orgUnitPath: '/', isAdmin: false, isSuspended: false },
      { email: 'u3@cam.hs.kr', firstName: '삼', lastName: '이', orgUnitPath: '/', isAdmin: false, isSuspended: false },
      { email: 'u4@cam.hs.kr', firstName: '사', lastName: '박', orgUnitPath: '/', isAdmin: false, isSuspended: false },
      { email: 'u5@cam.hs.kr', firstName: '오', lastName: '최', orgUnitPath: '/', isAdmin: false, isSuspended: false },
    ];

    const mockGroups: GroupItem[] = [
      { email: 'g1@cam.hs.kr', name: '그룹1', description: '설명1', aliases: [], directMembersCount: 2 },
      { email: 'g2@cam.hs.kr', name: '그룹2', description: '설명2', aliases: [], directMembersCount: 4 },
      { email: 'g3@cam.hs.kr', name: '그룹3', description: '설명3', aliases: [], directMembersCount: 0 },
    ];

    const now = Date.now();
    const mockEntries: AuditLogEntryRead[] = [
      ...Array.from({ length: 5 }, (_, i) => ({
        id: `recent-${i}`,
        actor: 'admin@cam.hs.kr',
        role: 'admin' as const,
        action: `action.recent.${i}`,
        target: 'target',
        request_id: `req-recent-${i}`,
        result: 'ok' as const,
        at: now - (i + 1) * 3600 * 1000,
      })),
      ...Array.from({ length: 5 }, (_, i) => ({
        id: `old-${i}`,
        actor: 'admin@cam.hs.kr',
        role: 'admin' as const,
        action: `action.old.${i}`,
        target: 'target',
        request_id: `req-old-${i}`,
        result: 'ok' as const,
        at: now - (25 + i) * 3600 * 1000,
      })),
    ];

    mockUseUsersList.mockReturnValue({
      data: { users: mockUsers },
      isLoading: false,
      error: null,
    });
    mockUseGroupsList.mockReturnValue({
      data: { groups: mockGroups },
      isLoading: false,
      error: null,
    });
    mockUseAuditLogList.mockReturnValue({
      entries: mockEntries,
      loading: false,
      error: null,
    });

    renderWithRouter(<SuperAdminPage />);

    const userCard = screen.getByTestId('kpi-card-총 사용자');
    const groupCard = screen.getByTestId('kpi-card-총 그룹');
    const eventCard = screen.getByTestId('kpi-card-최근 24시간 이벤트');

    expect(userCard).toBeDefined();
    expect(groupCard).toBeDefined();
    expect(eventCard).toBeDefined();

    expect(userCard.textContent).toContain('5');
    expect(groupCard.textContent).toContain('3');
    expect(eventCard.textContent).toContain('5');
  });

  it('scenario 2: renders up to 5 recent events preview with action and result under super-admin-recent-events', () => {
    const now = Date.now();
    const mockEntries: AuditLogEntryRead[] = [
      {
        id: 'log-1',
        actor: 'admin@cam.hs.kr',
        role: 'admin',
        action: 'users.create',
        target: 'new@cam.hs.kr',
        request_id: 'req-1',
        result: 'ok',
        at: now - 1000,
      },
      {
        id: 'log-2',
        actor: 'admin@cam.hs.kr',
        role: 'admin',
        action: 'groups.delete',
        target: 'old-group@cam.hs.kr',
        request_id: 'req-2',
        result: 'error',
        at: now - 2000,
      },
      {
        id: 'log-3',
        actor: 'teacher@cam.hs.kr',
        role: 'teacher',
        action: 'users.delete',
        target: 'target@cam.hs.kr',
        request_id: 'req-3',
        result: 'denied',
        at: now - 3000,
      },
      {
        id: 'log-4',
        actor: 'admin@cam.hs.kr',
        role: 'admin',
        action: 'groups.create',
        target: 'g2@cam.hs.kr',
        request_id: 'req-4',
        result: 'ok',
        at: now - 4000,
      },
      {
        id: 'log-5',
        actor: 'admin@cam.hs.kr',
        role: 'admin',
        action: 'users.suspend',
        target: 'suspended@cam.hs.kr',
        request_id: 'req-5',
        result: 'ok',
        at: now - 5000,
      },
      {
        id: 'log-6',
        actor: 'admin@cam.hs.kr',
        role: 'admin',
        action: 'users.update',
        target: 'u6@cam.hs.kr',
        request_id: 'req-6',
        result: 'ok',
        at: now - 6000,
      },
    ];

    mockUseUsersList.mockReturnValue({
      data: { users: [] },
      isLoading: false,
    });
    mockUseGroupsList.mockReturnValue({
      data: { groups: [] },
      isLoading: false,
    });
    mockUseAuditLogList.mockReturnValue({
      entries: mockEntries,
      loading: false,
    });

    renderWithRouter(<SuperAdminPage />);

    const recentList = screen.getByTestId('super-admin-recent-events');
    expect(recentList).toBeDefined();
    expect(recentList.children.length).toBe(5);

    expect(screen.getByText('users.create')).toBeDefined();
    expect(screen.getByText('groups.delete')).toBeDefined();
    expect(screen.getByText('users.delete')).toBeDefined();
    expect(screen.getByText('groups.create')).toBeDefined();
    expect(screen.getByText('users.suspend')).toBeDefined();
    expect(screen.queryByText('users.update')).toBeNull();

    expect(screen.getByText('최근 24시간에 6건의 이벤트가 기록되었습니다.')).toBeDefined();
    expect(screen.getByText('감사 로그 전체 보기 →')).toBeDefined();
  });

  it('scenario 3: renders empty event message when no recent events exist', () => {
    mockUseUsersList.mockReturnValue({
      data: { users: [] },
      isLoading: false,
    });
    mockUseGroupsList.mockReturnValue({
      data: { groups: [] },
      isLoading: false,
    });
    mockUseAuditLogList.mockReturnValue({
      entries: [],
      loading: false,
    });

    renderWithRouter(<SuperAdminPage />);

    expect(screen.getByText('최근 24시간에 이벤트가 없습니다.')).toBeDefined();
    expect(screen.queryByTestId('super-admin-recent-events')).toBeNull();
  });

  it('scenario 4: renders suspended accounts KPI card with count of suspended users (1 out of 3)', () => {
    const mockUsers: UserItem[] = [
      { email: 'u1@cam.hs.kr', firstName: '일', lastName: '김', orgUnitPath: '/', isAdmin: false, isSuspended: false },
      { email: 'u2@cam.hs.kr', firstName: '이', lastName: '김', orgUnitPath: '/', isAdmin: false, isSuspended: true },
      { email: 'u3@cam.hs.kr', firstName: '삼', lastName: '이', orgUnitPath: '/', isAdmin: false, isSuspended: false },
    ];

    mockUseUsersList.mockReturnValue({
      data: { users: mockUsers },
      isLoading: false,
      error: null,
    });
    mockUseGroupsList.mockReturnValue({
      data: { groups: [] },
      isLoading: false,
      error: null,
    });
    mockUseAuditLogList.mockReturnValue({
      entries: [],
      loading: false,
      error: null,
    });

    renderWithRouter(<SuperAdminPage />);

    const suspendedCard = screen.getByTestId('kpi-card-정지된 계정');
    expect(suspendedCard).toBeDefined();
    expect(suspendedCard.textContent).toContain('1');
  });
});
