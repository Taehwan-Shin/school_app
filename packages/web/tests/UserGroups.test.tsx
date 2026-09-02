import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UserGroups } from '../src/routes/admin/UserGroups';

const mockUseGroupsList = vi.fn();

vi.mock('../src/api/groupsList', () => ({
  useGroupsList: (enabled?: boolean, options?: any) => mockUseGroupsList(enabled, options),
}));

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('UserGroups component', () => {
  const defaultMockReturn = {
    data: null,
    isLoading: false,
    isError: false,
    error: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGroupsList.mockReturnValue({ ...defaultMockReturn });
  });

  it('scenario 1: renders loading indicator when isLoading is true', () => {
    mockUseGroupsList.mockReturnValue({
      ...defaultMockReturn,
      isLoading: true,
    });

    renderWithRouter(<UserGroups userEmail="student@cam.hs.kr" />);
    expect(screen.getByTestId('user-groups-loading')).toBeDefined();
    expect(screen.getByText('소속 그룹을 불러오는 중...')).toBeDefined();
    expect(mockUseGroupsList).toHaveBeenCalledWith(true, { userKey: 'student@cam.hs.kr' });
  });

  it('scenario 2: renders error message when error occurs', () => {
    mockUseGroupsList.mockReturnValue({
      ...defaultMockReturn,
      isLoading: false,
      isError: true,
      error: new Error('Failed to fetch groups'),
    });

    renderWithRouter(<UserGroups userEmail="student@cam.hs.kr" />);
    expect(screen.getByTestId('user-groups-error')).toBeDefined();
    expect(screen.getByText('소속 그룹을 불러오지 못했습니다: Failed to fetch groups')).toBeDefined();
  });

  it('scenario 3: renders empty message when groups is empty', () => {
    mockUseGroupsList.mockReturnValue({
      ...defaultMockReturn,
      isLoading: false,
      isError: false,
      data: { groups: [] },
    });

    renderWithRouter(<UserGroups userEmail="student@cam.hs.kr" />);
    expect(screen.getByTestId('user-groups-empty')).toBeDefined();
    expect(screen.getByText('이 사용자는 어떤 그룹에도 속하지 않습니다.')).toBeDefined();
  });

  it('scenario 4: renders 2 groups with links to group details', () => {
    mockUseGroupsList.mockReturnValue({
      ...defaultMockReturn,
      isLoading: false,
      isError: false,
      data: {
        groups: [
          {
            email: 'teachers@cam.hs.kr',
            name: '교직원',
            description: '전체 교직원 그룹',
            aliases: [],
            directMembersCount: 42,
          },
          {
            email: 'grade1@cam.hs.kr',
            name: '1학년',
            description: '',
            aliases: [],
            directMembersCount: 15,
          },
        ],
      },
    });

    renderWithRouter(<UserGroups userEmail="student@cam.hs.kr" />);
    expect(screen.getByTestId('user-group-row-teachers@cam.hs.kr')).toBeDefined();
    expect(screen.getByTestId('user-group-row-grade1@cam.hs.kr')).toBeDefined();

    const link1 = screen.getByRole('link', { name: 'teachers@cam.hs.kr' });
    expect(link1.getAttribute('href')).toBe('/admin/groups/teachers%40cam.hs.kr');
    expect(screen.getByText('교직원')).toBeDefined();
    expect(screen.getByText('전체 교직원 그룹')).toBeDefined();
    expect(screen.getByText('42')).toBeDefined();

    const link2 = screen.getByRole('link', { name: 'grade1@cam.hs.kr' });
    expect(link2.getAttribute('href')).toBe('/admin/groups/grade1%40cam.hs.kr');
    expect(screen.getByText('1학년')).toBeDefined();
    expect(screen.getByText('15')).toBeDefined();
  });
});
