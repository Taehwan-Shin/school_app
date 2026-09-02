import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { UserDetailPage } from '../src/routes/admin/userDetail';
import type { UserItem } from '../src/api/usersList';

const mockUseUsersList = vi.fn();
const mockUseAuditLogList = vi.fn();

vi.mock('../src/lib/auth', () => ({
  useAuth: () => ({
    user: { email: 'admin@cam.hs.kr' },
    role: 'admin',
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

vi.mock('../src/api/auditLogList', () => ({
  useAuditLogList: (pageSize?: number, filters?: any) => mockUseAuditLogList(pageSize, filters),
}));

function renderDetailPage(initialEmail = 'admin2@cam.hs.kr') {
  return render(
    <MemoryRouter initialEntries={[`/admin/users/${encodeURIComponent(initialEmail)}`]}>
      <Routes>
        <Route path="/admin/users/:email" element={<UserDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('UserDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuditLogList.mockReturnValue({
      entries: [],
      loading: false,
      error: null,
      hasMore: false,
      loadMore: vi.fn(),
      reload: vi.fn(),
    });
  });

  it('scenario 1: user exists - renders info card and audit trail section', () => {
    const mockUsers: UserItem[] = [
      {
        email: 'admin2@cam.hs.kr',
        firstName: '철수',
        lastName: '김',
        orgUnitPath: '/교무부',
        isAdmin: true,
        isSuspended: false,
      },
    ];

    mockUseUsersList.mockReturnValue({
      data: { users: mockUsers },
      isLoading: false,
      isError: false,
      error: null,
    });

    renderDetailPage('admin2@cam.hs.kr');

    expect(screen.getByText('사용자: admin2@cam.hs.kr')).toBeDefined();
    expect(screen.getByText('← 계정 목록')).toBeDefined();

    expect(screen.getByTestId('user-detail-info')).toBeDefined();
    expect(screen.getByText('admin2@cam.hs.kr')).toBeDefined();
    expect(screen.getByText('김철수')).toBeDefined();
    expect(screen.getByText('/교무부')).toBeDefined();
    expect(screen.getByText('관리자')).toBeDefined();
    expect(screen.getByText('정상')).toBeDefined();

    expect(screen.getByText('감사 이력')).toBeDefined();
    expect(
      screen.getByText('이 사용자를 대상으로 발생한 모든 관리자 행위의 기록입니다.')
    ).toBeDefined();
    expect(screen.getByTestId('user-audit-empty')).toBeDefined();
    expect(mockUseAuditLogList).toHaveBeenCalledWith(25, { filterTarget: 'admin2@cam.hs.kr' });
  });

  it('scenario 2: user not found - renders user-detail-not-found message', () => {
    mockUseUsersList.mockReturnValue({
      data: { users: [] },
      isLoading: false,
      isError: false,
      error: null,
    });

    renderDetailPage('admin2@cam.hs.kr');

    expect(screen.getByTestId('user-detail-not-found')).toBeDefined();
    expect(screen.getByText('사용자를 찾을 수 없습니다: admin2@cam.hs.kr')).toBeDefined();
    expect(screen.queryByTestId('user-detail-info')).toBeNull();
    expect(screen.queryByText('감사 이력')).toBeNull();
  });

  it('scenario 3: loading state - renders loading text', () => {
    mockUseUsersList.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    });

    renderDetailPage('admin2@cam.hs.kr');

    expect(screen.getByText('불러오는 중...')).toBeDefined();
    expect(screen.queryByTestId('user-detail-info')).toBeNull();
  });
});
