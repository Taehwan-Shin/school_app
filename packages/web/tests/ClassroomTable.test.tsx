import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

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

    render(<ClassroomTable />);
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

    render(<ClassroomTable />);
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

    render(<ClassroomTable />);
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

    render(<ClassroomTable />);

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

    // 모든 행에 멤버 버튼 있음
    expect(screen.getByTestId('classroom-members-btn-c-101')).toBeDefined();
    expect(screen.getByTestId('classroom-members-btn-c-102')).toBeDefined();
    expect(screen.getByTestId('classroom-members-btn-c-103')).toBeDefined();

    // 모든 행에 삭제 버튼 있음
    expect(screen.getByTestId('classroom-delete-btn-c-101')).toBeDefined();
    expect(screen.getByTestId('classroom-delete-btn-c-102')).toBeDefined();
    expect(screen.getByTestId('classroom-delete-btn-c-103')).toBeDefined();
  });

  it('scenario 5: opens CourseMembersDialog, ArchiveClassroomDialog and DeleteClassroomDialog on button clicks', () => {
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

    render(<ClassroomTable />);

    // 멤버 버튼 클릭 시 CourseMembersDialog 표시
    const membersBtn = screen.getByTestId('classroom-members-btn-c-101');
    fireEvent.click(membersBtn);
    expect(screen.getByText('1학년 1반 수학 멤버')).toBeDefined();

    // 닫기 클릭
    const closeBtns = screen.getAllByRole('button', { name: '닫기' });
    fireEvent.click(closeBtns[0]);

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

    render(<ClassroomTable />);
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

    render(<ClassroomTable />);
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

    render(<ClassroomTable />);
    const batchBtn = screen.getByTestId('classroom-batch-create-btn');
    expect(screen.queryByTestId('bulk-create-year-input')).toBeNull();

    fireEvent.click(batchBtn);
    expect(screen.getByTestId('bulk-create-year-input')).toBeDefined();
    expect(screen.getByText('학년/반 코스 일괄 생성')).toBeDefined();
  });
});

