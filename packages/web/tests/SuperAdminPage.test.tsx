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

const mockUseAuditLogList = vi.fn();
vi.mock('../src/api/auditLogList', () => ({
  useAuditLogList: (...args: any[]) => mockUseAuditLogList(...args),
}));

// v0.107c: server aggregation callable hook mock.
const mockUseUnresolvedRoleSplits = vi.fn();
vi.mock('../src/api/auditLogUnresolvedRoleSplits', () => ({
  useAuditLogUnresolvedRoleSplits: (...args: any[]) => mockUseUnresolvedRoleSplits(...args),
}));

// v0.107: role_split 자동 복구 hook mock.
const mockResolveMutate = vi.fn();
const mockUseUsersResolveRoleSplit = vi.fn();
vi.mock('../src/api/usersResolveRoleSplit', () => ({
  useUsersResolveRoleSplit: () => mockUseUsersResolveRoleSplit(),
}));

// v0.107f F51 / v0.109c F57: 상태 재확인 hook mock. mutate + mutateAsync 둘 다 필요
// (v0.109c 부터 auto batch 는 mutateAsync 사용).
const mockRecheckMutate = vi.fn();
const mockRecheckMutateAsync = vi.fn();
const mockUseUsersRecheckRoleSplit = vi.fn();
vi.mock('../src/api/usersRecheckRoleSplit', () => ({
  useUsersRecheckRoleSplit: () => mockUseUsersRecheckRoleSplit(),
}));

