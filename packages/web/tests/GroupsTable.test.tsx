import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation, useSearchParams } from 'react-router-dom';

const mockUseGroupsList = vi.fn();

vi.mock('../src/api/groupsList.js', () => ({
  useGroupsList: () => mockUseGroupsList(),
}));

vi.mock('../src/api/groupsCreate.js', () => ({
  useCreateGroup: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
  }),
}));

vi.mock('../src/api/groupsUpdate.js', () => ({
  useUpdateGroup: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
  }),
}));

vi.mock('../src/api/groupsDelete.js', () => ({
  useDeleteGroup: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
  }),
}));

import { GroupsTable } from '../src/routes/admin/GroupsTable.js';

function renderWithRouter(ui: React.ReactElement, initialEntries: string[] = ['/admin/groups']) {
  return render(<MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>);
}

describe('GroupsTable component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // v0.161: 정렬 선호 localStorage bleed 방지.
    localStorage.clear();
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
    expect(screen.getByText('관리')).toBeDefined();

    // Row 1
    const row1 = screen.getByTestId('group-row-teachers@cam.hs.kr');
    expect(row1).toBeDefined();
    expect(row1.textContent).toContain('teachers@cam.hs.kr');
    expect(row1.textContent).toContain('교사 전체');
    expect(row1.textContent).toContain('교직원 안내용 그룹');
    expect(row1.textContent).toContain('all-teachers@cam.hs.kr, faculty@cam.hs.kr');
    expect(row1.textContent).toContain('42');
    expect(screen.getByTestId('edit-group-teachers@cam.hs.kr')).toBeDefined();
    expect(screen.getByTestId('delete-group-teachers@cam.hs.kr')).toBeDefined();

    // Row 2
    const row2 = screen.getByTestId('group-row-grade1@cam.hs.kr');
    expect(row2).toBeDefined();
    expect(row2.textContent).toContain('grade1@cam.hs.kr');
    expect(row2.textContent).toContain('1학년 교사');
    expect(row2.textContent).toContain('1학년 담당 교사');
    expect(row2.textContent).toContain('-');
    expect(row2.textContent).toContain('15');
    expect(screen.getByTestId('edit-group-grade1@cam.hs.kr')).toBeDefined();
    expect(screen.getByTestId('delete-group-grade1@cam.hs.kr')).toBeDefined();
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

  // 신규 시나리오 1: 「+ 그룹 추가」 버튼 렌더 + 클릭 시 CreateGroupDialog 열림
  it('renders "+ 그룹 추가" button and opens CreateGroupDialog on click', () => {
    mockUseGroupsList.mockReturnValue({
      data: { groups: [] },
      isLoading: false,
      isError: false,
      error: null,
    });

    renderWithRouter(<GroupsTable />);

    const addBtn = screen.getByTestId('add-group-btn');
    expect(addBtn).toBeDefined();
    expect(addBtn.textContent).toContain('+ 그룹 추가');

    fireEvent.click(addBtn);
    expect(screen.getByText('Google Workspace 그룹 추가')).toBeDefined();
    expect(screen.getByTestId('create-group-submit')).toBeDefined();
  });

  // 신규 시나리오 2: 편집 링크 클릭 시 EditGroupDialog 가 해당 그룹으로 pre-fill 되어 열림
  it('opens EditGroupDialog pre-filled with group data when clicking "편집" link', () => {
    const mockGroups = [
      {
        email: 'team-a@cam.hs.kr',
        name: 'Team A',
        description: 'First team',
        aliases: [],
        directMembersCount: 5,
      },
    ];

    mockUseGroupsList.mockReturnValue({
      data: { groups: mockGroups },
      isLoading: false,
      isError: false,
      error: null,
    });

    renderWithRouter(<GroupsTable />);

    const editBtn = screen.getByTestId('edit-group-team-a@cam.hs.kr');
    expect(editBtn).toBeDefined();

    fireEvent.click(editBtn);

    expect(screen.getByText('그룹 편집')).toBeDefined();
    const emailEl = screen.getByTestId('edit-group-email');
    expect(emailEl.textContent).toBe('team-a@cam.hs.kr');

    const nameInput = screen.getByLabelText(/이름 \*/) as HTMLInputElement;
    const descInput = screen.getByLabelText(/설명/) as HTMLInputElement;
    expect(nameInput.value).toBe('Team A');
    expect(descInput.value).toBe('First team');
  });

  // 신규 시나리오 3: 삭제 링크 클릭 시 DeleteGroupDialog 열림
  it('opens DeleteGroupDialog when clicking "삭제" link', () => {
    const mockGroups = [
      {
        email: 'team-a@cam.hs.kr',
        name: 'Team A',
        description: 'First team',
        aliases: [],
        directMembersCount: 5,
      },
    ];

    mockUseGroupsList.mockReturnValue({
      data: { groups: mockGroups },
      isLoading: false,
      isError: false,
      error: null,
    });

    renderWithRouter(<GroupsTable />);

    const deleteBtn = screen.getByTestId('delete-group-team-a@cam.hs.kr');
    expect(deleteBtn).toBeDefined();

    fireEvent.click(deleteBtn);

    expect(screen.getByText('그룹 삭제 확인')).toBeDefined();
    expect(screen.getAllByText('team-a@cam.hs.kr').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Team A').length).toBeGreaterThanOrEqual(1);
  });

  it('renders group email as link to group details page with encoded email', () => {
    const mockGroups = [
      {
        email: 'team-a@cam.hs.kr',
        name: 'Team A',
        description: 'Team A group',
        aliases: [],
        directMembersCount: 5,
      },
    ];

    mockUseGroupsList.mockReturnValue({
      data: { groups: mockGroups },
      isLoading: false,
      isError: false,
      error: null,
    });

    renderWithRouter(<GroupsTable />);

    const link = screen.getByRole('link', { name: 'team-a@cam.hs.kr' });
    expect(link).toBeDefined();
    expect(link.getAttribute('href')).toBe(
      `/admin/groups/${encodeURIComponent('team-a@cam.hs.kr')}`
    );
  });

  it('filters groups by search query matching email, name, or description', () => {
    const mockGroups = [
      {
        email: 'teachers@cam.hs.kr',
        name: '교사 전체',
        description: '교직원 안내용 그룹',
        aliases: [],
        directMembersCount: 42,
      },
      {
        email: 'students@cam.hs.kr',
        name: '학생 전체',
        description: '재학생 공지용',
        aliases: [],
        directMembersCount: 300,
      },
      {
        email: 'devclub@cam.hs.kr',
        name: '코딩 동아리',
        description: '동아리 활동',
        aliases: [],
        directMembersCount: 12,
      },
    ];

    mockUseGroupsList.mockReturnValue({
      data: { groups: mockGroups },
      isLoading: false,
      isError: false,
      error: null,
    });

    renderWithRouter(<GroupsTable />);
    const searchInput = screen.getByTestId('groups-search-input');

    // Search by email
    fireEvent.change(searchInput, { target: { value: 'teachers' } });
    expect(screen.getByText('teachers@cam.hs.kr')).toBeDefined();
    expect(screen.queryByText('students@cam.hs.kr')).toBeNull();
    expect(screen.queryByText('devclub@cam.hs.kr')).toBeNull();

    // Search by name
    fireEvent.change(searchInput, { target: { value: '학생' } });
    expect(screen.getByText('students@cam.hs.kr')).toBeDefined();
    expect(screen.queryByText('teachers@cam.hs.kr')).toBeNull();

    // Search by description
    fireEvent.change(searchInput, { target: { value: '동아리' } });
    expect(screen.getByText('devclub@cam.hs.kr')).toBeDefined();
    expect(screen.queryByText('teachers@cam.hs.kr')).toBeNull();

    // Search with no matches
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });
    expect(screen.getByTestId('groups-search-empty')).toBeDefined();
    expect(screen.getByText('검색 결과가 없습니다.')).toBeDefined();
    expect(screen.queryByText('devclub@cam.hs.kr')).toBeNull();
  });

  it('toggles sorting when clicking column headers', () => {
    const mockGroups = [
      {
        email: 'charlie@cam.hs.kr',
        name: '다 그룹',
        description: '설명 다',
        aliases: [],
        directMembersCount: 10,
      },
      {
        email: 'alice@cam.hs.kr',
        name: '가 그룹',
        description: '설명 가',
        aliases: [],
        directMembersCount: 30,
      },
      {
        email: 'bob@cam.hs.kr',
        name: '나 그룹',
        description: '설명 나',
        aliases: [],
        directMembersCount: 20,
      },
    ];

    mockUseGroupsList.mockReturnValue({
      data: { groups: mockGroups },
      isLoading: false,
      isError: false,
      error: null,
    });

    renderWithRouter(<GroupsTable />);
    const emailHeader = screen.getByTestId('groups-sort-email');

    // Click 1: Email asc
    fireEvent.click(emailHeader);
    expect(emailHeader.getAttribute('aria-sort')).toBe('ascending');
    let rows = screen.getAllByRole('row').slice(1);
    expect(rows[0].textContent).toContain('alice@cam.hs.kr');
    expect(rows[1].textContent).toContain('bob@cam.hs.kr');
    expect(rows[2].textContent).toContain('charlie@cam.hs.kr');

    // Click 2: Email desc
    fireEvent.click(emailHeader);
    expect(emailHeader.getAttribute('aria-sort')).toBe('descending');
    rows = screen.getAllByRole('row').slice(1);
    expect(rows[0].textContent).toContain('charlie@cam.hs.kr');
    expect(rows[1].textContent).toContain('bob@cam.hs.kr');
    expect(rows[2].textContent).toContain('alice@cam.hs.kr');

    // Click name header: Name asc
    const nameHeader = screen.getByTestId('groups-sort-name');
    fireEvent.click(nameHeader);
    expect(nameHeader.getAttribute('aria-sort')).toBe('ascending');
    expect(emailHeader.getAttribute('aria-sort')).toBe('none');
    rows = screen.getAllByRole('row').slice(1);
    expect(rows[0].textContent).toContain('가 그룹');
    expect(rows[1].textContent).toContain('나 그룹');
    expect(rows[2].textContent).toContain('다 그룹');

    // Click directMembersCount header: directMembersCount asc
    const countHeader = screen.getByTestId('groups-sort-directMembersCount');
    fireEvent.click(countHeader);
    expect(countHeader.getAttribute('aria-sort')).toBe('ascending');
    expect(nameHeader.getAttribute('aria-sort')).toBe('none');
    rows = screen.getAllByRole('row').slice(1);
    expect(rows[0].textContent).toContain('10');
    expect(rows[1].textContent).toContain('20');
    expect(rows[2].textContent).toContain('30');

    // Click directMembersCount desc
    fireEvent.click(countHeader);
    expect(countHeader.getAttribute('aria-sort')).toBe('descending');
    rows = screen.getAllByRole('row').slice(1);
    expect(rows[0].textContent).toContain('30');
    expect(rows[1].textContent).toContain('20');
    expect(rows[2].textContent).toContain('10');
  });

  it('navigates between pages with 25 groups per page and resets page on search query change', () => {
    const mockGroups = Array.from({ length: 30 }, (_, i) => ({
      email: `group${String(i + 1).padStart(2, '0')}@cam.hs.kr`,
      name: `그룹 ${i + 1}`,
      description: `설명 ${i + 1}`,
      aliases: [],
      directMembersCount: i + 1,
    }));

    mockUseGroupsList.mockReturnValue({
      data: { groups: mockGroups },
      isLoading: false,
      isError: false,
      error: null,
    });

    renderWithRouter(<GroupsTable />);

    const paginationInfo = screen.getByTestId('groups-pagination-info');
    const prevBtn = screen.getByTestId('groups-pagination-prev') as HTMLButtonElement;
    const nextBtn = screen.getByTestId('groups-pagination-next') as HTMLButtonElement;

    // Page 0: 1–25 of 30
    expect(paginationInfo.textContent).toBe('1–25 of 30');
    expect(prevBtn.disabled).toBe(true);
    expect(nextBtn.disabled).toBe(false);
    expect(screen.getByText('group01@cam.hs.kr')).toBeDefined();
    expect(screen.getByText('group25@cam.hs.kr')).toBeDefined();
    expect(screen.queryByText('group26@cam.hs.kr')).toBeNull();

    // Click Next -> Page 1: 26–30 of 30
    fireEvent.click(nextBtn);
    expect(paginationInfo.textContent).toBe('26–30 of 30');
    expect(prevBtn.disabled).toBe(false);
    expect(nextBtn.disabled).toBe(true);
    expect(screen.queryByText('group01@cam.hs.kr')).toBeNull();
    expect(screen.getByText('group26@cam.hs.kr')).toBeDefined();
    expect(screen.getByText('group30@cam.hs.kr')).toBeDefined();

    // Click Prev -> Page 0: 1–25 of 30
    fireEvent.click(prevBtn);
    expect(paginationInfo.textContent).toBe('1–25 of 30');
    expect(prevBtn.disabled).toBe(true);
    expect(nextBtn.disabled).toBe(false);

    // Navigate to page 1 again, then change search query -> resets to page 0
    fireEvent.click(nextBtn);
    expect(paginationInfo.textContent).toBe('26–30 of 30');

    const searchInput = screen.getByTestId('groups-search-input');
    fireEvent.change(searchInput, { target: { value: 'group' } });
    expect(paginationInfo.textContent).toBe('1–25 of 30');

    // Type more specific search query
    fireEvent.change(searchInput, { target: { value: 'group28' } });
    expect(paginationInfo.textContent).toBe('1–1 of 1');
    expect(screen.getByText('group28@cam.hs.kr')).toBeDefined();
  });

  it('restores search query and sort state from URL parameters on initial load', () => {
    const mockGroups = [
      {
        email: 'alpha@cam.hs.kr',
        name: '알파 그룹',
        description: '첫번째',
        aliases: [],
        directMembersCount: 50,
      },
      {
        email: 'beta@cam.hs.kr',
        name: '베타 그룹',
        description: '두번째',
        aliases: [],
        directMembersCount: 20,
      },
      {
        email: 'gamma@cam.hs.kr',
        name: '감마 그룹',
        description: '세번째',
        aliases: [],
        directMembersCount: 35,
      },
    ];

    mockUseGroupsList.mockReturnValue({
      data: { groups: mockGroups },
      isLoading: false,
      isError: false,
      error: null,
    });

    renderWithRouter(<GroupsTable />, ['/admin/groups?q=그룹&sort=directMembersCount&dir=desc']);

    const searchInput = screen.getByTestId('groups-search-input') as HTMLInputElement;
    expect(searchInput.value).toBe('그룹');

    const countHeader = screen.getByTestId('groups-sort-directMembersCount');
    expect(countHeader.getAttribute('aria-sort')).toBe('descending');

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows[0].textContent).toContain('alpha@cam.hs.kr');
    expect(rows[1].textContent).toContain('gamma@cam.hs.kr');
    expect(rows[2].textContent).toContain('beta@cam.hs.kr');
  });

  it('reflects search query and sort toggle into URL search params', () => {
    let capturedSearch = '';
    function LocationSpy() {
      const location = useLocation();
      capturedSearch = location.search;
      return null;
    }

    const mockGroups = [
      {
        email: 'teachers@cam.hs.kr',
        name: '교사 전체',
        description: '교직원',
        aliases: [],
        directMembersCount: 42,
      },
    ];

    mockUseGroupsList.mockReturnValue({
      data: { groups: mockGroups },
      isLoading: false,
      isError: false,
      error: null,
    });

    render(
      <MemoryRouter initialEntries={['/admin/groups']}>
        <LocationSpy />
        <GroupsTable />
      </MemoryRouter>
    );

    // Search query reflection
    const searchInput = screen.getByTestId('groups-search-input');
    fireEvent.change(searchInput, { target: { value: '교사' } });
    expect(decodeURIComponent(capturedSearch)).toBe('?q=교사');

    // Clear search
    fireEvent.change(searchInput, { target: { value: '' } });
    expect(capturedSearch).toBe('');

    // Sort toggle reflection
    const nameHeader = screen.getByTestId('groups-sort-name');
    fireEvent.click(nameHeader);
    expect(capturedSearch).toBe('?sort=name&dir=asc');

    fireEvent.click(nameHeader);
    expect(capturedSearch).toBe('?sort=name&dir=desc');
  });

  it('filters groups by URL filter=with-members on initial load', () => {
    const mockGroups = [
      {
        email: 'group1@cam.hs.kr',
        name: '그룹 1',
        description: '설명 1',
        aliases: [],
        directMembersCount: 5,
      },
      {
        email: 'group2@cam.hs.kr',
        name: '그룹 2',
        description: '설명 2',
        aliases: [],
        directMembersCount: 10,
      },
      {
        email: 'empty1@cam.hs.kr',
        name: '빈 그룹 1',
        description: '설명 3',
        aliases: [],
        directMembersCount: 0,
      },
      {
        email: 'empty2@cam.hs.kr',
        name: '빈 그룹 2',
        description: '설명 4',
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

    renderWithRouter(<GroupsTable />, ['/admin/groups?filter=with-members']);

    expect(screen.getByText('group1@cam.hs.kr')).toBeDefined();
    expect(screen.getByText('group2@cam.hs.kr')).toBeDefined();
    expect(screen.queryByText('empty1@cam.hs.kr')).toBeNull();
    expect(screen.queryByText('empty2@cam.hs.kr')).toBeNull();
    expect(screen.getByTestId('groups-pagination-info').textContent).toBe('1–2 of 2');
  });

  it('merges KPI filter with search query filtering', () => {
    const mockGroups = [
      {
        email: 'empty-target@cam.hs.kr',
        name: '타겟 빈그룹',
        description: '매칭 설명',
        aliases: [],
        directMembersCount: 0,
      },
      {
        email: 'empty-other@cam.hs.kr',
        name: '다른 빈그룹',
        description: '기타 설명',
        aliases: [],
        directMembersCount: 0,
      },
      {
        email: 'with-members@cam.hs.kr',
        name: '타겟 유멤버',
        description: '매칭 설명',
        aliases: [],
        directMembersCount: 5,
      },
      {
        email: 'other-with-members@cam.hs.kr',
        name: '다른 유멤버',
        description: '기타 설명',
        aliases: [],
        directMembersCount: 10,
      },
    ];

    mockUseGroupsList.mockReturnValue({
      data: { groups: mockGroups },
      isLoading: false,
      isError: false,
      error: null,
    });

    renderWithRouter(<GroupsTable />, ['/admin/groups?filter=empty']);

    expect(screen.getByText('empty-target@cam.hs.kr')).toBeDefined();
    expect(screen.getByText('empty-other@cam.hs.kr')).toBeDefined();
    expect(screen.queryByText('with-members@cam.hs.kr')).toBeNull();
    expect(screen.queryByText('other-with-members@cam.hs.kr')).toBeNull();
    expect(screen.getByTestId('groups-pagination-info').textContent).toBe('1–2 of 2');

    const searchInput = screen.getByTestId('groups-search-input');
    fireEvent.change(searchInput, { target: { value: '타겟' } });

    expect(screen.getByText('empty-target@cam.hs.kr')).toBeDefined();
    expect(screen.queryByText('empty-other@cam.hs.kr')).toBeNull();
    expect(screen.queryByText('with-members@cam.hs.kr')).toBeNull();
    expect(screen.queryByText('other-with-members@cam.hs.kr')).toBeNull();
    expect(screen.getByTestId('groups-pagination-info').textContent).toBe('1–1 of 1');
  });

  it('renders export CSV button, enabled when groups exist and disabled when empty', () => {
    const mockGroups = [
      {
        email: 'teachers@cam.hs.kr',
        name: '교사 그룹',
        description: '교사 전체',
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

    const exportBtn = screen.getByTestId('groups-export-csv-btn') as HTMLButtonElement;
    expect(exportBtn).toBeDefined();
    expect(exportBtn.disabled).toBe(false);
    expect(exportBtn.textContent).toContain('CSV 내보내기');

    const searchInput = screen.getByTestId('groups-search-input');
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

    expect(exportBtn.disabled).toBe(true);
  });

  // v0.157: JSON 내보내기 (v0.152 AccountsTable JSON 대칭).
  describe('v0.157 JSON 내보내기', () => {
    beforeEach(() => {
      URL.createObjectURL = vi.fn(() => 'blob:mock');
      URL.revokeObjectURL = vi.fn();
    });

    const mockGroups = [
      {
        id: 'g1',
        email: 'group-a@cam.hs.kr',
        name: '그룹 A',
        description: '설명 A',
        aliases: ['alias-a'],
        directMembersCount: 5,
      },
      {
        id: 'g2',
        email: 'group-b@cam.hs.kr',
        name: '그룹 B',
        description: '',
        aliases: [],
        directMembersCount: 0,
      },
    ];

    it('JSON 버튼 표시 · 데이터 있으면 enabled · 필터 결과 0 이면 disabled', () => {
      mockUseGroupsList.mockReturnValue({
        data: { groups: mockGroups },
        isLoading: false,
        isError: false,
        error: null,
      });
      renderWithRouter(<GroupsTable />);
      const btn = screen.getByTestId('groups-export-json-btn') as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
      expect(btn.textContent).toContain('JSON 내보내기');

      fireEvent.change(screen.getByTestId('groups-search-input'), {
        target: { value: 'zzz-nomatch' },
      });
      expect(btn.disabled).toBe(true);
    });

    it('JSON 클릭 시 download 트리거 · 파일명 groups-YYYY-MM-DD.json', () => {
      mockUseGroupsList.mockReturnValue({
        data: { groups: mockGroups },
        isLoading: false,
        isError: false,
        error: null,
      });

      const clicks: Array<{ download: string }> = [];
      const originalCreateElement = document.createElement.bind(document);
      const spy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const el = originalCreateElement(tag);
        if (tag === 'a') {
          (el as HTMLAnchorElement).click = () =>
            clicks.push({ download: (el as HTMLAnchorElement).download });
        }
        return el;
      });

      renderWithRouter(<GroupsTable />);
      fireEvent.click(screen.getByTestId('groups-export-json-btn'));
      expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
      expect(clicks[0].download).toMatch(/^groups-\d{4}-\d{2}-\d{2}\.json$/);
      spy.mockRestore();
    });

    it('JSON payload 는 exportedAt · filters · totalCount · groups 배열 포함', async () => {
      mockUseGroupsList.mockReturnValue({
        data: { groups: mockGroups },
        isLoading: false,
        isError: false,
        error: null,
      });

      let blobText = '';
      const originalCreate = URL.createObjectURL;
      URL.createObjectURL = vi.fn((blob: Blob) => {
        blob.text().then((t) => {
          blobText = t;
        });
        return 'blob:mock';
      });
      const originalCreateElement = document.createElement.bind(document);
      const spy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const el = originalCreateElement(tag);
        if (tag === 'a') {
          (el as HTMLAnchorElement).click = () => {};
        }
        return el;
      });

      renderWithRouter(<GroupsTable />, ['/admin/groups?q=A&filter=with-members&sort=name&dir=asc']);
      fireEvent.click(screen.getByTestId('groups-export-json-btn'));
      await Promise.resolve();
      await Promise.resolve();

      const parsed = JSON.parse(blobText);
      expect(parsed.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(parsed.filters).toEqual({
        q: 'A',
        filter: 'with-members',
        sort: 'name',
        dir: 'asc',
      });
      expect(parsed.totalCount).toBe(1);
      expect(parsed.groups[0]).toMatchObject({
        email: 'group-a@cam.hs.kr',
        name: '그룹 A',
        description: '설명 A',
        directMembersCount: 5,
        aliases: ['alias-a'],
      });

      spy.mockRestore();
      URL.createObjectURL = originalCreate;
    });
  });

  // v0.127: 「필터 초기화」 버튼 — v0.125 AccountsTable 대칭.
  describe('v0.127 clear filters button', () => {
    const mockGroups = [
      { id: 'g1', email: 'group-a@cam.hs.kr', name: '그룹 A', description: '', directMembersCount: 3 },
      { id: 'g2', email: 'group-b@cam.hs.kr', name: '그룹 B', description: '', directMembersCount: 0 },
    ];
    beforeEach(() => {
      mockUseGroupsList.mockReturnValue({
        data: { groups: mockGroups },
        isLoading: false,
        isError: false,
        error: null,
      });
    });

    it('v0.127: 필터 없으면 disabled', () => {
      renderWithRouter(<GroupsTable />);
      const btn = screen.getByTestId('groups-clear-filters-btn') as HTMLButtonElement;
      expect(btn).toBeDefined();
      expect(btn.disabled).toBe(true);
    });

    it('v0.127: q 있으면 enabled', () => {
      renderWithRouter(<GroupsTable />, ['/admin/groups?q=A']);
      const btn = screen.getByTestId('groups-clear-filters-btn') as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
    });

    it('v0.127: filter=empty 있으면 enabled', () => {
      renderWithRouter(<GroupsTable />, ['/admin/groups?filter=empty']);
      const btn = screen.getByTestId('groups-clear-filters-btn') as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
    });

    it('v0.127: filter=with-members 있으면 enabled', () => {
      renderWithRouter(<GroupsTable />, ['/admin/groups?filter=with-members']);
      const btn = screen.getByTestId('groups-clear-filters-btn') as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
    });

    it('v0.127: sort=name 있으면 enabled', () => {
      renderWithRouter(<GroupsTable />, ['/admin/groups?sort=name']);
      const btn = screen.getByTestId('groups-clear-filters-btn') as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
    });

    // 경계: 정규화 대칭 (v0.125b F101 패턴).
    it('v0.127: 공백-only q 는 disabled', () => {
      renderWithRouter(<GroupsTable />, ['/admin/groups?q=%20%20']);
      const btn = screen.getByTestId('groups-clear-filters-btn') as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });

    // v0.127b F105: allowlist 밖 filter 는 fail-open — 실제 목록 필터가 적용
    // 되지 않아 두 그룹 모두 렌더, 초기화 버튼도 disabled (효과 없는 값).
    it('v0.127b F105: allowlist 밖 filter (weird) 는 fail-open · 목록 유지 · 버튼 disabled', () => {
      renderWithRouter(<GroupsTable />, ['/admin/groups?filter=weird']);
      const btn = screen.getByTestId('groups-clear-filters-btn') as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
      // DOM: 두 그룹 모두 노출 (fail-open 확인).
      expect(screen.getByText('그룹 A')).toBeDefined();
      expect(screen.getByText('그룹 B')).toBeDefined();
    });

    it('v0.127: dir 단독 (sort 없음) 은 disabled', () => {
      renderWithRouter(<GroupsTable />, ['/admin/groups?dir=desc']);
      const btn = screen.getByTestId('groups-clear-filters-btn') as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });

    // v0.138: allowlist 밖 sort 도 disabled (F101 대칭).
    it('v0.138: allowlist 밖 sort (weird) 는 disabled (sortColumn=null 로 normalize)', () => {
      renderWithRouter(<GroupsTable />, ['/admin/groups?sort=weird']);
      const btn = screen.getByTestId('groups-clear-filters-btn') as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });

    // v0.138: 정렬 헤더 키보드 접근성 (Codex v0.137 소프트 권고 반영).
    it('v0.138: 정렬 헤더는 Enter · Space 로도 트리거 · tabIndex=0 · focus ring class', () => {
      renderWithRouter(<GroupsTable />);
      const emailHeader = screen.getByTestId('groups-sort-email');
      expect(emailHeader.getAttribute('tabindex')).toBe('0');
      expect(emailHeader.className).toContain('focus-visible:ring');
      expect(emailHeader.getAttribute('aria-sort')).toBe('none');

      fireEvent.keyDown(emailHeader, { key: 'Enter' });
      expect(emailHeader.getAttribute('aria-sort')).toBe('ascending');

      fireEvent.keyDown(emailHeader, { key: ' ' });
      expect(emailHeader.getAttribute('aria-sort')).toBe('descending');

      fireEvent.keyDown(emailHeader, { key: 'a' });
      expect(emailHeader.getAttribute('aria-sort')).toBe('descending');
    });

    it('v0.127: 클릭 시 URL search 완전 비움 + 그룹 두 개 모두 복원', () => {
      let currentSearch: string | null = null;
      function LocationSpy() {
        const [sp] = useSearchParams();
        currentSearch = sp.toString();
        return null;
      }
      render(
        <MemoryRouter initialEntries={['/admin/groups?q=B&filter=empty&sort=name']}>
          <LocationSpy />
          <GroupsTable />
        </MemoryRouter>
      );
      // 필터 상태: q=B → group-b, filter=empty → member 0 인 것만.
      expect(screen.queryByText('그룹 A')).toBeNull();
      expect(screen.getByText('그룹 B')).toBeDefined();
      expect(currentSearch).toContain('q=');

      fireEvent.click(screen.getByTestId('groups-clear-filters-btn'));
      expect(currentSearch).toBe('');
      expect(screen.getByText('그룹 A')).toBeDefined();
      expect(screen.getByText('그룹 B')).toBeDefined();
      const btn = screen.getByTestId('groups-clear-filters-btn') as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });
  });

  // v0.161: 정렬 선호 localStorage 저장 (v0.160 AccountsTable 대칭).
  describe('v0.161 정렬 선호 localStorage 저장', () => {
    const mockGroups = [
      { email: 'a@cam.hs.kr', name: '그룹 A', description: '', directMembersCount: '2', aliases: [] },
      { email: 'b@cam.hs.kr', name: '그룹 B', description: '', directMembersCount: '5', aliases: [] },
    ];

    beforeEach(() => {
      mockUseGroupsList.mockReturnValue({
        data: { groups: mockGroups },
        isLoading: false,
        isError: false,
        error: null,
      });
    });

    it('URL 에 sort 없으면 localStorage 저장값을 URL 로 hydrate', async () => {
      localStorage.setItem(
        'groupsTable.sort.v1',
        JSON.stringify({ sort: 'name', dir: 'desc' }),
      );
      renderWithRouter(<GroupsTable />, ['/admin/groups']);
      await waitFor(() => {
        const nameTh = screen.getByRole('columnheader', { name: /이름/ });
        expect(nameTh.getAttribute('aria-sort')).toBe('descending');
      });
    });

    it('URL 에 sort 있으면 localStorage 값 무시 (URL authoritative)', () => {
      localStorage.setItem(
        'groupsTable.sort.v1',
        JSON.stringify({ sort: 'name', dir: 'desc' }),
      );
      renderWithRouter(<GroupsTable />, ['/admin/groups?sort=email&dir=asc']);
      const emailTh = screen.getByRole('columnheader', { name: /이메일/ });
      expect(emailTh.getAttribute('aria-sort')).toBe('ascending');
      const nameTh = screen.getByRole('columnheader', { name: /이름/ });
      expect(nameTh.getAttribute('aria-sort')).toBe('none');
    });

    it('정렬 헤더 클릭 시 localStorage 에 저장', async () => {
      renderWithRouter(<GroupsTable />, ['/admin/groups']);
      const nameTh = screen.getByRole('columnheader', { name: /이름/ });
      fireEvent.click(nameTh);
      await waitFor(() => {
        const raw = localStorage.getItem('groupsTable.sort.v1');
        expect(raw).not.toBeNull();
        const parsed = JSON.parse(raw!);
        expect(parsed).toEqual({ sort: 'name', dir: 'asc' });
      });
    });

    it('「필터 초기화」 후 localStorage 도 제거', async () => {
      renderWithRouter(<GroupsTable />, ['/admin/groups?sort=name&dir=desc']);
      await waitFor(() => {
        expect(localStorage.getItem('groupsTable.sort.v1')).not.toBeNull();
      });
      fireEvent.click(screen.getByTestId('groups-clear-filters-btn'));
      await waitFor(() => {
        expect(localStorage.getItem('groupsTable.sort.v1')).toBeNull();
      });
    });

    it('localStorage 손상값은 무시', () => {
      localStorage.setItem('groupsTable.sort.v1', 'not-json{{');
      renderWithRouter(<GroupsTable />, ['/admin/groups']);
      const nameTh = screen.getByRole('columnheader', { name: /이름/ });
      expect(nameTh.getAttribute('aria-sort')).toBe('none');
    });
  });

  // v0.165: bulk selection + bulk delete UI (AccountsTable v0.155 대칭).
  describe('v0.165 bulk selection + bulk delete', () => {
    const mockGroups = [
      { email: 'a@cam.hs.kr', name: '그룹 A', description: '', directMembersCount: '2', aliases: [] },
      { email: 'b@cam.hs.kr', name: '그룹 B', description: '', directMembersCount: '5', aliases: [] },
      { email: 'c@cam.hs.kr', name: '그룹 C', description: '', directMembersCount: '0', aliases: [] },
    ];

    beforeEach(() => {
      mockUseGroupsList.mockReturnValue({
        data: { groups: mockGroups },
        isLoading: false,
        isError: false,
        error: null,
      });
    });

    it('기본 상태 = bulk actions bar 미노출', () => {
      renderWithRouter(<GroupsTable />);
      expect(screen.queryByTestId('groups-bulk-actions')).toBeNull();
    });

    it('row 체크박스 클릭 시 bulk actions bar 노출 · count 반영', () => {
      renderWithRouter(<GroupsTable />);
      fireEvent.click(screen.getByTestId('groups-bulk-check-a@cam.hs.kr'));
      expect(screen.getByTestId('groups-bulk-actions').textContent).toContain('1');
      fireEvent.click(screen.getByTestId('groups-bulk-check-b@cam.hs.kr'));
      expect(screen.getByTestId('groups-bulk-actions').textContent).toContain('2');
    });

    it('전체 선택 헤더 체크박스 → 모든 필터 결과 선택', () => {
      renderWithRouter(<GroupsTable />);
      const headerCb = screen.getByTestId('groups-bulk-check-all') as HTMLInputElement;
      fireEvent.click(headerCb);
      expect(screen.getByTestId('groups-bulk-actions').textContent).toContain('3');
    });

    it('일부 선택 시 헤더 checkbox indeterminate', () => {
      renderWithRouter(<GroupsTable />);
      fireEvent.click(screen.getByTestId('groups-bulk-check-a@cam.hs.kr'));
      const headerCb = screen.getByTestId('groups-bulk-check-all') as HTMLInputElement;
      expect(headerCb.indeterminate).toBe(true);
      expect(headerCb.checked).toBe(false);
    });

    it('「선택 해제」 클릭 시 selection reset', () => {
      renderWithRouter(<GroupsTable />);
      fireEvent.click(screen.getByTestId('groups-bulk-check-a@cam.hs.kr'));
      expect(screen.getByTestId('groups-bulk-actions')).toBeDefined();
      fireEvent.click(screen.getByTestId('groups-bulk-clear-btn'));
      expect(screen.queryByTestId('groups-bulk-actions')).toBeNull();
    });

    it('검색 변경 시 selection reset (bulk 필터 밖 실행 방지)', () => {
      renderWithRouter(<GroupsTable />);
      fireEvent.click(screen.getByTestId('groups-bulk-check-a@cam.hs.kr'));
      expect(screen.getByTestId('groups-bulk-actions')).toBeDefined();
      fireEvent.change(screen.getByTestId('groups-search-input'), {
        target: { value: '그룹' },
      });
      expect(screen.queryByTestId('groups-bulk-actions')).toBeNull();
    });
  });
});


