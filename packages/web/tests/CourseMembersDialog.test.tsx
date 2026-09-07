import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

const mockUseClassroomTeachersList = vi.fn();
const mockUseClassroomStudentsList = vi.fn();
const mockMutateAsyncAdd = vi.fn();
const mockResetAdd = vi.fn();
const mockUseClassroomTeachersAdd = vi.fn();
const mockMutateAsyncDelete = vi.fn();
const mockResetDelete = vi.fn();
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
const mockResetStudentAdd = vi.fn();
const mockUseClassroomStudentsAdd = vi.fn();
const mockMutateAsyncStudentDelete = vi.fn();
const mockResetStudentDelete = vi.fn();
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
      reset: mockResetAdd,
    });
    mockUseClassroomTeachersDelete.mockReturnValue({
      mutateAsync: mockMutateAsyncDelete,
      isPending: false,
      error: null,
      reset: mockResetDelete,
    });
    mockUseClassroomStudentsAdd.mockReturnValue({
      mutateAsync: mockMutateAsyncStudentAdd,
      isPending: false,
      error: null,
      reset: mockResetStudentAdd,
    });
    mockUseClassroomStudentsDelete.mockReturnValue({
      mutateAsync: mockMutateAsyncStudentDelete,
      isPending: false,
      error: null,
      reset: mockResetStudentDelete,
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
    fireEvent.click(deleteBtn);
    const confirmBtn = screen.getByTestId('course-member-confirm-delete-btn-student-1');
    await act(async () => {
      fireEvent.click(confirmBtn);
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
    fireEvent.click(deleteBtn);
    const confirmBtn = screen.getByTestId('course-member-confirm-delete-btn-teacher-1');
    await act(async () => {
      fireEvent.click(confirmBtn);
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

  // 시나리오 16: open=true → courseId 변경 → addEmail · mutation reset 확인
  it('scenario 16: resets addEmail and calls mutation reset when courseId changes while open', () => {
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

    const { rerender } = render(
      <CourseMembersDialog
        open={true}
        onOpenChange={vi.fn()}
        courseId="c-101"
      />,
    );

    const input = screen.getByTestId('course-members-add-email') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'temp@cam.hs.kr' } });
    expect(input.value).toBe('temp@cam.hs.kr');

    // courseId 변경
    rerender(
      <CourseMembersDialog
        open={true}
        onOpenChange={vi.fn()}
        courseId="c-102"
      />,
    );

    expect((screen.getByTestId('course-members-add-email') as HTMLInputElement).value).toBe('');
    expect(mockResetAdd).toHaveBeenCalled();
    expect(mockResetDelete).toHaveBeenCalled();
    expect(mockResetStudentAdd).toHaveBeenCalled();
    expect(mockResetStudentDelete).toHaveBeenCalled();
  });

  // 시나리오 17: open=true → close 시도 (handleOpenChange(false)), mutation.isPending true 이면 미호출
  it('scenario 17: blocks closing dialog when any mutation is pending', () => {
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
    mockUseClassroomTeachersDelete.mockReturnValue({
      mutateAsync: mockMutateAsyncDelete,
      isPending: true,
      error: null,
      reset: mockResetDelete,
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

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  // 시나리오 18: 각 행 「삭제」 클릭 → 확인 버튼 나타남 (원 「삭제」 버튼은 사라짐)
  it('scenario 18: shows confirm and cancel buttons and hides original delete button on delete click', () => {
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

    render(
      <CourseMembersDialog
        open={true}
        onOpenChange={vi.fn()}
        courseId="c-101"
      />,
    );

    const deleteBtn = screen.getByTestId('course-member-delete-btn-teacher-1');
    fireEvent.click(deleteBtn);

    expect(screen.getByTestId('course-member-confirm-delete-btn-teacher-1')).toBeDefined();
    expect(screen.getByTestId('course-member-cancel-delete-btn-teacher-1')).toBeDefined();
    expect(screen.queryByTestId('course-member-delete-btn-teacher-1')).toBeNull();
  });

  // 시나리오 19: 「취소」 클릭 → 확인 사라짐 · 원 「삭제」 복원
  it('scenario 19: hides confirm buttons and restores delete button when cancel is clicked', () => {
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

    render(
      <CourseMembersDialog
        open={true}
        onOpenChange={vi.fn()}
        courseId="c-101"
      />,
    );

    fireEvent.click(screen.getByTestId('course-member-delete-btn-teacher-1'));
    expect(screen.getByTestId('course-member-cancel-delete-btn-teacher-1')).toBeDefined();

    fireEvent.click(screen.getByTestId('course-member-cancel-delete-btn-teacher-1'));
    expect(screen.queryByTestId('course-member-confirm-delete-btn-teacher-1')).toBeNull();
    expect(screen.queryByTestId('course-member-cancel-delete-btn-teacher-1')).toBeNull();
    expect(screen.getByTestId('course-member-delete-btn-teacher-1')).toBeDefined();
  });

  // 시나리오 20: 「정말 삭제?」 클릭 → callClassroomTeachers/StudentsDelete 호출 · 성공 시 confirm state 초기화
  it('scenario 20: calls delete mutation on confirm click and resets confirm state on success', async () => {
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

    fireEvent.click(screen.getByTestId('course-member-delete-btn-teacher-1'));
    const confirmBtn = screen.getByTestId('course-member-confirm-delete-btn-teacher-1');

    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    expect(mockMutateAsyncDelete).toHaveBeenCalledWith({
      courseId: 'c-101',
      userId: 'teacher-1',
    });
    expect(screen.queryByTestId('course-member-confirm-delete-btn-teacher-1')).toBeNull();
    expect(screen.getByTestId('course-member-delete-btn-teacher-1')).toBeDefined();
  });

  // 시나리오 21: tab 「학생」 클릭 시 teacher 탭의 confirm state 초기화
  it('scenario 21: resets confirm state when tab switches to students and back to teachers', () => {
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

    render(
      <CourseMembersDialog
        open={true}
        onOpenChange={vi.fn()}
        courseId="c-101"
      />,
    );

    fireEvent.click(screen.getByTestId('course-member-delete-btn-teacher-1'));
    expect(screen.getByTestId('course-member-confirm-delete-btn-teacher-1')).toBeDefined();

    // 학생 탭으로 전환
    fireEvent.click(screen.getByTestId('course-members-tab-students'));

    // 교사 탭으로 다시 복귀
    fireEvent.click(screen.getByTestId('course-members-tab-teachers'));

    // confirm state 가 초기화되어 원 「삭제」 버튼이 보임
    expect(screen.queryByTestId('course-member-confirm-delete-btn-teacher-1')).toBeNull();
    expect(screen.getByTestId('course-member-delete-btn-teacher-1')).toBeDefined();
  });

  // 시나리오 22: delete pending 중 다른 행 「삭제」 버튼 disabled
  it('scenario 22: disables other row delete buttons while delete mutation is pending', () => {
    mockUseClassroomTeachersList.mockReturnValue({
      data: {
        teachers: [
          { courseId: 'c-101', userId: 't-1' },
          { courseId: 'c-101', userId: 't-2' },
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
    mockUseClassroomTeachersDelete.mockReturnValue({
      mutateAsync: mockMutateAsyncDelete,
      isPending: true,
      error: null,
      reset: mockResetDelete,
    });

    render(
      <CourseMembersDialog
        open={true}
        onOpenChange={vi.fn()}
        courseId="c-101"
      />,
    );

    const btn1 = screen.getByTestId('course-member-delete-btn-t-1') as HTMLButtonElement;
    const btn2 = screen.getByTestId('course-member-delete-btn-t-2') as HTMLButtonElement;

    expect(btn1.disabled).toBe(true);
    expect(btn2.disabled).toBe(true);
  });

  // 시나리오 23: add pending 중 tab 버튼 · add input · delete 버튼 모두 disabled
  it('scenario 23: disables tab buttons, add input, add button, and delete buttons while add mutation is pending', () => {
    mockUseClassroomTeachersList.mockReturnValue({
      data: {
        teachers: [{ courseId: 'c-101', userId: 't-1' }],
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
    mockUseClassroomTeachersAdd.mockReturnValue({
      mutateAsync: mockMutateAsyncAdd,
      isPending: true,
      error: null,
      reset: mockResetAdd,
    });

    render(
      <CourseMembersDialog
        open={true}
        onOpenChange={vi.fn()}
        courseId="c-101"
      />,
    );

    const teacherTab = screen.getByTestId('course-members-tab-teachers') as HTMLButtonElement;
    const studentTab = screen.getByTestId('course-members-tab-students') as HTMLButtonElement;
    const input = screen.getByTestId('course-members-add-email') as HTMLInputElement;
    const addBtn = screen.getByTestId('course-members-add-btn') as HTMLButtonElement;
    const deleteBtn = screen.getByTestId('course-member-delete-btn-t-1') as HTMLButtonElement;

    expect(teacherTab.disabled).toBe(true);
    expect(studentTab.disabled).toBe(true);
    expect(input.disabled).toBe(true);
    expect(addBtn.disabled).toBe(true);
    expect(deleteBtn.disabled).toBe(true);
  });
});
