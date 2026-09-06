import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

const mockUseClassroomTeachersList = vi.fn();
const mockUseClassroomStudentsList = vi.fn();
const mockMutateAsyncAdd = vi.fn();
const mockUseClassroomTeachersAdd = vi.fn();
const mockMutateAsyncDelete = vi.fn();
const mockUseClassroomTeachersDelete = vi.fn();

vi.mock('../src/api/classroomTeachersList', () => ({
  useClassroomTeachersList: (courseId: string | null, open: boolean) =>
    mockUseClassroomTeachersList(courseId, open),
}));

vi.mock('../src/api/classroomStudentsList', () => ({
  useClassroomStudentsList: (courseId: string | null, open: boolean) =>
    mockUseClassroomStudentsList(courseId, open),
}));

vi.mock('../src/api/classroomTeachersAdd', () => ({
  useClassroomTeachersAdd: () => mockUseClassroomTeachersAdd(),
}));

vi.mock('../src/api/classroomTeachersDelete', () => ({
  useClassroomTeachersDelete: () => mockUseClassroomTeachersDelete(),
}));

const mockMutateAsyncStudentAdd = vi.fn();
const mockUseClassroomStudentsAdd = vi.fn();
const mockMutateAsyncStudentDelete = vi.fn();
const mockUseClassroomStudentsDelete = vi.fn();

vi.mock('../src/api/classroomStudentsAdd', () => ({
  useClassroomStudentsAdd: () => mockUseClassroomStudentsAdd(),
}));

vi.mock('../src/api/classroomStudentsDelete', () => ({
  useClassroomStudentsDelete: () => mockUseClassroomStudentsDelete(),
}));

import { CourseMembersDialog } from '../src/routes/admin/CourseMembersDialog';

