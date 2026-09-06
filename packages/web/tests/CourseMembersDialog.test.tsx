import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const mockUseClassroomTeachersList = vi.fn();
const mockUseClassroomStudentsList = vi.fn();

vi.mock('../src/api/classroomTeachersList', () => ({
  useClassroomTeachersList: (courseId: string | null, open: boolean) =>
    mockUseClassroomTeachersList(courseId, open),
}));

vi.mock('../src/api/classroomStudentsList', () => ({
  useClassroomStudentsList: (courseId: string | null, open: boolean) =>
    mockUseClassroomStudentsList(courseId, open),
}));

import { CourseMembersDialog } from '../src/routes/admin/CourseMembersDialog';

describe('CourseMembersDialog component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 시나리오 1: open=false -> 미렌더
  it('scenario 1: does not render dialog content when open is false', () => {
    mockUseClassroomTeachersList.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
    });
    mockUseClassroomStudentsList.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
    });

    render(
      <CourseMembersDialog
        open={false}
        onOpenChange={vi.fn()}
        courseId="c-101"
        courseName="1학년 1반 수학"
      />,
    );

    expect(screen.queryByText('1학년 1반 수학 멤버')).toBeNull();
    expect(screen.queryByTestId('course-members-loading')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });

  // 시나리오 2: open=true + courseId null -> 로딩 상태
  it('scenario 2: renders loading state when open is true and courseId is null', () => {
    mockUseClassroomTeachersList.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
    });
    mockUseClassroomStudentsList.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
    });

    render(
      <CourseMembersDialog
        open={true}
        onOpenChange={vi.fn()}
        courseId={null}
      />,
    );

    expect(screen.getByTestId('course-members-loading')).toBeDefined();
    expect(screen.getByText('로딩 중...')).toBeDefined();
  });

  // 시나리오 3: open=true + courseId 있음 + 기본 탭 (교사) -> teachers mock 렌더
  it('scenario 3: renders teachers list on default teachers tab', () => {
    const mockTeachers = [
      {
        courseId: 'c-101',
        userId: 'teacher-1',
        profile: {
          name: { fullName: '김교사' },
          emailAddress: 'teacher1@cam.hs.kr',
        },
      },
      {
        courseId: 'c-101',
        userId: 'teacher-2',
        profile: {
          name: { fullName: '이교사' },
        },
      },
    ];

    mockUseClassroomTeachersList.mockReturnValue({
      data: { teachers: mockTeachers },
      isLoading: false,
      isError: false,
      error: null,
    });
    mockUseClassroomStudentsList.mockReturnValue({
      data: { students: [] },
      isLoading: false,
      isError: false,
      error: null,
    });

    render(
      <CourseMembersDialog
        open={true}
        onOpenChange={vi.fn()}
        courseId="c-101"
        courseName="1학년 1반 수학"
      />,
    );

    expect(screen.getByText('1학년 1반 수학 멤버')).toBeDefined();
    expect(screen.getByText('c-101')).toBeDefined();
    expect(screen.getByTestId('course-members-tab-teachers')).toBeDefined();
    expect(screen.getByTestId('course-members-tab-students')).toBeDefined();

    expect(screen.getByTestId('course-member-row-teacher-1')).toBeDefined();
    expect(screen.getByTestId('course-member-row-teacher-2')).toBeDefined();

    expect(screen.getByText('김교사')).toBeDefined();
    expect(screen.getByText('teacher1@cam.hs.kr')).toBeDefined();
    expect(screen.getByText('teacher-1')).toBeDefined();

    expect(screen.getByText('이교사')).toBeDefined();
    expect(screen.getByText('teacher-2')).toBeDefined();
  });

  // 시나리오 4: 탭 「학생」 클릭 -> students mock 렌더
  it('scenario 4: switches to students tab and renders students list', () => {
    const mockTeachers = [
      {
        courseId: 'c-101',
        userId: 'teacher-1',
        profile: {
          name: { fullName: '김교사' },
        },
      },
    ];

    const mockStudents = [
      {
        courseId: 'c-101',
        userId: 'student-1',
        profile: {
          name: { fullName: '박학생' },
          emailAddress: 'student1@cam.hs.kr',
        },
      },
    ];

    mockUseClassroomTeachersList.mockReturnValue({
      data: { teachers: mockTeachers },
      isLoading: false,
      isError: false,
      error: null,
    });
    mockUseClassroomStudentsList.mockReturnValue({
      data: { students: mockStudents },
      isLoading: false,
      isError: false,
      error: null,
    });

    render(
      <CourseMembersDialog
        open={true}
        onOpenChange={vi.fn()}
        courseId="c-101"
        courseName="1학년 1반 수학"
      />,
    );

    // 기본은 교사 탭
    expect(screen.getByTestId('course-member-row-teacher-1')).toBeDefined();
    expect(screen.queryByTestId('course-member-row-student-1')).toBeNull();

    // 학생 탭 클릭
    const studentTabBtn = screen.getByTestId('course-members-tab-students');
    fireEvent.click(studentTabBtn);

    expect(screen.getByTestId('course-member-row-student-1')).toBeDefined();
    expect(screen.getByText('박학생')).toBeDefined();
    expect(screen.getByText('student1@cam.hs.kr')).toBeDefined();
    expect(screen.getByText('student-1')).toBeDefined();
    expect(screen.queryByTestId('course-member-row-teacher-1')).toBeNull();
  });

  // 시나리오 5: 스크롤 컨테이너 존재 확인 (v0.81 패턴)
  it('scenario 5: renders scroll container with correct overflow styles', () => {
    mockUseClassroomTeachersList.mockReturnValue({
      data: {
        teachers: [
          {
            courseId: 'c-101',
            userId: 'teacher-1',
          },
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
    });
    mockUseClassroomStudentsList.mockReturnValue({
      data: { students: [] },
      isLoading: false,
      isError: false,
      error: null,
    });

    render(
      <CourseMembersDialog
        open={true}
        onOpenChange={vi.fn()}
        courseId="c-101"
      />,
    );

    const container = screen.getByTestId('course-members-scroll-container');
    expect(container.className).toMatch(/overflow-y-auto/);
    expect(container.className).toMatch(/max-h-/);
  });

  // 시나리오 6: 「닫기」 -> onOpenChange(false)
  it('scenario 6: calls onOpenChange(false) when close button is clicked', () => {
    mockUseClassroomTeachersList.mockReturnValue({
      data: { teachers: [] },
      isLoading: false,
      isError: false,
      error: null,
    });
    mockUseClassroomStudentsList.mockReturnValue({
      data: { students: [] },
      isLoading: false,
      isError: false,
      error: null,
    });

    const onOpenChange = vi.fn();
    render(
      <CourseMembersDialog
        open={true}
        onOpenChange={onOpenChange}
        courseId="c-101"
      />,
    );

    const closeBtns = screen.getAllByRole('button', { name: '닫기' });
    fireEvent.click(closeBtns[0]);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders error message when query fails', () => {
    mockUseClassroomTeachersList.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('permission-denied'),
    });
    mockUseClassroomStudentsList.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
    });

    render(
      <CourseMembersDialog
        open={true}
        onOpenChange={vi.fn()}
        courseId="c-101"
      />,
    );

    expect(screen.getByTestId('course-members-error')).toBeDefined();
    expect(screen.getByText('오류: permission-denied')).toBeDefined();
  });
});
