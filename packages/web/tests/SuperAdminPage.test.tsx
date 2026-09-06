import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SuperAdminPage } from '../src/routes/super_admin/index';
import type { AuditLogEntryRead } from '../src/api/auditLogList';
import type { UserItem } from '../src/api/usersList';
import type { GroupItem } from '../src/api/groupsList';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

const mockUseUsersList = vi.fn();
const mockUseGroupsList = vi.fn();
const mockUseAuditLogSummary = vi.fn();

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

vi.mock('../src/api/auditLogSummary', () => ({
  useAuditLogSummary: (...args: any[]) => mockUseAuditLogSummary(...args),
}));

function renderWithRouter(ui: React.ReactElement, initialEntries: string[] = ['/super_admin']) {
  return render(<MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>);
}

describe('SuperAdminPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuditLogSummary.mockReturnValue({
      data: { count: 0, entries: [], snapshotAt: Date.now(), generatedAt: Date.now() },
      isLoading: false,
      isError: false,
      error: null,
    });
  });

  it('scenario 1: renders KPI row with cards including "오늘 이벤트" with count fetch', () => {
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

    const mockTodayEntries: AuditLogEntryRead[] = Array.from({ length: 8 }, (_, i) => ({
      id: `today-${i}`,
      actor: 'admin@cam.hs.kr',
      role: 'admin' as const,
      action: `action.today.${i}`,
      target: 'target',
      request_id: `req-today-${i}`,
      result: 'ok' as const,
      at: now - i * 1000,
    }));

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
    mockUseAuditLogSummary.mockReturnValue({
      data: { count: 8, entries: mockTodayEntries, snapshotAt: now, generatedAt: now },
      isLoading: false,
      isError: false,
      error: null,
    });

    renderWithRouter(<SuperAdminPage />);

    const userCard = screen.getByTestId('kpi-card-총 사용자');
    const groupCard = screen.getByTestId('kpi-card-총 그룹');
    const eventCard = screen.getByTestId('kpi-card-오늘 이벤트');

    expect(userCard).toBeDefined();
    expect(groupCard).toBeDefined();
    expect(eventCard).toBeDefined();

    expect(userCard.textContent).toContain('5');
    expect(groupCard.textContent).toContain('3');
    expect(eventCard.textContent).toContain('8');

    expect(mockUseAuditLogSummary).toHaveBeenCalledTimes(1);
    expect(mockUseAuditLogSummary).toHaveBeenCalledWith({ atMin: expect.any(Number) });
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
    mockUseAuditLogSummary.mockReturnValue({
      data: { count: 6, entries: mockEntries, snapshotAt: now, generatedAt: now },
      isLoading: false,
      isError: false,
      error: null,
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

    expect(screen.getByText('오늘 6건의 이벤트가 기록되었습니다.')).toBeDefined();
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
    mockUseAuditLogSummary.mockReturnValue({
      data: { count: 0, entries: [], snapshotAt: Date.now(), generatedAt: Date.now() },
      isLoading: false,
      isError: false,
      error: null,
    });

    renderWithRouter(<SuperAdminPage />);

    expect(screen.getByText('오늘 이벤트가 없습니다.')).toBeDefined();
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

    renderWithRouter(<SuperAdminPage />);

    const suspendedCard = screen.getByTestId('kpi-card-정지된 계정');
    expect(suspendedCard).toBeDefined();
    expect(suspendedCard.textContent).toContain('1');
  });

  it('scenario 5: renders recent event row as link to audit log filtered by actor', () => {
    const now = Date.now();
    const mockEntries: AuditLogEntryRead[] = [
      {
        id: 'log-nav-1',
        actor: 'special-actor@cam.hs.kr',
        role: 'admin',
        action: 'users.create',
        target: 'new@cam.hs.kr',
        request_id: 'req-nav-1',
        result: 'ok',
        at: now - 1000,
      },
    ];

    mockUseUsersList.mockReturnValue({
      data: { users: [] },
      isLoading: false,
      error: null,
    });
    mockUseGroupsList.mockReturnValue({
      data: { groups: [] },
      isLoading: false,
      error: null,
    });
    mockUseAuditLogSummary.mockReturnValue({
      data: { count: 1, entries: mockEntries, snapshotAt: now, generatedAt: now },
      isLoading: false,
      isError: false,
      error: null,
    });

    renderWithRouter(<SuperAdminPage />);

    const eventLink = screen.getByTestId('super-admin-recent-event-log-nav-1');
    expect(eventLink).toBeDefined();
    expect(eventLink.getAttribute('href')).toBe(
      `/super_admin/audit?actor=${encodeURIComponent('special-actor@cam.hs.kr')}`,
    );
  });

  it('scenario 6: clicking "총 사용자" KPI card navigates to /admin', () => {
    mockUseUsersList.mockReturnValue({
      data: { users: [] },
      isLoading: false,
      error: null,
    });
    mockUseGroupsList.mockReturnValue({
      data: { groups: [] },
      isLoading: false,
      error: null,
    });

    renderWithRouter(<SuperAdminPage />);

    fireEvent.click(screen.getByTestId('kpi-card-총 사용자'));
    expect(navigateMock).toHaveBeenCalledWith('/admin');
  });

  it('scenario 7: clicking "총 그룹" KPI card navigates to /admin/groups', () => {
    mockUseUsersList.mockReturnValue({
      data: { users: [] },
      isLoading: false,
      error: null,
    });
    mockUseGroupsList.mockReturnValue({
      data: { groups: [] },
      isLoading: false,
      error: null,
    });

    renderWithRouter(<SuperAdminPage />);

    fireEvent.click(screen.getByTestId('kpi-card-총 그룹'));
    expect(navigateMock).toHaveBeenCalledWith('/admin/groups');
  });

  it('scenario 8: clicking "정지된 계정" KPI card navigates to /admin?filter=suspended', () => {
    mockUseUsersList.mockReturnValue({
      data: { users: [] },
      isLoading: false,
      error: null,
    });
    mockUseGroupsList.mockReturnValue({
      data: { groups: [] },
      isLoading: false,
      error: null,
    });

    renderWithRouter(<SuperAdminPage />);

    fireEvent.click(screen.getByTestId('kpi-card-정지된 계정'));
    expect(navigateMock).toHaveBeenCalledWith('/admin?filter=suspended');
  });

  it('scenario 9: clicking "오늘 이벤트" KPI card navigates to /super_admin/audit?atMin=YYYY-MM-DD', () => {
    mockUseUsersList.mockReturnValue({
      data: { users: [] },
      isLoading: false,
      error: null,
    });
    mockUseGroupsList.mockReturnValue({
      data: { groups: [] },
      isLoading: false,
      error: null,
    });

    renderWithRouter(<SuperAdminPage />);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const yyyy = todayStart.getFullYear();
    const mm = String(todayStart.getMonth() + 1).padStart(2, '0');
    const dd = String(todayStart.getDate()).padStart(2, '0');
    const todayIso = `${yyyy}-${mm}-${dd}`;

    fireEvent.click(screen.getByTestId('kpi-card-오늘 이벤트'));
    expect(navigateMock).toHaveBeenCalledWith(`/super_admin/audit?atMin=${todayIso}`);
  });

  it('scenario 10: accurately displays event count > 500 and 5 entries from useAuditLogSummary', () => {
    mockUseUsersList.mockReturnValue({
      data: { users: [] },
      isLoading: false,
      error: null,
    });
    mockUseGroupsList.mockReturnValue({
      data: { groups: [] },
      isLoading: false,
      error: null,
    });
    mockUseAuditLogSummary.mockReturnValue({
      data: {
        count: 750,
        entries: Array.from({ length: 5 }, (_, i) => ({
          id: `prev-${i}`,
          actor: `actor${i}@cam.hs.kr`,
          role: 'admin' as const,
          action: 'users.create',
          target: 'target',
          request_id: `req-${i}`,
          result: 'ok' as const,
          at: Date.now() - i * 1000,
        })),
        snapshotAt: Date.now(),
        generatedAt: Date.now(),
      },
      isLoading: false,
      isError: false,
      error: null,
    });

    renderWithRouter(<SuperAdminPage />);

    const eventCard = screen.getByTestId('kpi-card-오늘 이벤트');
    expect(eventCard.textContent).toContain('750');
    expect(screen.getByText('오늘 750건의 이벤트가 기록되었습니다.')).toBeDefined();

    const recentList = screen.getByTestId('super-admin-recent-events');
    expect(recentList.children.length).toBe(5);
  });

  it('scenario 11: renders preview loading indicator when todayAudit is loading', () => {
    mockUseUsersList.mockReturnValue({
      data: { users: [] },
      isLoading: false,
      error: null,
    });
    mockUseGroupsList.mockReturnValue({
      data: { groups: [] },
      isLoading: false,
      error: null,
    });
    mockUseAuditLogSummary.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    });

    renderWithRouter(<SuperAdminPage />);

    expect(screen.getByTestId('super-admin-preview-loading')).toBeDefined();
    expect(screen.getAllByText('불러오는 중...')).toHaveLength(2);
    expect(screen.queryByText('오늘 이벤트가 없습니다.')).toBeNull();
    expect(screen.queryByTestId('super-admin-recent-events')).toBeNull();
    expect(screen.queryByTestId('super-admin-preview-error')).toBeNull();
  });

  it('scenario 12: renders preview error message when todayAudit encounters an error and displays dash for count error', () => {
    mockUseUsersList.mockReturnValue({
      data: { users: [] },
      isLoading: false,
      error: null,
    });
    mockUseGroupsList.mockReturnValue({
      data: { groups: [] },
      isLoading: false,
      error: null,
    });
    mockUseAuditLogSummary.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Network error loading audit logs'),
    });

    renderWithRouter(<SuperAdminPage />);

    expect(screen.getByTestId('super-admin-preview-error')).toBeDefined();
    expect(
      screen.getByText('감사 로그를 불러오지 못했습니다: Network error loading audit logs'),
    ).toBeDefined();
    expect(screen.getByText('오늘 이벤트를 불러오지 못했습니다.')).toBeDefined();
    expect(screen.queryByText('오늘 이벤트가 없습니다.')).toBeNull();
    expect(screen.queryByTestId('super-admin-preview-loading')).toBeNull();
    expect(screen.queryByTestId('super-admin-recent-events')).toBeNull();

    const eventCard = screen.getByTestId('kpi-card-오늘 이벤트');
    expect(eventCard.textContent).toContain('—');
  });

  it('scenario 13: header description distinguishes loading, error, and empty success states without contradiction', () => {
    mockUseUsersList.mockReturnValue({
      data: { users: [] },
      isLoading: false,
      error: null,
    });
    mockUseGroupsList.mockReturnValue({
      data: { groups: [] },
      isLoading: false,
      error: null,
    });

    // 1. loading
    mockUseAuditLogSummary.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    });
    const { unmount: unmountLoading } = renderWithRouter(<SuperAdminPage />);
    expect(screen.queryByText('오늘 이벤트가 없습니다.')).toBeNull();
    expect(screen.getAllByText('불러오는 중...')).toHaveLength(2);
    unmountLoading();

    // 2. error
    mockUseAuditLogSummary.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Failed to load'),
    });
    const { unmount: unmountError } = renderWithRouter(<SuperAdminPage />);
    expect(screen.queryByText('오늘 이벤트가 없습니다.')).toBeNull();
    expect(screen.getByText('오늘 이벤트를 불러오지 못했습니다.')).toBeDefined();
    unmountError();

    // 3. success with 0 events
    mockUseAuditLogSummary.mockReturnValue({
      data: { count: 0, entries: [], snapshotAt: Date.now(), generatedAt: Date.now() },
      isLoading: false,
      isError: false,
      error: null,
    });
    renderWithRouter(<SuperAdminPage />);
    expect(screen.getByText('오늘 이벤트가 없습니다.')).toBeDefined();
    expect(screen.queryByText('불러오는 중...')).toBeNull();
    expect(screen.queryByText('오늘 이벤트를 불러오지 못했습니다.')).toBeNull();
  });
});
