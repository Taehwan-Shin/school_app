import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

function renderWithRouter(
  node: React.ReactElement,
  initialEntries: string[] = ['/admin/classrooms'],
) {
  return render(<MemoryRouter initialEntries={initialEntries}>{node}</MemoryRouter>);
}

// v0.137 회귀용: 현재 URL search 를 관찰.
function LocationSpy({ onChange }: { onChange: (search: string) => void }) {
  const loc = useLocation();
  React.useEffect(() => {
    onChange(loc.search);
  }, [loc.search, onChange]);
  return null;
}

const mockUseClassroomList = vi.fn();

vi.mock('../src/api/classroomList', () => ({
  useClassroomList: () => mockUseClassroomList(),
}));

vi.mock('../src/api/classroomPatch', () => ({
  useClassroomPatch: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
  }),
}));

vi.mock('../src/api/classroomCreate', () => ({
  useClassroomCreate: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
    reset: vi.fn(),
  }),
}));

vi.mock('../src/api/classroomDelete', () => ({
  useClassroomDelete: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
  }),
}));

vi.mock('../src/api/classroomTeachersList', () => ({
  useClassroomTeachersList: () => ({
    data: { teachers: [] },
    isLoading: false,
    isError: false,
    error: null,
  }),
}));

vi.mock('../src/api/classroomStudentsList', () => ({
  useClassroomStudentsList: () => ({
    data: { students: [] },
    isLoading: false,
    isError: false,
    error: null,
  }),
}));

vi.mock('../src/api/classroomTeachersAdd', () => ({
  useClassroomTeachersAdd: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
  }),
}));

vi.mock('../src/api/classroomTeachersDelete', () => ({
  useClassroomTeachersDelete: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
  }),
}));

vi.mock('../src/api/classroomStudentsAdd', () => ({
  useClassroomStudentsAdd: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
  }),
}));

vi.mock('../src/api/classroomStudentsDelete', () => ({
  useClassroomStudentsDelete: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
  }),
}));

vi.mock('../src/api/basicDataGet', () => ({
  useBasicDataGet: () => ({
    data: { data: { year: 2026, grades: [], rosters: {} } },
    isLoading: false,
    isError: false,
    error: null,
  }),
}));

import { ClassroomTable, translateCourseState } from '../src/routes/admin/ClassroomTable';