// react-query useQueryClient stub — reloadUnresolved 은 invalidateQueries 호출.
const mockInvalidateQueries = vi.fn();
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
  };
});

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
    mockUseAuditLogList.mockReturnValue({
      entries: [],
      loading: false,
      error: null,
      hasMore: false,
      loadMore: vi.fn(),
      reload: vi.fn(),
    });
    mockUseUnresolvedRoleSplits.mockReturnValue({
      data: {
        entries: [],
        scannedDetected: 0,
        scannedResolved: 0,
        detectedHasMore: false,
        resolvedHasMore: false,
      },
      isLoading: false,
      isError: false,
      error: null,
    });
    mockInvalidateQueries.mockReset();
    mockResolveMutate.mockReset();
    mockUseUsersResolveRoleSplit.mockReturnValue({
      mutate: mockResolveMutate,
      isPending: false,
      error: null,
    });
    mockRecheckMutate.mockReset();
    mockRecheckMutateAsync.mockReset();
    // 기본: mutateAsync 는 즉시 resolve.
    mockRecheckMutateAsync.mockResolvedValue({});
    mockUseUsersRecheckRoleSplit.mockReturnValue({
      mutate: mockRecheckMutate,
      mutateAsync: mockRecheckMutateAsync,
      isPending: false,
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

    // v0.122: 상단 「오늘 이벤트」 KpiCard/preview 용 + breakdown 용 두 번 호출.
    // v0.126: breakdown 호출은 exact 파라미터도 함께 전달 (기본 false).
    expect(mockUseAuditLogSummary).toHaveBeenCalledTimes(2);
    expect(mockUseAuditLogSummary).toHaveBeenNthCalledWith(1, { atMin: expect.any(Number) });
    expect(mockUseAuditLogSummary).toHaveBeenNthCalledWith(2, {
      atMin: expect.any(Number),
      exact: false,
    });
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
    // v0.120: super-admin-breakdown-loading 도 「불러오는 중...」 이므로 3.
    expect(screen.getAllByText('불러오는 중...')).toHaveLength(3);
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
    // v0.120: super-admin-breakdown-loading 도 「불러오는 중...」 이므로 3.
    expect(screen.getAllByText('불러오는 중...')).toHaveLength(3);
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

  // v0.107c: server aggregation callable 로 전환. detected/resolved 두 feed reconcile 을
  // 서버에서 처리 → client 는 단일 unresolved 리스트만 렌더.
  describe('v0.107c: role_split (server aggregation)', () => {
    const roleSplitEntry: AuditLogEntryRead = {
      id: 'log-rs-x',
      actor: 'super@cam.hs.kr',
      role: 'super_admin',
      action: 'system.role_split_detected',
      target: 'users/uid-target-1',
      request_id: 'req-1',
      result: 'error',
      at: 1725150000000,
      message: 'role_split: auth=admin firestore=teacher',
    };

    function mockUnresolved(opts: {
      entries?: AuditLogEntryRead[];
      isLoading?: boolean;
      isError?: boolean;
      detectedHasMore?: boolean;
      resolvedHasMore?: boolean;
    }) {
      mockUseUnresolvedRoleSplits.mockReturnValue({
        data: opts.isError
          ? undefined
          : {
              entries: opts.entries ?? [],
              scannedDetected: opts.entries?.length ?? 0,
              scannedResolved: 0,
              detectedHasMore: opts.detectedHasMore ?? false,
              resolvedHasMore: opts.resolvedHasMore ?? false,
            },
        isLoading: opts.isLoading ?? false,
        isError: opts.isError ?? false,
        error: opts.isError ? new Error('boom') : null,
      });
    }

    beforeEach(() => {
      mockUseUsersList.mockReturnValue({ data: { users: [] }, isLoading: false, isError: false });
      mockUseGroupsList.mockReturnValue({ data: { groups: [] }, isLoading: false, isError: false });
    });

    it('v0.107c: empty state → trigger-scope caveat + strong 강조, raw ** 없음', () => {
      mockUnresolved({ entries: [] });
      renderWithRouter(<SuperAdminPage />);

      const section = screen.getByTestId('super-admin-role-split-section');
      expect(section.textContent).toContain('미해결 role_split 없음');
      const strong = section.querySelector('strong');
      expect(strong).not.toBeNull();
      expect(strong!.textContent).toContain('역할 편집 대화상자를 열어본 계정에서만 감지');
      expect(section.textContent).not.toContain('**');
      expect(section.textContent).not.toContain('동기 상태');
      expect(screen.queryByTestId('super-admin-role-split-list')).toBeNull();
    });

    it('v0.107c: loading=true → 「불러오는 중」 표시, 스캔 warning 없음', () => {
      mockUnresolved({ isLoading: true, detectedHasMore: true });
      renderWithRouter(<SuperAdminPage />);
      const section = screen.getByTestId('super-admin-role-split-section');
      expect(section.textContent).toContain('불러오는 중');
      expect(screen.queryByTestId('super-admin-role-split-scan-incomplete')).toBeNull();
    });

    it('v0.107c: isError=true → 에러 문구, 스캔 warning 없음', () => {
      mockUnresolved({ isError: true, detectedHasMore: true });
      renderWithRouter(<SuperAdminPage />);
      const section = screen.getByTestId('super-admin-role-split-section');
      expect(section.textContent).toContain('감시 데이터를 불러오지 못했습니다');
      expect(screen.queryByTestId('super-admin-role-split-scan-incomplete')).toBeNull();
    });

    it('v0.107c F44: detectedHasMore=true → 스캔 초과 warning 표시', () => {
      mockUnresolved({ entries: [], detectedHasMore: true });
      renderWithRouter(<SuperAdminPage />);
      const warn = screen.getByTestId('super-admin-role-split-scan-incomplete');
      expect(warn.textContent).toContain('스캔 window 초과');
    });

    it('v0.107c F44: resolvedHasMore=true → 스캔 초과 warning 표시', () => {
      mockUnresolved({ entries: [], resolvedHasMore: true });
      renderWithRouter(<SuperAdminPage />);
      expect(screen.getByTestId('super-admin-role-split-scan-incomplete')).toBeDefined();
    });

    it('v0.107c: entries 표시 + count + 전체 보기 링크', () => {
      const e1 = { ...roleSplitEntry, id: 'log-rs-1', target: 'users/uid-A' };
      const e2 = {
        ...roleSplitEntry,
        id: 'log-rs-2',
        target: 'users/uid-B',
        message: 'role_split: auth=null firestore=admin',
      };
      mockUnresolved({ entries: [e1, e2] });
      renderWithRouter(<SuperAdminPage />);

      const section = screen.getByTestId('super-admin-role-split-section');
      expect(section.textContent).toContain('미해결 role_split 2건');
      const link = screen.getByTestId('super-admin-role-split-link');
      expect(link.getAttribute('href')).toContain('/super_admin/audit');
      expect(link.getAttribute('href')).toContain('action=system.role_split_detected');
      expect(screen.getByTestId('super-admin-role-split-item-log-rs-1')).toBeDefined();
      expect(screen.getByTestId('super-admin-role-split-item-log-rs-2')).toBeDefined();
    });

    it('v0.107c: hook 호출 인자 (scanLimit=500)', () => {
      renderWithRouter(<SuperAdminPage />);
      const call = mockUseUnresolvedRoleSplits.mock.calls.at(-1);
      expect(call).toBeDefined();
      expect(call![0]).toMatchObject({ scanLimit: 500 });
    });

    // v0.107 resolve button subset — reuses new mockUnresolved.
    it('v0.107c: 복구 버튼 클릭 → confirm 통과 시 mutate CAS 기대치 포함', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      mockUnresolved({ entries: [roleSplitEntry] });
      renderWithRouter(<SuperAdminPage />);
      const btn = screen.getByTestId('super-admin-role-split-resolve-log-rs-x');
      fireEvent.click(btn);
      expect(mockResolveMutate).toHaveBeenCalledTimes(1);
      expect(mockResolveMutate.mock.calls[0][0]).toEqual({
        uid: 'uid-target-1',
        expectedAuthRole: 'admin',
        expectedFirestoreRole: 'teacher',
      });
    });

    it('v0.107c: confirm 거부 시 mutate 호출 안 함', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      mockUnresolved({ entries: [roleSplitEntry] });
      renderWithRouter(<SuperAdminPage />);
      fireEvent.click(screen.getByTestId('super-admin-role-split-resolve-log-rs-x'));
      expect(mockResolveMutate).not.toHaveBeenCalled();
    });

    it('v0.107c: pending 중 버튼 disabled', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      mockUnresolved({ entries: [roleSplitEntry] });
      mockResolveMutate.mockImplementation(() => {});
      mockUseUsersResolveRoleSplit.mockReturnValue({
        mutate: mockResolveMutate,
        isPending: true,
        error: null,
      });
      renderWithRouter(<SuperAdminPage />);
      const btn = screen.getByTestId('super-admin-role-split-resolve-log-rs-x') as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });

    it('v0.107c: mutate 성공 시 unresolvedRoleSplits query invalidate', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      mockUnresolved({ entries: [roleSplitEntry] });
      mockResolveMutate.mockImplementation((_vars: any, opts: any) => {
        opts?.onSuccess?.();
      });
      renderWithRouter(<SuperAdminPage />);
      fireEvent.click(screen.getByTestId('super-admin-role-split-resolve-log-rs-x'));
      expect(mockInvalidateQueries).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['audit', 'unresolvedRoleSplits'] }),
      );
    });

    it('v0.107c: mutate 실패 시 error 문구', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      mockUnresolved({ entries: [roleSplitEntry] });
      mockResolveMutate.mockImplementation((_vars: any, opts: any) => {
        opts?.onError?.(new Error('boom'));
      });
      renderWithRouter(<SuperAdminPage />);
      fireEvent.click(screen.getByTestId('super-admin-role-split-resolve-log-rs-x'));
      const err = screen.getByTestId('super-admin-role-split-resolve-error');
      expect(err.textContent).toContain('복구 실패');
      expect(err.textContent).toContain('boom');
    });

    it('v0.107e F49: mutate 실패 시에도 unresolvedRoleSplits query invalidate (aborted → 새 detected)', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      mockUnresolved({ entries: [roleSplitEntry] });
      mockResolveMutate.mockImplementation((_vars: any, opts: any) => {
        opts?.onError?.(new Error('aborted: ...'));
      });
      renderWithRouter(<SuperAdminPage />);
      fireEvent.click(screen.getByTestId('super-admin-role-split-resolve-log-rs-x'));
      expect(mockInvalidateQueries).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['audit', 'unresolvedRoleSplits'] }),
      );
    });

    it('v0.107c: raw uid target 안전 slice', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      mockUnresolved({
        entries: [{ ...roleSplitEntry, id: 'log-rs-raw', target: 'raw-uid-abc' }],
      });
      renderWithRouter(<SuperAdminPage />);
      fireEvent.click(screen.getByTestId('super-admin-role-split-resolve-log-rs-raw'));
      expect(mockResolveMutate).toHaveBeenCalledWith(
        { uid: 'raw-uid-abc', expectedAuthRole: 'admin', expectedFirestoreRole: 'teacher' },
        expect.anything(),
      );
    });

    it('v0.107c: message 파싱 실패 → mutate 호출 안 함 + error', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      mockUnresolved({
        entries: [{ ...roleSplitEntry, id: 'log-rs-mal', message: 'no matching pattern' }],
      });
      renderWithRouter(<SuperAdminPage />);
      fireEvent.click(screen.getByTestId('super-admin-role-split-resolve-log-rs-mal'));
      expect(mockResolveMutate).not.toHaveBeenCalled();
      expect(screen.getByTestId('super-admin-role-split-resolve-error').textContent).toContain(
        '파싱할 수 없음',
      );
    });

    // v0.107f F51: auth=unknown row 는 recheck button 으로 분기.
    it('v0.107f F51: auth=unknown row → 「상태 재확인」 버튼 표시, 복구 버튼 없음', () => {
      const unknownEntry: AuditLogEntryRead = {
        ...roleSplitEntry,
        id: 'log-rs-unknown',
        message: 'role_split: auth=unknown firestore=admin (post_write_auth_recheck_failed: network unreachable)',
      };
      mockUnresolved({ entries: [unknownEntry] });
      renderWithRouter(<SuperAdminPage />);
      expect(screen.getByTestId('super-admin-role-split-recheck-log-rs-unknown')).toBeDefined();
      expect(screen.queryByTestId('super-admin-role-split-resolve-log-rs-unknown')).toBeNull();
    });

    it('v0.107f F51 / v0.109c: recheck 버튼 클릭 → mutate({ uid }) 호출 (mount auto 는 mutateAsync)', () => {
      const unknownEntry: AuditLogEntryRead = {
        ...roleSplitEntry,
        id: 'log-rs-unknown',
        target: 'users/uid-target-1',
        message: 'role_split: auth=unknown firestore=admin (post_write_auth_recheck_failed)',
      };
      mockUnresolved({ entries: [unknownEntry] });
      renderWithRouter(<SuperAdminPage />);
      // v0.109c: mount 시 auto batch 는 mutateAsync 사용. 수동 button click 은 mutate.
      expect(mockRecheckMutateAsync).toHaveBeenCalledWith({ uid: 'uid-target-1' });
      const mutateBefore = mockRecheckMutate.mock.calls.length;
      fireEvent.click(screen.getByTestId('super-admin-role-split-recheck-log-rs-unknown'));
      expect(mockRecheckMutate.mock.calls.length).toBeGreaterThan(mutateBefore);
      expect(mockRecheckMutate.mock.calls.at(-1)?.[0]).toEqual({ uid: 'uid-target-1' });
      // resolveMutation 은 호출 안 됨.
      expect(mockResolveMutate).not.toHaveBeenCalled();
    });

    it('v0.107f F51: recheck pending 중 버튼 disabled', () => {
      const unknownEntry: AuditLogEntryRead = {
        ...roleSplitEntry,
        id: 'log-rs-unknown',
        message: 'role_split: auth=unknown firestore=admin',
      };
      mockUnresolved({ entries: [unknownEntry] });
      mockUseUsersRecheckRoleSplit.mockReturnValue({
        mutate: mockRecheckMutate,
        mutateAsync: mockRecheckMutateAsync,
        isPending: true,
        error: null,
      });
      renderWithRouter(<SuperAdminPage />);
      const btn = screen.getByTestId('super-admin-role-split-recheck-log-rs-unknown') as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });

    it('v0.107f F51: firestore=unknown row 도 recheck 로 분기', () => {
      const unknownEntry: AuditLogEntryRead = {
        ...roleSplitEntry,
        id: 'log-rs-fu',
        message: 'role_split: auth=admin firestore=unknown (some_hypothetical_reason)',
      };
      mockUnresolved({ entries: [unknownEntry] });
      renderWithRouter(<SuperAdminPage />);
      expect(screen.getByTestId('super-admin-role-split-recheck-log-rs-fu')).toBeDefined();
    });

    // v0.109c F57: 자동 재확인은 mutateAsync + Promise.allSettled 사용 (mutate consecutive
    // callback 오류 방지).
    it('v0.109c F57: mount 시 auth=unknown row 는 mutateAsync 로 자동 트리거', () => {
      const unknownEntry: AuditLogEntryRead = {
        ...roleSplitEntry,
        id: 'log-rs-auto',
        target: 'users/uid-auto-1',
        message: 'role_split: auth=unknown firestore=admin',
      };
      mockUnresolved({ entries: [unknownEntry] });
      renderWithRouter(<SuperAdminPage />);
      expect(mockRecheckMutateAsync).toHaveBeenCalledWith({ uid: 'uid-auto-1' });
    });

    it('v0.109: parsable row 는 auto recheck 트리거하지 않음', () => {
      const parsableEntry: AuditLogEntryRead = {
        ...roleSplitEntry,
        id: 'log-rs-parsable',
        message: 'role_split: auth=admin firestore=teacher',
      };
      mockUnresolved({ entries: [parsableEntry] });
      renderWithRouter(<SuperAdminPage />);
      expect(mockRecheckMutateAsync).not.toHaveBeenCalled();
    });

    it('v0.109: 같은 uid 는 auto recheck 를 두 번 호출하지 않음 (session-scoped Set)', () => {
      const unknownEntry: AuditLogEntryRead = {
        ...roleSplitEntry,
        id: 'log-rs-dedup',
        target: 'users/uid-dedup',
        message: 'role_split: auth=unknown firestore=admin',
      };
      mockUnresolved({ entries: [unknownEntry] });
      const { rerender } = renderWithRouter(<SuperAdminPage />);
      expect(mockRecheckMutateAsync).toHaveBeenCalledTimes(1);
      rerender(
        <MemoryRouter>
          <SuperAdminPage />
        </MemoryRouter>,
      );
      expect(mockRecheckMutateAsync).toHaveBeenCalledTimes(1);
    });

    it('v0.109: loading 중엔 auto recheck 안 함', () => {
      mockUseUnresolvedRoleSplits.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        error: null,
      });
      renderWithRouter(<SuperAdminPage />);
      expect(mockRecheckMutateAsync).not.toHaveBeenCalled();
    });

    it('v0.109: isError 중엔 auto recheck 안 함', () => {
      mockUseUnresolvedRoleSplits.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new Error('boom'),
      });
      renderWithRouter(<SuperAdminPage />);
      expect(mockRecheckMutateAsync).not.toHaveBeenCalled();
    });

    // v0.109b F56 · v0.109c F57: batch limit + Promise.allSettled 후 단일 invalidate.
    it('v0.109b F56: 다중 unknown 이 있어도 AUTO_RECHECK_BATCH_LIMIT (5) 만 트리거', () => {
      const entries: AuditLogEntryRead[] = Array.from({ length: 10 }, (_, i) => ({
        ...roleSplitEntry,
        id: `log-rs-many-${i}`,
        target: `users/uid-many-${i}`,
        message: 'role_split: auth=unknown firestore=admin',
      }));
      mockUnresolved({ entries });
      renderWithRouter(<SuperAdminPage />);
      // 10 unknown 있어도 최대 5개만 trigger.
      expect(mockRecheckMutateAsync).toHaveBeenCalledTimes(5);
    });

    it('v0.109c F57: Promise.allSettled 완료 후 unresolvedRoleSplits query 를 한 번만 invalidate', async () => {
      const entries: AuditLogEntryRead[] = Array.from({ length: 3 }, (_, i) => ({
        ...roleSplitEntry,
        id: `log-rs-batch-${i}`,
        target: `users/uid-batch-${i}`,
        message: 'role_split: auth=unknown firestore=admin',
      }));
      mockUnresolved({ entries });
      // mutateAsync 3번 모두 resolve.
      mockRecheckMutateAsync.mockResolvedValue({});
      renderWithRouter(<SuperAdminPage />);
      // 3 mutations 동시 호출.
      expect(mockRecheckMutateAsync).toHaveBeenCalledTimes(3);
      // Promise.allSettled 이후 invalidate 호출. microtask 대기.
      await Promise.resolve();
      await Promise.resolve();
      const invalidateCalls = mockInvalidateQueries.mock.calls.filter((c) =>
        JSON.stringify(c[0]?.queryKey) === JSON.stringify(['audit', 'unresolvedRoleSplits']),
      );
      expect(invalidateCalls.length).toBe(1);
    });

    it('v0.109c F57: 일부 mutation 이 reject 여도 allSettled → invalidate 한 번', async () => {
      const entries: AuditLogEntryRead[] = Array.from({ length: 3 }, (_, i) => ({
        ...roleSplitEntry,
        id: `log-rs-mix-${i}`,
        target: `users/uid-mix-${i}`,
        message: 'role_split: auth=unknown firestore=admin',
      }));
      mockUnresolved({ entries });
      let callIdx = 0;
      mockRecheckMutateAsync.mockImplementation(() => {
        const idx = callIdx++;
        return idx === 1 ? Promise.reject(new Error('one failed')) : Promise.resolve({});
      });
      renderWithRouter(<SuperAdminPage />);
      await Promise.resolve();
      await Promise.resolve();
      const invalidateCalls = mockInvalidateQueries.mock.calls.filter((c) =>
        JSON.stringify(c[0]?.queryKey) === JSON.stringify(['audit', 'unresolvedRoleSplits']),
      );
      expect(invalidateCalls.length).toBe(1);
    });

    it('v0.109c F57: batch 5개 중간에 하나 reject 여도 단일 invalidate (batch 상한 검증)', async () => {
      const entries: AuditLogEntryRead[] = Array.from({ length: 10 }, (_, i) => ({
        ...roleSplitEntry,
        id: `log-rs-limit-${i}`,
        target: `users/uid-limit-${i}`,
        message: 'role_split: auth=unknown firestore=admin',
      }));
      mockUnresolved({ entries });
      mockRecheckMutateAsync.mockImplementation((v: any) => {
        return v.uid.endsWith('-2')
          ? Promise.reject(new Error('boom'))
          : Promise.resolve({});
      });
      renderWithRouter(<SuperAdminPage />);
      expect(mockRecheckMutateAsync).toHaveBeenCalledTimes(5);
      await Promise.resolve();
      await Promise.resolve();
      const invalidateCalls = mockInvalidateQueries.mock.calls.filter((c) =>
        JSON.stringify(c[0]?.queryKey) === JSON.stringify(['audit', 'unresolvedRoleSplits']),
      );
      expect(invalidateCalls.length).toBe(1);
    });

    // v0.109d F58: mount 당 최대 5회. 첫 batch 후 invalidate → refetch 로 entries 가 갱신돼도
    // budget 소진돼 있으므로 추가 발화 안 함.
    it('v0.109d F58: 첫 batch 5회 이후 entries 재갱신 (invalidate 시뮬) 로도 추가 발화 없음', async () => {
      const initial: AuditLogEntryRead[] = Array.from({ length: 10 }, (_, i) => ({
        ...roleSplitEntry,
        id: `log-rs-mount-${i}`,
        target: `users/uid-mount-${i}`,
        message: 'role_split: auth=unknown firestore=admin',
      }));
      // 리렌더 사이에 entries 자체를 새 array reference 로 리턴 (invalidate→refetch 시뮬).
      let round = 0;
      mockUseUnresolvedRoleSplits.mockImplementation(() => {
        round += 1;
        // 매 render 마다 새 array reference (하지만 내용 동일) → useEffect 재실행.
        return {
          data: {
            entries: initial.map((e) => ({ ...e })),
            scannedDetected: 10,
            scannedResolved: 0,
            detectedHasMore: false,
            resolvedHasMore: false,
          },
          isLoading: false,
          isError: false,
          error: null,
        };
      });
      mockRecheckMutateAsync.mockResolvedValue({});

      const { rerender } = renderWithRouter(<SuperAdminPage />);
      // 첫 batch: 5회.
      expect(mockRecheckMutateAsync).toHaveBeenCalledTimes(5);
      // batch 완료 대기 (Promise.allSettled → invalidate).
      await Promise.resolve();
      await Promise.resolve();
      // 강제 rerender — 실제 invalidate→refetch 시나리오 시뮬.
      rerender(
        <MemoryRouter>
          <SuperAdminPage />
        </MemoryRouter>,
      );
      // budget 이 0 이 되었으므로 추가 mutateAsync 호출 없음.
      expect(mockRecheckMutateAsync).toHaveBeenCalledTimes(5);
      // useUnresolvedRoleSplits 는 여러 번 호출됐지만 mutateAsync 는 5회 고정.
      expect(round).toBeGreaterThan(1);
    });
  });

  // v0.110: 미해결 role_split KPI 카드.
  describe('v0.110: 미해결 role_split KPI', () => {
    beforeEach(() => {
      mockUseUsersList.mockReturnValue({ data: { users: [] }, isLoading: false, isError: false });
      mockUseGroupsList.mockReturnValue({ data: { groups: [] }, isLoading: false, isError: false });
    });

    it('v0.110: KPI 카드에 미해결 role_split 개수 표시', () => {
      const entries = Array.from({ length: 3 }, (_, i) => ({
        id: `log-${i}`,
        actor: 'super@cam.hs.kr',
        role: 'super_admin',
        action: 'system.role_split_detected',
        target: `users/uid-${i}`,
        request_id: 'r',
        result: 'error' as const,
        at: 1725150000000,
        message: 'role_split: auth=admin firestore=teacher',
      }));
      mockUseUnresolvedRoleSplits.mockReturnValue({
        data: {
          entries,
          scannedDetected: 3,
          scannedResolved: 0,
          detectedHasMore: false,
          resolvedHasMore: false,
        },
        isLoading: false,
        isError: false,
        error: null,
      });
      renderWithRouter(<SuperAdminPage />);
      const card = screen.getByTestId('kpi-card-미해결 role_split');
      expect(card).toBeDefined();
      expect(card.textContent).toContain('3');
    });

    it('v0.110: unresolvedQuery isError → KPI 값이 "—"', () => {
      mockUseUnresolvedRoleSplits.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new Error('boom'),
      });
      renderWithRouter(<SuperAdminPage />);
      const card = screen.getByTestId('kpi-card-미해결 role_split');
      expect(card.textContent).toContain('—');
    });

    it('v0.110: KPI 카드 클릭 → role-split-section 으로 scroll', () => {
      mockUseUnresolvedRoleSplits.mockReturnValue({
        data: {
          entries: [],
          scannedDetected: 0,
          scannedResolved: 0,
          detectedHasMore: false,
          resolvedHasMore: false,
        },
        isLoading: false,
        isError: false,
        error: null,
      });
      renderWithRouter(<SuperAdminPage />);
      // section 이 id 로 존재.
      const section = document.getElementById('role-split-section');
      expect(section).not.toBeNull();
      // scrollIntoView 는 jsdom 에서 미구현. spy 로 대체.
      const scrollSpy = vi.fn();
      section!.scrollIntoView = scrollSpy;

      fireEvent.click(screen.getByTestId('kpi-card-미해결 role_split'));
      expect(scrollSpy).toHaveBeenCalledTimes(1);
    });

    // v0.110b F59: scanIncomplete → 부분 집계이므로 「N+」 로 표시.
    it('v0.110b F59: scanIncomplete=true (detectedHasMore) → 값에 `+` 접미어', () => {
      const entries = Array.from({ length: 3 }, (_, i) => ({
        id: `log-${i}`,
        actor: 'super@cam.hs.kr',
        role: 'super_admin',
        action: 'system.role_split_detected',
        target: `users/uid-${i}`,
        request_id: 'r',
        result: 'error' as const,
        at: 1725150000000,
        message: 'role_split: auth=admin firestore=teacher',
      }));
      mockUseUnresolvedRoleSplits.mockReturnValue({
        data: {
          entries,
          scannedDetected: 500,
          scannedResolved: 500,
          detectedHasMore: true,
          resolvedHasMore: false,
        },
        isLoading: false,
        isError: false,
        error: null,
      });
      renderWithRouter(<SuperAdminPage />);
      const card = screen.getByTestId('kpi-card-미해결 role_split');
      expect(card.textContent).toContain('3+');
    });

    // v0.110c F61: resolvedHasMore 는 방향 불확실 (N 이 과대일 수 있음) → `N?` 로 표시.
    it('v0.110c F61: resolvedHasMore=true → `N?` (방향 불확실)', () => {
      const entries = Array.from({ length: 2 }, (_, i) => ({
        id: `log-${i}`,
        actor: 'super@cam.hs.kr',
        role: 'super_admin',
        action: 'system.role_split_detected',
        target: `users/uid-${i}`,
        request_id: 'r',
        result: 'error' as const,
        at: 1725150000000,
        message: 'role_split: auth=admin firestore=teacher',
      }));
      mockUseUnresolvedRoleSplits.mockReturnValue({
        data: {
          entries,
          scannedDetected: 100,
          scannedResolved: 500,
          detectedHasMore: false,
          resolvedHasMore: true,
        },
        isLoading: false,
        isError: false,
        error: null,
      });
      renderWithRouter(<SuperAdminPage />);
      const card = screen.getByTestId('kpi-card-미해결 role_split');
      expect(card.textContent).toContain('2?');
      // `2+` 로 오도 되지 않아야.
      expect(card.textContent).not.toMatch(/2\+/);
    });

    it('v0.110c F61: 둘 다 hasMore=true → resolvedHasMore 방향 불확실이 우선 → `N?`', () => {
      const entries = Array.from({ length: 4 }, (_, i) => ({
        id: `log-${i}`,
        actor: 'super@cam.hs.kr',
        role: 'super_admin',
        action: 'system.role_split_detected',
        target: `users/uid-${i}`,
        request_id: 'r',
        result: 'error' as const,
        at: 1725150000000,
        message: 'role_split: auth=admin firestore=teacher',
      }));
      mockUseUnresolvedRoleSplits.mockReturnValue({
        data: {
          entries,
          scannedDetected: 500,
          scannedResolved: 500,
          detectedHasMore: true,
          resolvedHasMore: true,
        },
        isLoading: false,
        isError: false,
        error: null,
      });
      renderWithRouter(<SuperAdminPage />);
      const card = screen.getByTestId('kpi-card-미해결 role_split');
      expect(card.textContent).toContain('4?');
    });

    // v0.110b F60: 반응형 grid — md 2열 · lg 3열 · xl 5열.
    it('v0.110b F60: KPI grid 는 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5', () => {
      mockUseUnresolvedRoleSplits.mockReturnValue({
        data: {
          entries: [],
          scannedDetected: 0,
          scannedResolved: 0,
          detectedHasMore: false,
          resolvedHasMore: false,
        },
        isLoading: false,
        isError: false,
        error: null,
      });
      renderWithRouter(<SuperAdminPage />);
      const card = screen.getByTestId('kpi-card-총 사용자');
      const grid = card.parentElement;
      expect(grid).not.toBeNull();
      expect(grid!.className).toContain('md:grid-cols-2');
      expect(grid!.className).toContain('lg:grid-cols-3');
      expect(grid!.className).toContain('xl:grid-cols-5');
    });
  });

  // v0.120: action breakdown 위젯.
  describe('v0.120 action breakdown', () => {
    const baseUsers = {
      data: { users: [] as UserItem[] },
      isLoading: false,
      isError: false,
      error: null,
    };
    const baseGroups = {
      data: { groups: [] as GroupItem[] },
      isLoading: false,
      isError: false,
      error: null,
    };
    const baseAuditList = {
      entries: [],
      loading: false,
      error: null,
      hasMore: false,
      loadMore: vi.fn(),
      reload: vi.fn(),
    };
    const baseUnresolved = {
      data: {
        entries: [],
        scannedDetected: 0,
        scannedResolved: 0,
        detectedHasMore: false,
        resolvedHasMore: false,
      },
      isLoading: false,
      isError: false,
      error: null,
    };
    beforeEach(() => {
      mockUseUsersList.mockReturnValue(baseUsers);
      mockUseGroupsList.mockReturnValue(baseGroups);
      mockUseAuditLogList.mockReturnValue(baseAuditList);
      mockUseUnresolvedRoleSplits.mockReturnValue(baseUnresolved);
    });

    it('actionCounts 정렬 후 top 액션 row 표시 + link href 검증', () => {
      mockUseAuditLogSummary.mockReturnValue({
        data: {
          count: 6,
          entries: [],
          snapshotAt: Date.now(),
          generatedAt: Date.now(),
          actionCounts: { 'users.read': 3, 'users.write': 2, 'audit.read': 1 },
          sampleSize: 6,
          sampleTruncated: false,
        },
        isLoading: false,
        isError: false,
        error: null,
      });
      renderWithRouter(<SuperAdminPage />);
      // 세 액션 row 존재.
      expect(screen.getByTestId('super-admin-breakdown-row-users.read')).toBeDefined();
      expect(screen.getByTestId('super-admin-breakdown-row-users.write')).toBeDefined();
      expect(screen.getByTestId('super-admin-breakdown-row-audit.read')).toBeDefined();
      // truncated 배너는 없음.
      expect(screen.queryByTestId('super-admin-breakdown-truncated')).toBeNull();
      // top row 는 count 가장 높은 users.read.
      const list = screen.getByTestId('super-admin-breakdown-list');
      const rows = list.querySelectorAll('li');
      expect(rows[0].textContent).toContain('users.read');
      // link href 는 action + atMin 포함.
      const topLink = rows[0].querySelector('a');
      expect(topLink?.getAttribute('href')).toContain('action=users.read');
      expect(topLink?.getAttribute('href')).toMatch(/atMin=\d{4}-\d{2}-\d{2}/);
    });

    it('sampleTruncated=true 이면 truncated 경고 노출 (count > sampleSize 명시)', () => {
      mockUseAuditLogSummary.mockReturnValue({
        data: {
          count: 1234,
          entries: [],
          snapshotAt: Date.now(),
          generatedAt: Date.now(),
          actionCounts: { 'users.read': 300, 'users.write': 200 },
          sampleSize: 500,
          sampleTruncated: true,
        },
        isLoading: false,
        isError: false,
        error: null,
      });
      renderWithRouter(<SuperAdminPage />);
      const truncated = screen.getByTestId('super-admin-breakdown-truncated');
      expect(truncated.textContent).toContain('1234');
      expect(truncated.textContent).toContain('500');
    });

    it('빈 결과 → empty 안내', () => {
      mockUseAuditLogSummary.mockReturnValue({
        data: {
          count: 0,
          entries: [],
          snapshotAt: Date.now(),
          generatedAt: Date.now(),
          actionCounts: {},
          sampleSize: 0,
          sampleTruncated: false,
        },
        isLoading: false,
        isError: false,
        error: null,
      });
      renderWithRouter(<SuperAdminPage />);
      expect(screen.getByTestId('super-admin-breakdown-empty')).toBeDefined();
      expect(screen.queryByTestId('super-admin-breakdown-list')).toBeNull();
    });

    // v0.120b F97: 구 Functions 응답 (actionCounts 필드 없음) 은 「집계 미제공」
    // 으로 표시하고 「이벤트 없음」 (count=0 empty) 과 구분한다.
    it('v0.120b F97: 구 응답 (actionCounts=undefined) 은 unavailable 안내 · empty 안내 미노출', () => {
      mockUseAuditLogSummary.mockReturnValue({
        data: {
          count: 42, // 구 서버라 count 만 있고 actionCounts 없음
          entries: [],
          snapshotAt: Date.now(),
          generatedAt: Date.now(),
          // actionCounts, sampleSize, sampleTruncated 없음 (backward-compat).
        },
        isLoading: false,
        isError: false,
        error: null,
      });
      renderWithRouter(<SuperAdminPage />);
      expect(screen.getByTestId('super-admin-breakdown-unavailable')).toBeDefined();
      // empty 안내는 뜨지 않아야.
      expect(screen.queryByTestId('super-admin-breakdown-empty')).toBeNull();
      expect(screen.queryByTestId('super-admin-breakdown-list')).toBeNull();
    });

    it('오류 상태 → breakdown-error 배너 · list 미노출', () => {
      mockUseAuditLogSummary.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new Error('network_failure'),
      });
      renderWithRouter(<SuperAdminPage />);
      const err = screen.getByTestId('super-admin-breakdown-error');
      expect(err.textContent).toContain('network_failure');
      expect(screen.queryByTestId('super-admin-breakdown-list')).toBeNull();
    });

    // v0.122: window selector — 오늘/이번 주/이번 달 segmented control.
    it('v0.122: window selector 렌더 · 기본 오늘 · aria-pressed 반영', () => {
      mockUseAuditLogSummary.mockReturnValue({
        data: {
          count: 6,
          entries: [],
          snapshotAt: Date.now(),
          generatedAt: Date.now(),
          actionCounts: { 'users.read': 3, 'users.write': 3 },
          sampleSize: 6,
          sampleTruncated: false,
        },
        isLoading: false,
        isError: false,
        error: null,
      });
      renderWithRouter(<SuperAdminPage />);
      const today = screen.getByTestId('super-admin-breakdown-window-today');
      const week = screen.getByTestId('super-admin-breakdown-window-week');
      const month = screen.getByTestId('super-admin-breakdown-window-month');
      expect(today.getAttribute('aria-pressed')).toBe('true');
      expect(week.getAttribute('aria-pressed')).toBe('false');
      expect(month.getAttribute('aria-pressed')).toBe('false');
      // 제목이 「오늘 액션별」.
      expect(screen.getByRole('heading', { name: '오늘 액션별' })).toBeDefined();
    });

    it('v0.122: 이번 주 클릭 → 제목/링크/atMin 이 주 시작 (월요일) 로 전환', () => {
      mockUseAuditLogSummary.mockReturnValue({
        data: {
          count: 6,
          entries: [],
          snapshotAt: Date.now(),
          generatedAt: Date.now(),
          actionCounts: { 'users.read': 3 },
          sampleSize: 6,
          sampleTruncated: false,
        },
        isLoading: false,
        isError: false,
        error: null,
      });
      renderWithRouter(<SuperAdminPage />);
      fireEvent.click(screen.getByTestId('super-admin-breakdown-window-week'));
      expect(screen.getByRole('heading', { name: '이번 주 액션별' })).toBeDefined();
      // 이번 주 버튼이 활성.
      expect(
        screen
          .getByTestId('super-admin-breakdown-window-week')
          .getAttribute('aria-pressed'),
      ).toBe('true');
      expect(
        screen
          .getByTestId('super-admin-breakdown-window-today')
          .getAttribute('aria-pressed'),
      ).toBe('false');
      // 링크는 atMin=주-월요일-ISO.
      const row = screen.getByTestId('super-admin-breakdown-row-users.read');
      const href = row.getAttribute('href');
      expect(href).toContain('action=users.read');
      // 월요일 계산: 오늘의 요일에서 (day+6)%7 만큼 뺀 날짜.
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const monday = new Date(today);
      monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
      const iso = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
      expect(href).toContain(`atMin=${iso}`);
    });

    it('v0.122: 이번 달 클릭 → atMin 은 이번 달 1일', () => {
      mockUseAuditLogSummary.mockReturnValue({
        data: {
          count: 6,
          entries: [],
          snapshotAt: Date.now(),
          generatedAt: Date.now(),
          actionCounts: { 'users.read': 3 },
          sampleSize: 6,
          sampleTruncated: false,
        },
        isLoading: false,
        isError: false,
        error: null,
      });
      renderWithRouter(<SuperAdminPage />);
      fireEvent.click(screen.getByTestId('super-admin-breakdown-window-month'));
      expect(screen.getByRole('heading', { name: '이번 달 액션별' })).toBeDefined();
      const row = screen.getByTestId('super-admin-breakdown-row-users.read');
      const href = row.getAttribute('href');
      const today = new Date();
      const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
      expect(href).toContain(`atMin=${iso}`);
    });

    it('v0.122: window 전환 시 useAuditLogSummary 가 다른 atMin 으로 재호출', () => {
      mockUseAuditLogSummary.mockReturnValue({
        data: {
          count: 6,
          entries: [],
          snapshotAt: Date.now(),
          generatedAt: Date.now(),
          actionCounts: { 'users.read': 3 },
          sampleSize: 6,
          sampleTruncated: false,
        },
        isLoading: false,
        isError: false,
        error: null,
      });
      renderWithRouter(<SuperAdminPage />);
      // 초기 render 에서 두 번 호출 (같은 today atMin).
      const initialCalls = mockUseAuditLogSummary.mock.calls.length;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayMs = today.getTime();
      // 이번 달 클릭 → re-render 발생, 두 번째 hook 은 monthStartMs 로 호출.
      fireEvent.click(screen.getByTestId('super-admin-breakdown-window-month'));
      const monthMs = new Date(today.getFullYear(), today.getMonth(), 1).getTime();
      const afterCalls = mockUseAuditLogSummary.mock.calls.slice(initialCalls);
      // 새 render 에서 최소 두 번 호출 (top summary today + breakdown month).
      expect(afterCalls.length).toBeGreaterThanOrEqual(2);
      const atMins = afterCalls.map((c: any[]) => c[0]?.atMin);
      expect(atMins).toContain(todayMs);
      expect(atMins).toContain(monthMs);
    });

    it('v0.122: sampleTruncated 배너의 label 이 선택된 window 를 반영', () => {
      mockUseAuditLogSummary.mockReturnValue({
        data: {
          count: 1234,
          entries: [],
          snapshotAt: Date.now(),
          generatedAt: Date.now(),
          actionCounts: { 'users.read': 500 },
          sampleSize: 500,
          sampleTruncated: true,
        },
        isLoading: false,
        isError: false,
        error: null,
      });
      renderWithRouter(<SuperAdminPage />);
      fireEvent.click(screen.getByTestId('super-admin-breakdown-window-week'));
      const truncated = screen.getByTestId('super-admin-breakdown-truncated');
      expect(truncated.textContent).toContain('이번 주');
    });

    it('v0.122: empty 안내도 선택된 window label 을 반영', () => {
      mockUseAuditLogSummary.mockReturnValue({
        data: {
          count: 0,
          entries: [],
          snapshotAt: Date.now(),
          generatedAt: Date.now(),
          actionCounts: {},
          sampleSize: 0,
          sampleTruncated: false,
        },
        isLoading: false,
        isError: false,
        error: null,
      });
      renderWithRouter(<SuperAdminPage />);
      fireEvent.click(screen.getByTestId('super-admin-breakdown-window-month'));
      const empty = screen.getByTestId('super-admin-breakdown-empty');
      expect(empty.textContent).toContain('이번 달');
    });

    // v0.126: exact aggregation toggle.
    it('v0.126: sampleTruncated=true 이면 「정확 카운트 보기」 버튼 노출 · 클릭 시 exact=true 로 재호출', () => {
      mockUseAuditLogSummary.mockReturnValue({
        data: {
          count: 1234,
          entries: [],
          snapshotAt: Date.now(),
          generatedAt: Date.now(),
          actionCounts: { 'users.read': 300, 'users.write': 200 },
          sampleSize: 500,
          sampleTruncated: true,
        },
        isLoading: false,
        isError: false,
        error: null,
      });
      renderWithRouter(<SuperAdminPage />);
      const btn = screen.getByTestId('super-admin-breakdown-exact-btn') as HTMLButtonElement;
      expect(btn).toBeDefined();
      // 초기 호출은 exact=false.
      const initialCalls = mockUseAuditLogSummary.mock.calls.length;
      fireEvent.click(btn);
      const afterCalls = mockUseAuditLogSummary.mock.calls.slice(initialCalls);
      const exactTrueCall = afterCalls.find((c: any[]) => c[0]?.exact === true);
      expect(exactTrueCall).toBeDefined();
    });

    it('v0.126: exactActionCounts 응답 → sample-scope 대신 exact 렌더 · truncated 배너 숨김 · 성공 배너 노출', () => {
      mockUseAuditLogSummary.mockReturnValue({
        data: {
          count: 1234,
          entries: [],
          snapshotAt: Date.now(),
          generatedAt: Date.now(),
          // sample 은 users.read 만 500 반영 (truncated).
          actionCounts: { 'users.read': 500 },
          sampleSize: 500,
          sampleTruncated: true,
          // 실제 정확 count 는 users.read=800, users.write=434.
          exactActionCounts: { 'users.read': 800, 'users.write': 434 },
        },
        isLoading: false,
        isError: false,
        error: null,
      });
      renderWithRouter(<SuperAdminPage />);
      // truncated 배너 숨김 · 「정확 카운트 보기」 버튼도 숨김.
      expect(screen.queryByTestId('super-admin-breakdown-truncated')).toBeNull();
      expect(screen.queryByTestId('super-admin-breakdown-exact-btn')).toBeNull();
      // 성공 배너 노출.
      const successBanner = screen.getByTestId('super-admin-breakdown-exact-on');
      expect(successBanner.textContent).toContain('1234');
      // 리스트는 exact 기준 (users.write 도 렌더, count 800/434).
      expect(screen.getByTestId('super-admin-breakdown-row-users.read')).toBeDefined();
      expect(screen.getByTestId('super-admin-breakdown-row-users.write')).toBeDefined();
      const readRow = screen.getByTestId('super-admin-breakdown-row-users.read');
      expect(readRow.textContent).toContain('800');
    });

    it('v0.126: sampleTruncated=false 이면 「정확 카운트」 버튼 노출 안 함', () => {
      mockUseAuditLogSummary.mockReturnValue({
        data: {
          count: 6,
          entries: [],
          snapshotAt: Date.now(),
          generatedAt: Date.now(),
          actionCounts: { 'users.read': 6 },
          sampleSize: 6,
          sampleTruncated: false,
        },
        isLoading: false,
        isError: false,
        error: null,
      });
      renderWithRouter(<SuperAdminPage />);
      expect(screen.queryByTestId('super-admin-breakdown-exact-btn')).toBeNull();
    });

    // v0.126b F104: window 전환 시 exact=true 중간 호출 leak 방지. 사용자가
    // 「정확 카운트 보기」 를 누른 상태 (exactAggregation=true) 에서 window 를
    // 다른 값으로 바꾸면, 새 window + exact=true 로는 절대 호출되지 않아야 함
    // — 서버 부담 (28 count() aggregation) 이 원하지 않는 시점에 발화하는 것을 방지.
    it('v0.126b F104: exact=true 상태 → window 전환 시 (새 window, exact=true) 호출 없음', () => {
      mockUseAuditLogSummary.mockReturnValue({
        data: {
          count: 1234,
          entries: [],
          snapshotAt: Date.now(),
          generatedAt: Date.now(),
          actionCounts: { 'users.read': 500 },
          sampleSize: 500,
          sampleTruncated: true,
        },
        isLoading: false,
        isError: false,
        error: null,
      });
      renderWithRouter(<SuperAdminPage />);
      // 「정확 카운트 보기」 버튼 눌러 exact=true 상태로.
      fireEvent.click(screen.getByTestId('super-admin-breakdown-exact-btn'));
      // 지금까지 호출 중에는 (today, exact=true) 는 존재해야.
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayMs = today.getTime();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthMs = monthStart.getTime();
      // window 전환 → 이번 달.
      const beforeSwitchCallCount = mockUseAuditLogSummary.mock.calls.length;
      fireEvent.click(screen.getByTestId('super-admin-breakdown-window-month'));
      const afterCalls = mockUseAuditLogSummary.mock.calls.slice(beforeSwitchCallCount);

      // 새 window (monthMs) + exact=true 조합은 절대 발화하면 안 됨.
      const leak = afterCalls.find(
        (c: any[]) => c[0]?.atMin === monthMs && c[0]?.exact === true,
      );
      expect(leak).toBeUndefined();
      // 그리고 monthMs + exact=false 는 최소 1회 발화해야 (breakdown query).
      const reset = afterCalls.find(
        (c: any[]) => c[0]?.atMin === monthMs && c[0]?.exact === false,
      );
      expect(reset).toBeDefined();
      // 참고: 상단 today query 는 계속 today atMin 으로 호출 (변경 없음).
      const todayStill = afterCalls.find(
        (c: any[]) => c[0]?.atMin === todayMs && c[0]?.exact === undefined,
      );
      expect(todayStill).toBeDefined();
    });

    // v0.126b F103: `_other` bucket 렌더 — success banner 에 카탈로그 밖 안내
    // 포함, `_other` 행은 label 「기타 (카탈로그 밖)」 로 표시, 링크 없이 (div).
    it('v0.126b F103: exactActionCounts._other 렌더 · 「기타」 label · 링크 없음', () => {
      mockUseAuditLogSummary.mockReturnValue({
        data: {
          count: 42,
          entries: [],
          snapshotAt: Date.now(),
          generatedAt: Date.now(),
          actionCounts: {},
          sampleSize: 0,
          sampleTruncated: true,
          exactActionCounts: {
            'users.read': 10,
            'users.write': 5,
            _other: 27,
          },
        },
        isLoading: false,
        isError: false,
        error: null,
      });
      renderWithRouter(<SuperAdminPage />);
      // 성공 배너에 「기타」 안내 포함.
      const banner = screen.getByTestId('super-admin-breakdown-exact-on');
      expect(banner.textContent).toContain('카탈로그 밖');
      expect(banner.textContent).toContain('27');
      // `_other` row 는 「기타」 label.
      const otherRow = screen.getByTestId('super-admin-breakdown-row-_other');
      expect(otherRow.textContent).toContain('기타');
      // 링크 없음 — div 로 렌더 (a 태그 아님).
      expect(otherRow.tagName.toLowerCase()).toBe('div');
    });
  });
});
