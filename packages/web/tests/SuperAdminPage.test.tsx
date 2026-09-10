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

// v0.107f F51: 상태 재확인 hook mock.
const mockRecheckMutate = vi.fn();
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
    mockUseUsersRecheckRoleSplit.mockReturnValue({
      mutate: mockRecheckMutate,
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

    it('v0.107f F51: recheck 버튼 클릭 → recheckMutation.mutate({ uid }) 호출 (confirm 없이)', () => {
      const unknownEntry: AuditLogEntryRead = {
        ...roleSplitEntry,
        id: 'log-rs-unknown',
        target: 'users/uid-target-1',
        message: 'role_split: auth=unknown firestore=admin (post_write_auth_recheck_failed)',
      };
      mockUnresolved({ entries: [unknownEntry] });
      renderWithRouter(<SuperAdminPage />);
      // v0.109: mount 시 자동 recheck 1회 (unknown row). button click 추가로 2회 총.
      const callsAfterMount = mockRecheckMutate.mock.calls.length;
      fireEvent.click(screen.getByTestId('super-admin-role-split-recheck-log-rs-unknown'));
      expect(mockRecheckMutate.mock.calls.length).toBeGreaterThan(callsAfterMount);
      const lastCall = mockRecheckMutate.mock.calls.at(-1);
      expect(lastCall?.[0]).toEqual({ uid: 'uid-target-1' });
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

    // v0.109: 카드 mount 시 unknown row 자동 recheck.
    it('v0.109: mount 시 auth=unknown row 자동으로 recheckMutation 트리거', () => {
      const unknownEntry: AuditLogEntryRead = {
        ...roleSplitEntry,
        id: 'log-rs-auto',
        target: 'users/uid-auto-1',
        message: 'role_split: auth=unknown firestore=admin',
      };
      mockUnresolved({ entries: [unknownEntry] });
      renderWithRouter(<SuperAdminPage />);
      expect(mockRecheckMutate).toHaveBeenCalledWith({ uid: 'uid-auto-1' });
    });

    it('v0.109: parsable row 는 auto recheck 트리거하지 않음', () => {
      const parsableEntry: AuditLogEntryRead = {
        ...roleSplitEntry,
        id: 'log-rs-parsable',
        message: 'role_split: auth=admin firestore=teacher',
      };
      mockUnresolved({ entries: [parsableEntry] });
      renderWithRouter(<SuperAdminPage />);
      expect(mockRecheckMutate).not.toHaveBeenCalled();
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
      expect(mockRecheckMutate).toHaveBeenCalledTimes(1);
      // 같은 entries 로 rerender — auto recheck 재트리거 안 되어야.
      rerender(
        <MemoryRouter>
          <SuperAdminPage />
        </MemoryRouter>,
      );
      expect(mockRecheckMutate).toHaveBeenCalledTimes(1);
    });

    it('v0.109: loading 중엔 auto recheck 안 함', () => {
      mockUseUnresolvedRoleSplits.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        error: null,
      });
      renderWithRouter(<SuperAdminPage />);
      expect(mockRecheckMutate).not.toHaveBeenCalled();
    });

    it('v0.109: isError 중엔 auto recheck 안 함', () => {
      mockUseUnresolvedRoleSplits.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new Error('boom'),
      });
      renderWithRouter(<SuperAdminPage />);
      expect(mockRecheckMutate).not.toHaveBeenCalled();
    });
  });
});