describe('ClassroomTable component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('scenario 1: renders loading indicator when isLoading is true', () => {
    mockUseClassroomList.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    });

    renderWithRouter(<ClassroomTable />);
    expect(screen.getByTestId('classroom-list-loading')).toBeDefined();
    expect(screen.getByText('클래스룸 코스 목록을 불러오는 중...')).toBeDefined();
  });

  it('scenario 2: renders error message when request fails', () => {
    mockUseClassroomList.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('network_failure'),
    });

    renderWithRouter(<ClassroomTable />);
    expect(screen.getByTestId('classroom-list-error')).toBeDefined();
    expect(
      screen.getByText('클래스룸 코스 목록을 불러오지 못했습니다: network_failure'),
    ).toBeDefined();
  });

  it('scenario 3: renders empty message when courses list is empty', () => {
    mockUseClassroomList.mockReturnValue({
      data: { courses: [] },
      isLoading: false,
      isError: false,
      error: null,
    });

    renderWithRouter(<ClassroomTable />);
    expect(screen.getByTestId('classroom-list-empty')).toBeDefined();
    expect(screen.getByText('표시할 클래스룸 코스가 없습니다.')).toBeDefined();
  });

  it('scenario 4: renders 3 course rows with state translations and links', () => {
    const mockCourses = [
      {
        id: 'c-101',
        name: '1학년 1반 수학',
        section: '1학기',
        courseState: 'ACTIVE',
        alternateLink: 'https://classroom.google.com/c/c-101',
      },
      {
        id: 'c-102',
        name: '1학년 2반 영어',
        section: '1학기',
        courseState: 'ARCHIVED',
        alternateLink: 'https://classroom.google.com/c/c-102',
      },
      {
        id: 'c-103',
        name: '2학년 1반 과학',
        section: '2학기',
        courseState: 'PROVISIONED',
        alternateLink: 'https://classroom.google.com/c/c-103',
      },
    ];

    mockUseClassroomList.mockReturnValue({
      data: { courses: mockCourses },
      isLoading: false,
      isError: false,
      error: null,
    });

    renderWithRouter(<ClassroomTable />);

    expect(screen.getByText('3개 코스')).toBeDefined();

    expect(screen.getByTestId('classroom-row-c-101')).toBeDefined();
    expect(screen.getByTestId('classroom-row-c-102')).toBeDefined();
    expect(screen.getByTestId('classroom-row-c-103')).toBeDefined();

    expect(screen.getByText('1학년 1반 수학')).toBeDefined();
    expect(screen.getByText('1학년 2반 영어')).toBeDefined();
    expect(screen.getByText('2학년 1반 과학')).toBeDefined();

    // 상태 번역 검증
    expect(screen.getByText('활성')).toBeDefined();
    expect(screen.getByText('보관됨')).toBeDefined();
    expect(screen.getByText('준비 중')).toBeDefined();

    // 링크 검증
    const link1 = screen.getByTestId('classroom-link-c-101');
    expect(link1.getAttribute('href')).toBe('https://classroom.google.com/c/c-101');
    expect(link1.getAttribute('target')).toBe('_blank');

    const link2 = screen.getByTestId('classroom-link-c-102');
    expect(link2.getAttribute('href')).toBe('https://classroom.google.com/c/c-102');

    const link3 = screen.getByTestId('classroom-link-c-103');
    expect(link3.getAttribute('href')).toBe('https://classroom.google.com/c/c-103');

    // 관리 컬럼 및 버튼 검증
    expect(screen.getByText('관리')).toBeDefined();

    // ACTIVE: 아카이브 버튼 있음
    const archiveBtn1 = screen.getByTestId('classroom-archive-btn-c-101');
    expect(archiveBtn1.textContent).toBe('아카이브');

    // ARCHIVED: 복구 버튼 있음
    const archiveBtn2 = screen.getByTestId('classroom-archive-btn-c-102');
    expect(archiveBtn2.textContent).toBe('복구');

    // PROVISIONED: 아카이브/복구 버튼 없음
    expect(screen.queryByTestId('classroom-archive-btn-c-103')).toBeNull();

    // 모든 행에 상세 링크 있음 (이름 → /admin/classrooms/:id)
    const detailLink1 = screen.getByTestId('classroom-detail-link-c-101');
    expect(detailLink1.getAttribute('href')).toBe('/admin/classrooms/c-101');
    expect(screen.getByTestId('classroom-detail-link-c-102')).toBeDefined();
    expect(screen.getByTestId('classroom-detail-link-c-103')).toBeDefined();

    // 「멤버」 다이얼로그 버튼은 상세 페이지 이관 이후 제거됨
    expect(screen.queryByTestId('classroom-members-btn-c-101')).toBeNull();

    // 모든 행에 삭제 버튼 있음
    expect(screen.getByTestId('classroom-delete-btn-c-101')).toBeDefined();
    expect(screen.getByTestId('classroom-delete-btn-c-102')).toBeDefined();
    expect(screen.getByTestId('classroom-delete-btn-c-103')).toBeDefined();
  });

  it('scenario 5: 이름 링크는 상세 페이지로 이동하고 아카이브·삭제 다이얼로그가 열린다', () => {
    const mockCourses = [
      {
        id: 'c-101',
        name: '1학년 1반 수학',
        section: '1학기',
        courseState: 'ACTIVE',
      },
    ];

    mockUseClassroomList.mockReturnValue({
      data: { courses: mockCourses },
      isLoading: false,
      isError: false,
      error: null,
    });

    renderWithRouter(<ClassroomTable />);

    // 이름 클릭 = 상세 페이지 링크 (dialog 아님)
    const detailLink = screen.getByTestId('classroom-detail-link-c-101');
    expect(detailLink.getAttribute('href')).toBe('/admin/classrooms/c-101');

    // 아카이브 버튼 클릭 시 다이얼로그 표시
    const archiveBtn = screen.getByTestId('classroom-archive-btn-c-101');
    fireEvent.click(archiveBtn);
    expect(screen.getByText('코스 아카이브 확인')).toBeDefined();

    // 취소 클릭으로 닫기
    fireEvent.click(screen.getByText('취소'));

    // 삭제 버튼 클릭 시 다이얼로그 표시
    const deleteBtn = screen.getByTestId('classroom-delete-btn-c-101');
    fireEvent.click(deleteBtn);
    expect(screen.getByText('클래스룸 코스 삭제 확인')).toBeDefined();
  });

  it('translates course states correctly', () => {
    expect(translateCourseState('ACTIVE')).toBe('활성');
    expect(translateCourseState('ARCHIVED')).toBe('보관됨');
    expect(translateCourseState('PROVISIONED')).toBe('준비 중');
    expect(translateCourseState('DECLINED')).toBe('거절됨');
    expect(translateCourseState('SUSPENDED')).toBe('일시중지');
    expect(translateCourseState('UNKNOWN')).toBe('UNKNOWN');
    expect(translateCourseState(undefined)).toBe('-');
  });

  it('renders "+ 코스 추가" button and opens CreateClassroomDialog when clicked', () => {
    mockUseClassroomList.mockReturnValue({
      data: { courses: [] },
      isLoading: false,
      isError: false,
      error: null,
    });

    renderWithRouter(<ClassroomTable />);
    const createBtn = screen.getByTestId('classroom-create-btn');
    expect(createBtn).toBeDefined();
    expect(createBtn.textContent).toContain('코스 추가');

    expect(screen.queryByTestId('create-classroom-form')).toBeNull();
    fireEvent.click(createBtn);
    expect(screen.getByTestId('create-classroom-form')).toBeDefined();
    expect(screen.getByText('새 클래스룸 코스 생성')).toBeDefined();
  });

  it('renders "학년/반 일괄 생성" button', () => {
    mockUseClassroomList.mockReturnValue({
      data: { courses: [] },
      isLoading: false,
      isError: false,
      error: null,
    });

    renderWithRouter(<ClassroomTable />);
    const batchBtn = screen.getByTestId('classroom-batch-create-btn');
    expect(batchBtn).toBeDefined();
    expect(batchBtn.textContent).toContain('학년/반 일괄 생성');
  });

  it('opens CourseBulkCreateDialog when "학년/반 일괄 생성" button is clicked', () => {
    mockUseClassroomList.mockReturnValue({
      data: { courses: [] },
      isLoading: false,
      isError: false,
      error: null,
    });

    renderWithRouter(<ClassroomTable />);
    const batchBtn = screen.getByTestId('classroom-batch-create-btn');
    expect(screen.queryByTestId('bulk-create-year-input')).toBeNull();

    fireEvent.click(batchBtn);
    expect(screen.getByTestId('bulk-create-year-input')).toBeDefined();
    expect(screen.getByText('학년/반 코스 일괄 생성')).toBeDefined();
  });

  // v0.134b F118: 이름 변경은 ACTIVE 만 대상. ARCHIVED 를 선택해도 count 반영 안 됨.
  it('일괄 이름 변경 버튼은 ACTIVE 선택 수만 반영 (ARCHIVED 제외)', () => {
    const mockCourses = [
      { id: 'c-101', name: 'A', courseState: 'ACTIVE' },
      { id: 'c-102', name: 'B', courseState: 'ARCHIVED' },
    ];
    mockUseClassroomList.mockReturnValue({
      data: { courses: mockCourses },
      isLoading: false,
      isError: false,
      error: null,
    });

    renderWithRouter(<ClassroomTable />);
    fireEvent.click(screen.getByTestId('classroom-select-c-101'));
    fireEvent.click(screen.getByTestId('classroom-select-c-102'));

    const renameBtn = screen.getByTestId('classroom-bulk-rename-btn');
    // count 는 ACTIVE 1 만.
    expect(renameBtn.textContent).toContain('(1)');
    expect((renameBtn as HTMLButtonElement).disabled).toBe(false);
  });

  // v0.134b F118: 선택이 모두 ARCHIVED 면 disabled.
  it('일괄 이름 변경 버튼은 ARCHIVED 만 선택되면 disabled', () => {
    const mockCourses = [
      { id: 'c-101', name: 'A', courseState: 'ARCHIVED' },
    ];
    mockUseClassroomList.mockReturnValue({
      data: { courses: mockCourses },
      isLoading: false,
      isError: false,
      error: null,
    });

    renderWithRouter(<ClassroomTable />);
    fireEvent.click(screen.getByTestId('classroom-select-c-101'));

    const renameBtn = screen.getByTestId('classroom-bulk-rename-btn') as HTMLButtonElement;
    expect(renameBtn.disabled).toBe(true);
    expect(renameBtn.textContent).toContain('(0)');
  });

  // v0.137: 검색 · KPI 필터 · 정렬 · 「필터 초기화」 (AccountsTable v0.125 · GroupsTable v0.127 대칭).
  describe('v0.137 검색 · 필터 · 정렬', () => {
    const mockCourses = [
      { id: 'c-101', name: '1학년 1반 수학', section: '1학기', courseState: 'ACTIVE' },
      { id: 'c-102', name: '1학년 2반 영어', section: '1학기', courseState: 'ARCHIVED' },
      { id: 'c-103', name: '2학년 1반 과학', section: '2학기', courseState: 'ACTIVE' },
      { id: 'c-104', name: '3학년 3반 국어', section: '2학기', courseState: 'PROVISIONED' },
    ];

    beforeEach(() => {
      mockUseClassroomList.mockReturnValue({
        data: { courses: mockCourses },
        isLoading: false,
        isError: false,
        error: null,
      });
    });

    it('검색 input 은 이름 · 섹션 · id 에서 부분 일치 (case-insensitive)', () => {
      renderWithRouter(<ClassroomTable />);
      const input = screen.getByTestId('classroom-search-input') as HTMLInputElement;

      // 이름 일치
      fireEvent.change(input, { target: { value: '수학' } });
      expect(screen.getByTestId('classroom-row-c-101')).toBeDefined();
      expect(screen.queryByTestId('classroom-row-c-102')).toBeNull();

      // 섹션 일치
      fireEvent.change(input, { target: { value: '2학기' } });
      expect(screen.queryByTestId('classroom-row-c-101')).toBeNull();
      expect(screen.getByTestId('classroom-row-c-103')).toBeDefined();
      expect(screen.getByTestId('classroom-row-c-104')).toBeDefined();

      // id 일치 (case-insensitive)
      fireEvent.change(input, { target: { value: 'C-102' } });
      expect(screen.getByTestId('classroom-row-c-102')).toBeDefined();
      expect(screen.queryByTestId('classroom-row-c-101')).toBeNull();

      // 미일치 → 검색 결과 없음
      fireEvent.change(input, { target: { value: 'nothing-match' } });
      expect(screen.getByTestId('classroom-search-empty')).toBeDefined();
    });

    it('KPI 필터 chips: 활성 · 보관됨 은 courseState 기준으로 필터', () => {
      renderWithRouter(<ClassroomTable />);

      // 초기 전체 = 모두 표시
      expect(screen.getByTestId('classroom-row-c-101')).toBeDefined();
      expect(screen.getByTestId('classroom-row-c-102')).toBeDefined();
      expect(screen.getByTestId('classroom-row-c-104')).toBeDefined();
      expect(screen.getByTestId('classroom-kpi-all').getAttribute('aria-pressed')).toBe('true');

      // 활성 → ACTIVE 만
      fireEvent.click(screen.getByTestId('classroom-kpi-active'));
      expect(screen.getByTestId('classroom-row-c-101')).toBeDefined();
      expect(screen.getByTestId('classroom-row-c-103')).toBeDefined();
      expect(screen.queryByTestId('classroom-row-c-102')).toBeNull();
      expect(screen.queryByTestId('classroom-row-c-104')).toBeNull();
      expect(screen.getByTestId('classroom-kpi-active').getAttribute('aria-pressed')).toBe('true');

      // 보관됨 → ARCHIVED 만
      fireEvent.click(screen.getByTestId('classroom-kpi-archived'));
      expect(screen.getByTestId('classroom-row-c-102')).toBeDefined();
      expect(screen.queryByTestId('classroom-row-c-101')).toBeNull();
      expect(screen.queryByTestId('classroom-row-c-104')).toBeNull();

      // 다시 전체 → 모두
      fireEvent.click(screen.getByTestId('classroom-kpi-all'));
      expect(screen.getByTestId('classroom-row-c-104')).toBeDefined();
    });

    it('정렬: 컬럼 헤더 클릭으로 asc → desc 토글 · aria-sort 반영 · 실제 행 순서 변경', () => {
      renderWithRouter(<ClassroomTable />);

      const nameHeader = screen.getByTestId('classroom-sort-name');
      expect(nameHeader.getAttribute('aria-sort')).toBe('none');

      // 첫 클릭 → asc. 이름 「1학년 1반...」 < 「1학년 2반...」 < 「2학년...」 < 「3학년...」
      fireEvent.click(nameHeader);
      expect(nameHeader.getAttribute('aria-sort')).toBe('ascending');
      const rowsAsc = Array.from(document.querySelectorAll('[data-testid^="classroom-row-"]'));
      const idsAsc = rowsAsc.map((r) => r.getAttribute('data-testid'));
      expect(idsAsc).toEqual([
        'classroom-row-c-101',
        'classroom-row-c-102',
        'classroom-row-c-103',
        'classroom-row-c-104',
      ]);

      // 두 번째 클릭 → desc. 역순.
      fireEvent.click(nameHeader);
      expect(nameHeader.getAttribute('aria-sort')).toBe('descending');
      const rowsDesc = Array.from(document.querySelectorAll('[data-testid^="classroom-row-"]'));
      const idsDesc = rowsDesc.map((r) => r.getAttribute('data-testid'));
      expect(idsDesc).toEqual([
        'classroom-row-c-104',
        'classroom-row-c-103',
        'classroom-row-c-102',
        'classroom-row-c-101',
      ]);

      // 다른 컬럼 클릭 → 원본 컬럼 none, 새 컬럼 asc.
      // state asc: ACTIVE(c-101, c-103) < ARCHIVED(c-102) < PROVISIONED(c-104)
      const stateHeader = screen.getByTestId('classroom-sort-state');
      fireEvent.click(stateHeader);
      expect(nameHeader.getAttribute('aria-sort')).toBe('none');
      expect(stateHeader.getAttribute('aria-sort')).toBe('ascending');
      const rowsState = Array.from(document.querySelectorAll('[data-testid^="classroom-row-"]'));
      const idsState = rowsState.map((r) => r.getAttribute('data-testid'));
      // ACTIVE 두 개는 안정 정렬 (원본 순서: c-101, c-103) 이후 ARCHIVED, PROVISIONED.
      expect(idsState[0]).toBe('classroom-row-c-101');
      expect(idsState[1]).toBe('classroom-row-c-103');
      expect(idsState[2]).toBe('classroom-row-c-102');
      expect(idsState[3]).toBe('classroom-row-c-104');
    });

    it('URL params 초기 로드: q · filter · sort · dir 복원', () => {
      renderWithRouter(
        <ClassroomTable />,
        ['/admin/classrooms?q=수학&filter=active&sort=name&dir=desc'],
      );

      const input = screen.getByTestId('classroom-search-input') as HTMLInputElement;
      expect(input.value).toBe('수학');

      expect(screen.getByTestId('classroom-kpi-active').getAttribute('aria-pressed')).toBe('true');

      const nameHeader = screen.getByTestId('classroom-sort-name');
      expect(nameHeader.getAttribute('aria-sort')).toBe('descending');

      // q=수학 + filter=active → c-101 만 (ACTIVE + 이름 「수학」 포함).
      expect(screen.getByTestId('classroom-row-c-101')).toBeDefined();
      expect(screen.queryByTestId('classroom-row-c-102')).toBeNull();
      expect(screen.queryByTestId('classroom-row-c-103')).toBeNull();
    });

    it('필터 초기화 버튼: q + filter + sort 있으면 활성 · 클릭 시 모든 URL param 원자적 clear', () => {
      let observedSearch = '';
      renderWithRouter(
        <>
          <ClassroomTable />
          <LocationSpy onChange={(s) => (observedSearch = s)} />
        </>,
        ['/admin/classrooms?q=수학&filter=active&sort=state&dir=desc'],
      );

      const clearBtn = screen.getByTestId('classroom-clear-filters-btn') as HTMLButtonElement;
      expect(clearBtn.disabled).toBe(false);

      fireEvent.click(clearBtn);

      expect(observedSearch).toBe('');
      const input = screen.getByTestId('classroom-search-input') as HTMLInputElement;
      expect(input.value).toBe('');
      expect(screen.getByTestId('classroom-kpi-all').getAttribute('aria-pressed')).toBe('true');
      expect(screen.getByTestId('classroom-sort-state').getAttribute('aria-sort')).toBe('none');
    });

    it('필터 초기화 버튼: 활성 필터 없으면 disabled', () => {
      renderWithRouter(<ClassroomTable />);
      const clearBtn = screen.getByTestId('classroom-clear-filters-btn') as HTMLButtonElement;
      expect(clearBtn.disabled).toBe(true);

      // 공백-only q 도 「미활성」 판정 (trim 정규화).
      const input = screen.getByTestId('classroom-search-input');
      fireEvent.change(input, { target: { value: '   ' } });
      expect(clearBtn.disabled).toBe(true);
    });

    // v0.127b F105 대칭: allowlist 밖 filter 는 fail-open (필터 미적용 · 목록 유지).
    it('unknown filter 값은 fail-open (필터 미적용) 이고 초기화 버튼도 disabled', () => {
      renderWithRouter(<ClassroomTable />, ['/admin/classrooms?filter=weird']);

      // 모든 코스가 여전히 보임.
      expect(screen.getByTestId('classroom-row-c-101')).toBeDefined();
      expect(screen.getByTestId('classroom-row-c-102')).toBeDefined();
      expect(screen.getByTestId('classroom-row-c-104')).toBeDefined();

      // 「전체」 chip 이 활성 상태.
      expect(screen.getByTestId('classroom-kpi-all').getAttribute('aria-pressed')).toBe('true');
      expect(screen.getByTestId('classroom-kpi-active').getAttribute('aria-pressed')).toBe('false');

      // 필터 초기화 버튼도 disabled (활성 필터로 판정 안 됨).
      const clearBtn = screen.getByTestId('classroom-clear-filters-btn') as HTMLButtonElement;
      expect(clearBtn.disabled).toBe(true);
    });

    it('선택 후 필터 변경: 필터 밖의 선택은 유지되고 bulk actions 는 여전히 selectedIds 기반', () => {
      renderWithRouter(<ClassroomTable />);

      // ACTIVE c-101 · ARCHIVED c-102 선택.
      fireEvent.click(screen.getByTestId('classroom-select-c-101'));
      fireEvent.click(screen.getByTestId('classroom-select-c-102'));

      // 「활성」 필터 켜기 → c-102 시야에서 사라지지만 bulk actions 는 여전히 2개 선택.
      fireEvent.click(screen.getByTestId('classroom-kpi-active'));
      expect(screen.queryByTestId('classroom-row-c-102')).toBeNull();

      const bulkActions = screen.getByTestId('classroom-bulk-actions');
      expect(bulkActions.textContent).toContain('2개 선택됨');
      expect(bulkActions.textContent).toContain('ACTIVE 1');
      expect(bulkActions.textContent).toContain('ARCHIVED 1');
    });

    it('전체 선택: 현재 필터 결과의 eligible (ACTIVE+ARCHIVED) 만 대상', () => {
      renderWithRouter(<ClassroomTable />);

      // 「활성」 필터 후 전체 선택 → c-101 · c-103 (ACTIVE 2개) 만 선택.
      fireEvent.click(screen.getByTestId('classroom-kpi-active'));
      const selectAll = screen.getByTestId('classroom-select-all') as HTMLInputElement;
      fireEvent.click(selectAll);

      const bulkActions = screen.getByTestId('classroom-bulk-actions');
      expect(bulkActions.textContent).toContain('2개 선택됨');
      expect(bulkActions.textContent).toContain('ACTIVE 2');
    });

    // v0.137b F121: indeterminate 는 selectedIds 전체 기준. 필터 밖 선택만
    // 남으면 「일부 선택」 상태로 보여야 사용자가 「선택 없음」 으로 오해하지 않음.
    it('필터 밖에만 선택이 남은 경우 「전체 선택」 checkbox 는 indeterminate', () => {
      renderWithRouter(<ClassroomTable />);

      // ARCHIVED c-102 만 선택.
      fireEvent.click(screen.getByTestId('classroom-select-c-102'));

      // 「활성」 필터 켜기 → 필터 결과에는 c-102 안 보임 (필터 밖 선택만 남음).
      fireEvent.click(screen.getByTestId('classroom-kpi-active'));
      expect(screen.queryByTestId('classroom-row-c-102')).toBeNull();

      // 전체 선택 checkbox 는 indeterminate 여야 함 (선택 존재 · 이 필터 eligible
      // (c-101, c-103) 은 미선택 상태).
      const selectAll = screen.getByTestId('classroom-select-all') as HTMLInputElement;
      expect(selectAll.checked).toBe(false);
      expect(selectAll.indeterminate).toBe(true);
    });

    // v0.137b F121: 전체 필터 eligible 이 모두 선택되면 checked=true, indeterminate=false.
    it('필터 결과 eligible 을 모두 선택하면 「전체 선택」 checkbox 는 checked · not indeterminate', () => {
      renderWithRouter(<ClassroomTable />);

      // 「활성」 필터 → 눈에 보이는 eligible = c-101, c-103.
      fireEvent.click(screen.getByTestId('classroom-kpi-active'));
      fireEvent.click(screen.getByTestId('classroom-select-c-101'));
      fireEvent.click(screen.getByTestId('classroom-select-c-103'));

      const selectAll = screen.getByTestId('classroom-select-all') as HTMLInputElement;
      expect(selectAll.checked).toBe(true);
      expect(selectAll.indeterminate).toBe(false);
    });

    // v0.137b F122: 결과 0 이어도 원본 courses 존재하면 pagination 렌더.
    it('필터 결과 0 이어도 원본 courses 있으면 pagination 은 렌더 · 이전/다음 모두 disabled', () => {
      renderWithRouter(<ClassroomTable />);

      const input = screen.getByTestId('classroom-search-input');
      fireEvent.change(input, { target: { value: 'zzzz-no-match' } });

      // 검색 결과 없음 배너.
      expect(screen.getByTestId('classroom-search-empty')).toBeDefined();

      // 페이지네이션은 여전히 렌더.
      expect(screen.getByTestId('classroom-pagination-info').textContent).toContain('결과 없음');
      const prev = screen.getByTestId('classroom-pagination-prev') as HTMLButtonElement;
      const next = screen.getByTestId('classroom-pagination-next') as HTMLButtonElement;
      expect(prev.disabled).toBe(true);
      expect(next.disabled).toBe(true);
    });

    // v0.137b F122 boundary: 정확히 PAGE_SIZE=25 · 26 개에서 next disabled 판정.
    it('페이지 boundary: 정확히 25개 → next disabled · 26개 → next enabled', () => {
      const make = (n: number) =>
        Array.from({ length: n }, (_, i) => ({
          id: `c-${String(i).padStart(3, '0')}`,
          name: `Course ${i}`,
          section: '',
          courseState: 'ACTIVE',
        }));

      // 25 개 → 한 페이지에 딱 맞음. next disabled.
      mockUseClassroomList.mockReturnValue({
        data: { courses: make(25) },
        isLoading: false,
        isError: false,
        error: null,
      });
      const { unmount } = renderWithRouter(<ClassroomTable />);
      expect((screen.getByTestId('classroom-pagination-next') as HTMLButtonElement).disabled).toBe(true);
      expect((screen.getByTestId('classroom-pagination-prev') as HTMLButtonElement).disabled).toBe(true);
      unmount();

      // 26 개 → 두 페이지. next enabled.
      mockUseClassroomList.mockReturnValue({
        data: { courses: make(26) },
        isLoading: false,
        isError: false,
        error: null,
      });
      renderWithRouter(<ClassroomTable />);
      expect((screen.getByTestId('classroom-pagination-next') as HTMLButtonElement).disabled).toBe(false);
      expect((screen.getByTestId('classroom-pagination-prev') as HTMLButtonElement).disabled).toBe(true);
    });

    it('페이지네이션: 25개 초과 시 페이지 분할 · 검색 시 페이지 0 리셋', () => {
      const many = Array.from({ length: 60 }, (_, i) => ({
        id: `c-${String(i).padStart(3, '0')}`,
        name: `Course ${i}`,
        section: '',
        courseState: 'ACTIVE',
      }));
      mockUseClassroomList.mockReturnValue({
        data: { courses: many },
        isLoading: false,
        isError: false,
        error: null,
      });

      renderWithRouter(<ClassroomTable />);

      // 초기 page 0 → 처음 25개만 렌더.
      expect(screen.getByTestId('classroom-row-c-000')).toBeDefined();
      expect(screen.getByTestId('classroom-row-c-024')).toBeDefined();
      expect(screen.queryByTestId('classroom-row-c-025')).toBeNull();

      // page info
      expect(screen.getByTestId('classroom-pagination-info').textContent).toContain('1–25');
      expect(screen.getByTestId('classroom-pagination-info').textContent).toContain('60');

      // 다음 페이지.
      fireEvent.click(screen.getByTestId('classroom-pagination-next'));
      expect(screen.queryByTestId('classroom-row-c-024')).toBeNull();
      expect(screen.getByTestId('classroom-row-c-025')).toBeDefined();
      expect(screen.getByTestId('classroom-row-c-049')).toBeDefined();

      // 검색 → 페이지 0 자동 리셋 (page 1 상태에서 검색 시).
      const input = screen.getByTestId('classroom-search-input');
      fireEvent.change(input, { target: { value: 'Course 0' } });
      // Course 0/1/2/.../9 등이 매치 (부분 일치).
      expect(screen.getByTestId('classroom-row-c-000')).toBeDefined();
    });
  });
});

