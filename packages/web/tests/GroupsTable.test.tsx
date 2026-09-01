import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockUseGroupsList = vi.fn();

vi.mock('../src/api/groupsList.js', () => ({
  useGroupsList: () => mockUseGroupsList(),
}));

import { GroupsTable } from '../src/routes/admin/GroupsTable.js';

function renderWithRouter(ui: React.ReactElement, initialEntries: string[] = ['/admin/groups']) {
  return render(<MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>);
}

describe('GroupsTable component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state indicator while data is fetching', () => {
    mockUseGroupsList.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    });

    renderWithRouter(<GroupsTable />);
    expect(screen.getByTestId('groups-loading')).toBeDefined();
    expect(screen.getByText('그룹 목록을 불러오는 중...')).toBeDefined();
  });

  it('renders friendly permission error message on permission denial', () => {
    mockUseGroupsList.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('permission-denied: requires admin role'),
    });

    renderWithRouter(<GroupsTable />);
    expect(screen.getByTestId('groups-error')).toBeDefined();
    expect(screen.getByText('이 기능은 관리자만 사용할 수 있습니다.')).toBeDefined();
  });

  it('renders generic error message on other errors', () => {
    mockUseGroupsList.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Network error'),
    });

    renderWithRouter(<GroupsTable />);
    expect(screen.getByTestId('groups-error')).toBeDefined();
    expect(screen.getByText(/그룹 목록을 불러오지 못했습니다: Network error/)).toBeDefined();
  });

  it('renders empty message when no groups exist', () => {
    mockUseGroupsList.mockReturnValue({
      data: { groups: [] },
      isLoading: false,
      isError: false,
      error: null,
    });

    renderWithRouter(<GroupsTable />);
    expect(screen.getByTestId('groups-empty')).toBeDefined();
    expect(screen.getByText('등록된 그룹이 없습니다.')).toBeDefined();
  });

  it('renders table rows accurately for groups including aliases formatting', () => {
    const mockGroups = [
      {
        email: 'teachers@cam.hs.kr',
        name: '교사 전체',
        description: '교직원 안내용 그룹',
        aliases: ['all-teachers@cam.hs.kr', 'faculty@cam.hs.kr'],
        directMembersCount: 42,
      },
      {
        email: 'grade1@cam.hs.kr',
        name: '1학년 교사',
        description: '1학년 담당 교사',
        aliases: [],
        directMembersCount: 15,
      },
    ];

    mockUseGroupsList.mockReturnValue({
      data: { groups: mockGroups },
      isLoading: false,
      isError: false,
      error: null,
    });

    renderWithRouter(<GroupsTable />);

    // Header check
    expect(screen.getByText('이메일')).toBeDefined();
    expect(screen.getByText('이름')).toBeDefined();
    expect(screen.getByText('설명')).toBeDefined();
    expect(screen.getByText('별칭')).toBeDefined();
    expect(screen.getByText('멤버 수')).toBeDefined();

    // Row 1
    const row1 = screen.getByTestId('group-row-teachers@cam.hs.kr');
    expect(row1).toBeDefined();
    expect(row1.textContent).toContain('teachers@cam.hs.kr');
    expect(row1.textContent).toContain('교사 전체');
    expect(row1.textContent).toContain('교직원 안내용 그룹');
    expect(row1.textContent).toContain('all-teachers@cam.hs.kr, faculty@cam.hs.kr');
    expect(row1.textContent).toContain('42');

    // Row 2
    const row2 = screen.getByTestId('group-row-grade1@cam.hs.kr');
    expect(row2).toBeDefined();
    expect(row2.textContent).toContain('grade1@cam.hs.kr');
    expect(row2.textContent).toContain('1학년 교사');
    expect(row2.textContent).toContain('1학년 담당 교사');
    expect(row2.textContent).toContain('-');
    expect(row2.textContent).toContain('15');
  });

  it('renders 0 directMembersCount accurately', () => {
    const mockGroups = [
      {
        email: 'empty-group@cam.hs.kr',
        name: '빈 그룹',
        description: '',
        aliases: [],
        directMembersCount: 0,
      },
    ];

    mockUseGroupsList.mockReturnValue({
      data: { groups: mockGroups },
      isLoading: false,
      isError: false,
      error: null,
    });

    renderWithRouter(<GroupsTable />);

    const row = screen.getByTestId('group-row-empty-group@cam.hs.kr');
    expect(row).toBeDefined();
    expect(row.textContent).toContain('0');
  });
});