describe('CourseMembersDialog component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseClassroomTeachersAdd.mockReturnValue({
      mutateAsync: mockMutateAsyncAdd,
      isPending: false,
      error: null,
    });
    mockUseClassroomTeachersDelete.mockReturnValue({
      mutateAsync: mockMutateAsyncDelete,
      isPending: false,
      error: null,
    });
    mockUseClassroomStudentsAdd.mockReturnValue({
      mutateAsync: mockMutateAsyncStudentAdd,
      isPending: false,
      error: null,
    });
    mockUseClassroomStudentsDelete.mockReturnValue({
      mutateAsync: mockMutateAsyncStudentDelete,
      isPending: false,
      error: null,
    });
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

  // 시나리오 8: 교사 탭 -> 「추가」 버튼 존재 · 이메일 입력 시 활성화
  it('scenario 8: renders add teacher form on teachers tab and button is disabled when empty', () => {
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

    render(
      <CourseMembersDialog
        open={true}
        onOpenChange={vi.fn()}
        courseId="c-101"
      />,
    );

    expect(screen.getByTestId('course-members-add-form')).toBeDefined();
    const input = screen.getByTestId('course-members-add-email');
    const button = screen.getByTestId('course-members-add-btn');

    expect((button as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(input, { target: { value: 'teacher@cam.hs.kr' } });
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });

  // 시나리오 9: 이메일 입력 후 「추가」 클릭 -> callClassroomTeachersAdd 호출 (courseId, userId=email)
  it('scenario 9: calls add mutation with courseId and email on add button click', async () => {
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
    mockMutateAsyncAdd.mockResolvedValueOnce({
      teacher: { courseId: 'c-101', userId: 'newteacher@cam.hs.kr' },
    });

    render(
      <CourseMembersDialog
        open={true}
        onOpenChange={vi.fn()}
        courseId="c-101"
      />,
    );

    const input = screen.getByTestId('course-members-add-email');
    fireEvent.change(input, { target: { value: '  newteacher@cam.hs.kr  ' } });

    const button = screen.getByTestId('course-members-add-btn');
    await act(async () => {
      fireEvent.click(button);
    });

    expect(mockMutateAsyncAdd).toHaveBeenCalledWith({
      courseId: 'c-101',
      userId: 'newteacher@cam.hs.kr',
    });
  });

  // 시나리오 10: 학생 탭 -> 「추가」 폼 렌더 및 삭제 버튼 렌더
  it('scenario 10: renders add form and delete button on students tab', () => {
    mockUseClassroomTeachersList.mockReturnValue({
      data: { teachers: [] },
      isLoading: false,
      isError: false,
      error: null,
    });
    mockUseClassroomStudentsList.mockReturnValue({
      data: {
        students: [
          {
            courseId: 'c-101',
            userId: 's-101',
            profile: { name: { fullName: '학생일' }, emailAddress: 'student1@cam.hs.kr' },
          },
        ],
      },
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

    const studentTabBtn = screen.getByTestId('course-members-tab-students');
    fireEvent.click(studentTabBtn);

    expect(screen.getByTestId('course-members-add-form')).toBeDefined();
    expect(screen.getByTestId('course-members-add-email')).toBeDefined();
    expect(screen.getByTestId('course-members-add-btn')).toBeDefined();
    expect(screen.getByTestId('course-member-row-s-101')).toBeDefined();
    expect(screen.getByTestId('course-member-delete-btn-s-101')).toBeDefined();
  });

  // 시나리오 11: 학생 탭에서 이메일 입력 후 「추가」 클릭 -> callClassroomStudentsAdd 호출
  it('scenario 11: calls student add mutation on add button click in students tab', async () => {
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
    mockMutateAsyncStudentAdd.mockResolvedValueOnce({
      student: { courseId: 'c-101', userId: 'newstudent@cam.hs.kr' },
    });

    render(
      <CourseMembersDialog
        open={true}
        onOpenChange={vi.fn()}
        courseId="c-101"
      />,
    );

    const studentTabBtn = screen.getByTestId('course-members-tab-students');
    fireEvent.click(studentTabBtn);

    const input = screen.getByTestId('course-members-add-email');
    fireEvent.change(input, { target: { value: '  newstudent@cam.hs.kr  ' } });

    const button = screen.getByTestId('course-members-add-btn');
    await act(async () => {
      fireEvent.click(button);
    });

    expect(mockMutateAsyncStudentAdd).toHaveBeenCalledWith({
      courseId: 'c-101',
      userId: 'newstudent@cam.hs.kr',
    });
    expect(mockMutateAsyncAdd).not.toHaveBeenCalled();
  });

  // 시나리오 12: 학생 행 「삭제」 버튼 -> callClassroomStudentsDelete 호출
  it('scenario 12: calls student delete mutation when delete button is clicked on student row', async () => {
    mockUseClassroomTeachersList.mockReturnValue({
      data: { teachers: [] },
      isLoading: false,
      isError: false,
      error: null,
    });
    mockUseClassroomStudentsList.mockReturnValue({
      data: {
        students: [
          {
            courseId: 'c-101',
            userId: 'student-1',
            profile: { name: { fullName: '박학생' } },
          },
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
    });
    mockMutateAsyncStudentDelete.mockResolvedValueOnce({ ok: true });

    render(
      <CourseMembersDialog
        open={true}
        onOpenChange={vi.fn()}
        courseId="c-101"
      />,
    );

    const studentTabBtn = screen.getByTestId('course-members-tab-students');
    fireEvent.click(studentTabBtn);

    const deleteBtn = screen.getByTestId('course-member-delete-btn-student-1');
    await act(async () => {
      fireEvent.click(deleteBtn);
    });

    expect(mockMutateAsyncStudentDelete).toHaveBeenCalledWith({
      courseId: 'c-101',
      userId: 'student-1',
    });
    expect(mockMutateAsyncDelete).not.toHaveBeenCalled();
  });

  // 시나리오 13: 교사 행 「삭제」 버튼 -> callClassroomTeachersDelete 호출
  it('scenario 13: calls teacher delete mutation when delete button is clicked on teacher row', async () => {
    mockUseClassroomTeachersList.mockReturnValue({
      data: {
        teachers: [
          {
            courseId: 'c-101',
            userId: 'teacher-1',
            profile: { name: { fullName: '김교사' } },
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
    mockMutateAsyncDelete.mockResolvedValueOnce({ ok: true });

    render(
      <CourseMembersDialog
        open={true}
        onOpenChange={vi.fn()}
        courseId="c-101"
      />,
    );

    const deleteBtn = screen.getByTestId('course-member-delete-btn-teacher-1');
    await act(async () => {
      fireEvent.click(deleteBtn);
    });

    expect(mockMutateAsyncDelete).toHaveBeenCalledWith({
      courseId: 'c-101',
      userId: 'teacher-1',
    });
    expect(mockMutateAsyncStudentDelete).not.toHaveBeenCalled();
  });

  // 시나리오 14: mutation error 렌더링
  it('scenario 14: renders error message when add or delete mutation has error on respective tab', () => {
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
    mockUseClassroomTeachersAdd.mockReturnValue({
      mutateAsync: mockMutateAsyncAdd,
      isPending: false,
      error: new Error('User is already a teacher'),
    });
    mockUseClassroomTeachersDelete.mockReturnValue({
      mutateAsync: mockMutateAsyncDelete,
      isPending: false,
      error: new Error('Cannot remove course owner'),
    });
    mockUseClassroomStudentsAdd.mockReturnValue({
      mutateAsync: mockMutateAsyncStudentAdd,
      isPending: false,
      error: new Error('User is already a student'),
    });
    mockUseClassroomStudentsDelete.mockReturnValue({
      mutateAsync: mockMutateAsyncStudentDelete,
      isPending: false,
      error: new Error('Cannot remove student'),
    });

    render(
      <CourseMembersDialog
        open={true}
        onOpenChange={vi.fn()}
        courseId="c-101"
      />,
    );

    // 교사 탭에서는 교사 에러 표시
    expect(screen.getByTestId('course-members-add-error')).toBeDefined();
    expect(screen.getByText('추가 실패: User is already a teacher')).toBeDefined();
    expect(screen.getByTestId('course-members-delete-error')).toBeDefined();
    expect(screen.getByText('삭제 실패: Cannot remove course owner')).toBeDefined();

    // 학생 탭 클릭 -> 학생 에러 표시
    const studentTabBtn = screen.getByTestId('course-members-tab-students');
    fireEvent.click(studentTabBtn);

    expect(screen.getByTestId('course-members-add-error')).toBeDefined();
    expect(screen.getByText('추가 실패: User is already a student')).toBeDefined();
    expect(screen.getByTestId('course-members-delete-error')).toBeDefined();
    expect(screen.getByText('삭제 실패: Cannot remove student')).toBeDefined();
  });

  // 시나리오 15: mutations 별개 격리 확인
  it('scenario 15: keeps teacher and student mutations isolated', async () => {
    mockUseClassroomTeachersList.mockReturnValue({
      data: { teachers: [{ courseId: 'c-101', userId: 't-1' }] },
      isLoading: false,
      isError: false,
      error: null,
    });
    mockUseClassroomStudentsList.mockReturnValue({
      data: { students: [{ courseId: 'c-101', userId: 's-1' }] },
      isLoading: false,
      isError: false,
      error: null,
    });
    mockMutateAsyncAdd.mockResolvedValueOnce({ teacher: { courseId: 'c-101', userId: 't-2' } });

    render(
      <CourseMembersDialog
        open={true}
        onOpenChange={vi.fn()}
        courseId="c-101"
      />,
    );

    // 교사 탭에서 추가
    const input = screen.getByTestId('course-members-add-email');
    fireEvent.change(input, { target: { value: 'teacher2@cam.hs.kr' } });
    await act(async () => {
      fireEvent.click(screen.getByTestId('course-members-add-btn'));
    });

    expect(mockMutateAsyncAdd).toHaveBeenCalledWith({
      courseId: 'c-101',
      userId: 'teacher2@cam.hs.kr',
    });
    expect(mockMutateAsyncStudentAdd).not.toHaveBeenCalled();
  });
});
