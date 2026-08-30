import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockUseUsersList = vi.fn();

vi.mock('../src/api/usersList.js', () => ({
  useUsersList: () => mockUseUsersList(),
}));

import { AccountsTable } from '../src/routes/admin/AccountsTable.js';

describe('AccountsTable component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state indicator while data is fetching', () => {
    mockUseUsersList.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    });

    render(<AccountsTable />);
    expect(screen.getByTestId('accounts-loading')).toBeDefined();
    expect(screen.getByText('계정 목록을 불러오는 중...')).toBeDefined();
  });

  it('renders friendly permission error message on permission denial', () => {
    mockUseUsersList.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('permission-denied: requires admin role'),
    });

    render(<AccountsTable />);
    expect(screen.getByTestId('accounts-error')).toBeDefined();
    expect(screen.getByText('이 기능은 관리자만 사용할 수 있습니다.')).toBeDefined();
  });

  it('renders generic error message on other errors', () => {
    mockUseUsersList.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Network error'),
    });

    render(<AccountsTable />);
    expect(screen.getByTestId('accounts-error')).toBeDefined();
    expect(screen.getByText(/계정 목록을 불러오지 못했습니다: Network error/)).toBeDefined();
  });

  it('renders empty message when no accounts exist', () => {
    mockUseUsersList.mockReturnValue({
      data: { users: [] },
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<AccountsTable />);
    expect(screen.getByTestId('accounts-empty')).toBeDefined();
    expect(screen.getByText('계정이 없습니다.')).toBeDefined();
  });

  it('renders table rows accurately for accounts', () => {
    const mockUsers = [
      {
        email: 'admin@cam.hs.kr',
        firstName: '관리',
        lastName: '김',
        orgUnitPath: '/',
        isAdmin: true,
        isSuspended: false,
      },
      {
        email: 'teacher1@cam.hs.kr',
        firstName: '길동',
        lastName: '홍',
        orgUnitPath: '/교사',
        isAdmin: false,
        isSuspended: true,
      },
    ];

    mockUseUsersList.mockReturnValue({
      data: { users: mockUsers },
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<AccountsTable />);

    // Header check
    expect(screen.getByText('Email')).toBeDefined();
    expect(screen.getByText('이름')).toBeDefined();
    expect(screen.getByText('조직 단위')).toBeDefined();
    expect(screen.getByText('정지')).toBeDefined();
    expect(screen.getAllByText('관리자').length).toBeGreaterThanOrEqual(2); // Header + row badge

    // Row 1 check
    expect(screen.getByText('admin@cam.hs.kr')).toBeDefined();
    expect(screen.getByText('김관리')).toBeDefined();
    expect(screen.getByText('/')).toBeDefined();
    expect(screen.getByText('정상')).toBeDefined();

    // Row 2 check
    expect(screen.getByText('teacher1@cam.hs.kr')).toBeDefined();
    expect(screen.getByText('홍길동')).toBeDefined();
    expect(screen.getByText('/교사')).toBeDefined();
    expect(screen.getByText('일반')).toBeDefined();
    expect(screen.getByText('정지됨')).toBeDefined();
  });
});
