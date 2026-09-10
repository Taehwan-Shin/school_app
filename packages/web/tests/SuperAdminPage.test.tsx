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

// v0.107: role_split 자동 복구 hook mock.
const mockResolveMutate = vi.fn();
const mockUseUsersResolveRoleSplit = vi.fn();
vi.mock('../src/api/usersResolveRoleSplit', () => ({
  useUsersResolveRoleSplit: () => mockUseUsersResolveRoleSplit(),
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
    mockUseAuditLogList.mockReturnValue({
      entries: [],
      loading: false,
      error: null,
      hasMore: false,
      loadMore: vi.fn(),
      reload: vi.fn(),
    });
    mockResolveMutate.mockReset();
    mockUseUsersResolveRoleSplit.mockReturnValue({
      mutate: mockResolveMutate,
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

  // v0.106: server-side action 필터 · trigger-scope caveat.
  it('v0.106: empty state → trigger-scope caveat + strong 강조, ** 노출 없음', () => {
    mockUseUsersList.mockReturnValue({ data: { users: [] }, isLoading: false, isError: false });
    mockUseGroupsList.mockReturnValue({ data: { groups: [] }, isLoading: false, isError: false });
    renderWithRouter(<SuperAdminPage />);

    const section = screen.getByTestId('super-admin-role-split-section');
    expect(section).toBeDefined();
    // 서버가 이미 action 필터로 정확히 셌으므로 「감사 이벤트 없음」 이 확정 상태.
    expect(section.textContent).toContain('role_split 감사 이벤트 없음');
    // trigger-scope caveat: 편집 대화상자 열림 시에만 감지.
    const strong = section.querySelector('strong');
    expect(strong).not.toBeNull();
    expect(strong!.textContent).toContain('역할 편집 대화상자를 열어본 계정에서만 감지');
    // 화면에 raw ** 이 노출되면 안 됨.
    expect(section.textContent).not.toContain('**');
    // v0.105 의 sample-scope 문구 는 v0.106 에서 사라져야 (server 필터가 정확 매치).
    expect(section.textContent).not.toContain('전수 대조가 아니라 최근 조회 sample 안에서만');
    // 이전 「동기 상태」 단정 표현도 계속 없어야.
    expect(section.textContent).not.toContain('동기 상태');
    expect(screen.queryByTestId('super-admin-role-split-list')).toBeNull();
  });

  // v0.105b (v0.106 유지): hasMore=true 시 pagination 안내 문구.
  it('v0.106: hasMore=true → 표시 상한 초과 안내 (loading/error 아닌 경우만)', () => {
    mockUseUsersList.mockReturnValue({ data: { users: [] }, isLoading: false, isError: false });
    mockUseGroupsList.mockReturnValue({ data: { groups: [] }, isLoading: false, isError: false });
    mockUseAuditLogList.mockReturnValue({
      entries: [],
      loading: false,
      error: null,
      hasMore: true,
      loadMore: vi.fn(),
      reload: vi.fn(),
    });
    renderWithRouter(<SuperAdminPage />);

    const section = screen.getByTestId('super-admin-role-split-section');
    expect(section.textContent).toContain('표시 상한 초과');
  });

  // v0.106b F38: useAuditLogList 초기 cursor undefined → hasMore=true 로 떨어지므로,
  // loading 중에는 pagination 안내를 렌더하면 안 됨 (실제 데이터 없이 존재하지 않는 pagination
  // 을 사용자에게 안내하게 됨).
  it('v0.106b F38: loading=true + hasMore=true → pagination 안내 없음', () => {
    mockUseUsersList.mockReturnValue({ data: { users: [] }, isLoading: false, isError: false });
    mockUseGroupsList.mockReturnValue({ data: { groups: [] }, isLoading: false, isError: false });
    mockUseAuditLogList.mockReturnValue({
      entries: [],
      loading: true,
      error: null,
      hasMore: true,
      loadMore: vi.fn(),
      reload: vi.fn(),
    });
    renderWithRouter(<SuperAdminPage />);

    const section = screen.getByTestId('super-admin-role-split-section');
    expect(section.textContent).toContain('불러오는 중');
    expect(section.textContent).not.toContain('표시 상한 초과');
  });

  it('v0.106b F38: error + hasMore=true → pagination 안내 없음', () => {
    mockUseUsersList.mockReturnValue({ data: { users: [] }, isLoading: false, isError: false });
    mockUseGroupsList.mockReturnValue({ data: { groups: [] }, isLoading: false, isError: false });
    mockUseAuditLogList.mockReturnValue({
      entries: [],
      loading: false,
      error: new Error('boom'),
      hasMore: true,
      loadMore: vi.fn(),
      reload: vi.fn(),
    });
    renderWithRouter(<SuperAdminPage />);

    const section = screen.getByTestId('super-admin-role-split-section');
    expect(section.textContent).toContain('감시 데이터를 불러오지 못했습니다');
    expect(section.textContent).not.toContain('표시 상한 초과');
  });

  it('v0.106: role_split entries → count + 최근 3건 표시, "전체 보기" 링크', () => {
    mockUseUsersList.mockReturnValue({ data: { users: [] }, isLoading: false, isError: false });
    mockUseGroupsList.mockReturnValue({ data: { groups: [] }, isLoading: false, isError: false });

    // v0.106: server 가 action=system.role_split_detected 로 정확히 필터해서 넘김.
    const entries: AuditLogEntryRead[] = [
      {
        id: 'log-rs-1',
        actor: 'super@cam.hs.kr',
        role: 'super_admin',
        action: 'system.role_split_detected',
        target: 'users/uid-A',
        request_id: 'req-1',
        result: 'error',
        at: 1725150000000,
        message: 'role_split: auth=admin firestore=teacher',
      },
      {
        id: 'log-rs-2',
        actor: 'super@cam.hs.kr',
        role: 'super_admin',
        action: 'system.role_split_detected',
        target: 'users/uid-B',
        request_id: 'req-2',
        result: 'error',
        at: 1725149000000,
        message: 'role_split: auth=null firestore=admin',
      },
    ];
    // v0.107b: detected 는 위 entries, resolved 는 빈 배열 (재감지 반영 대비).
    mockUseAuditLogList.mockImplementation((_size: number, opts: any) => ({
      entries: opts?.filterAction === 'system.role_split_resolved' ? [] : entries,
      loading: false,
      error: null,
      hasMore: false,
      loadMore: vi.fn(),
      reload: vi.fn(),
    }));

    renderWithRouter(<SuperAdminPage />);

    const section = screen.getByTestId('super-admin-role-split-section');
    expect(section.textContent).toContain('role_split 감사 이벤트 2건');
    // "전체 보기" 링크는 v0.106 전용 action 필터로 이동 (q=role_split 대신).
    const link = screen.getByTestId('super-admin-role-split-link');
    expect(link.getAttribute('href')).toContain('/super_admin/audit');
    expect(link.getAttribute('href')).toContain('action=system.role_split_detected');
    // role_split 항목 2개 표시.
    expect(screen.getByTestId('super-admin-role-split-item-log-rs-1')).toBeDefined();
    expect(screen.getByTestId('super-admin-role-split-item-log-rs-2')).toBeDefined();
  });

  it('v0.106+v0.107b: hook 이 detected 와 resolved 두 filterAction 으로 호출 (result 필터 없음)', () => {
    mockUseUsersList.mockReturnValue({ data: { users: [] }, isLoading: false, isError: false });
    mockUseGroupsList.mockReturnValue({ data: { groups: [] }, isLoading: false, isError: false });
    renderWithRouter(<SuperAdminPage />);

    // 두 feed: detected + resolved.
    const actions = mockUseAuditLogList.mock.calls.map((c) => c[1]?.filterAction);
    expect(actions).toContain('system.role_split_detected');
    expect(actions).toContain('system.role_split_resolved');
    // filterResult 는 어느 호출에도 없어야.
    for (const c of mockUseAuditLogList.mock.calls) {
      expect(c[1]?.filterResult).toBeUndefined();
    }
  });

  // v0.107: role_split 자동 복구 (Firestore = Auth 동기화).
  describe('v0.107: role_split resolve', () => {
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

    // v0.107b: 카드가 detected 와 resolved 두 feed 를 호출하므로 filterAction 별 분기 헬퍼.
    function mockTwoFeeds({
      detected,
      resolved = [],
    }: {
      detected: AuditLogEntryRead[];
      resolved?: AuditLogEntryRead[];
    }) {
      mockUseAuditLogList.mockImplementation((_size: number, opts: any) => {
        const entries =
          opts?.filterAction === 'system.role_split_resolved' ? resolved : detected;
        return {
          entries,
          loading: false,
          error: null,
          hasMore: false,
          loadMore: vi.fn(),
          reload: vi.fn(),
        };
      });
    }

    beforeEach(() => {
      mockUseUsersList.mockReturnValue({ data: { users: [] }, isLoading: false, isError: false });
      mockUseGroupsList.mockReturnValue({ data: { groups: [] }, isLoading: false, isError: false });
      mockTwoFeeds({ detected: [roleSplitEntry], resolved: [] });
    });

    it('v0.107b: 복구 버튼 클릭 → confirm 통과 시 mutate 에 CAS 기대치 포함해 호출', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      renderWithRouter(<SuperAdminPage />);

      const btn = screen.getByTestId('super-admin-role-split-resolve-log-rs-x');
      fireEvent.click(btn);

      expect(mockResolveMutate).toHaveBeenCalledTimes(1);
      // v0.107b F42: uid + expected 기대치 포함.
      expect(mockResolveMutate.mock.calls[0][0]).toEqual({
        uid: 'uid-target-1',
        expectedAuthRole: 'admin',
        expectedFirestoreRole: 'teacher',
      });
    });

    it('v0.107: confirm 거부 시 mutate 호출 안 함', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      renderWithRouter(<SuperAdminPage />);

      const btn = screen.getByTestId('super-admin-role-split-resolve-log-rs-x');
      fireEvent.click(btn);

      expect(mockResolveMutate).not.toHaveBeenCalled();
    });

    it('v0.107: mutate pending 중 버튼 disabled 및 「동기화 중」 텍스트', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      // mutate 가 아무것도 호출하지 않고 걸려있는 상태 시뮬레이션.
      mockResolveMutate.mockImplementation(() => {});
      // hook 이 isPending=true 반환.
      mockUseUsersResolveRoleSplit.mockReturnValue({
        mutate: mockResolveMutate,
        isPending: true,
        error: null,
      });

      renderWithRouter(<SuperAdminPage />);

      const btn = screen.getByTestId('super-admin-role-split-resolve-log-rs-x') as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });

    it('v0.107b: mutate 성공 시 detected + resolved 양쪽 feed reload 호출', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const detectedReload = vi.fn();
      const resolvedReload = vi.fn();
      mockUseAuditLogList.mockImplementation((_size: number, opts: any) => ({
        entries: opts?.filterAction === 'system.role_split_resolved' ? [] : [roleSplitEntry],
        loading: false,
        error: null,
        hasMore: false,
        loadMore: vi.fn(),
        reload:
          opts?.filterAction === 'system.role_split_resolved' ? resolvedReload : detectedReload,
      }));
      mockResolveMutate.mockImplementation((_vars: any, opts: any) => {
        opts?.onSuccess?.();
      });

      renderWithRouter(<SuperAdminPage />);
      const btn = screen.getByTestId('super-admin-role-split-resolve-log-rs-x');
      fireEvent.click(btn);

      expect(detectedReload).toHaveBeenCalledTimes(1);
      expect(resolvedReload).toHaveBeenCalledTimes(1);
    });

    it('v0.107: mutate 실패 시 error 문구 렌더', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      mockResolveMutate.mockImplementation((_vars: any, opts: any) => {
        opts?.onError?.(new Error('boom'));
      });

      renderWithRouter(<SuperAdminPage />);
      const btn = screen.getByTestId('super-admin-role-split-resolve-log-rs-x');
      fireEvent.click(btn);

      const err = screen.getByTestId('super-admin-role-split-resolve-error');
      expect(err.textContent).toContain('복구 실패');
      expect(err.textContent).toContain('boom');
    });

    it('v0.107: target 이 users/<uid> 형식이 아니어도 slice 안전 (raw uid 취급)', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const rawTargetEntry: AuditLogEntryRead = {
        ...roleSplitEntry,
        id: 'log-rs-raw',
        target: 'raw-uid-abc', // users/ prefix 없음
      };
      mockTwoFeeds({ detected: [rawTargetEntry], resolved: [] });

      renderWithRouter(<SuperAdminPage />);
      const btn = screen.getByTestId('super-admin-role-split-resolve-log-rs-raw');
      fireEvent.click(btn);

      expect(mockResolveMutate).toHaveBeenCalledWith(
        { uid: 'raw-uid-abc', expectedAuthRole: 'admin', expectedFirestoreRole: 'teacher' },
        expect.anything(),
      );
    });

    // v0.107b F41: detected 이벤트가 resolved 이벤트 이전이면 카드에서 제외.
    it('v0.107b F41: target 별 resolved.at > detected.at → 카드에서 제외', () => {
      const olderDetected: AuditLogEntryRead = {
        ...roleSplitEntry,
        id: 'log-rs-older',
        at: 1725100000000, // 이전
      };
      const newerResolved: AuditLogEntryRead = {
        ...roleSplitEntry,
        id: 'log-rr-newer',
        action: 'system.role_split_resolved',
        at: 1725200000000, // 이후
        result: 'ok',
        message: 'resolved: firestore teacher → admin (auth 원본)',
      };
      mockTwoFeeds({ detected: [olderDetected], resolved: [newerResolved] });

      renderWithRouter(<SuperAdminPage />);
      // 해결된 detected 는 카드 항목에 표시되지 않아야.
      expect(screen.queryByTestId('super-admin-role-split-item-log-rs-older')).toBeNull();
      // 카드 요약도 empty state 로 렌더.
      const section = screen.getByTestId('super-admin-role-split-section');
      expect(section.textContent).toContain('role_split 감사 이벤트 없음');
    });

    it('v0.107b F41: detected.at > resolved.at → 재감지, 카드에 표시', () => {
      const newerDetected: AuditLogEntryRead = {
        ...roleSplitEntry,
        id: 'log-rs-newer',
        at: 1725300000000, // 재감지
      };
      const olderResolved: AuditLogEntryRead = {
        ...roleSplitEntry,
        id: 'log-rr-older',
        action: 'system.role_split_resolved',
        at: 1725200000000,
        result: 'ok',
        message: 'resolved: firestore teacher → admin (auth 원본)',
      };
      mockTwoFeeds({ detected: [newerDetected], resolved: [olderResolved] });

      renderWithRouter(<SuperAdminPage />);
      expect(screen.getByTestId('super-admin-role-split-item-log-rs-newer')).toBeDefined();
    });

    // v0.107b F42: message 파싱 실패 시 mutate 호출 안 함 + error 문구.
    it('v0.107b F42: message 파싱 실패 → mutate 호출 안 함 + error', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const malformedEntry: AuditLogEntryRead = {
        ...roleSplitEntry,
        id: 'log-rs-mal',
        message: 'no matching pattern here',
      };
      mockTwoFeeds({ detected: [malformedEntry], resolved: [] });

      renderWithRouter(<SuperAdminPage />);
      const btn = screen.getByTestId('super-admin-role-split-resolve-log-rs-mal');
      fireEvent.click(btn);

      expect(mockResolveMutate).not.toHaveBeenCalled();
      const err = screen.getByTestId('super-admin-role-split-resolve-error');
      expect(err.textContent).toContain('파싱할 수 없음');
    });
  });
});
