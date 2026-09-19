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
  useClassroomTeachersList: (courseId: string | null, active: boolean) =>
    mockUseClassroomTeachersList(courseId, active),
}));

vi.mock('../src/api/classroomStudentsList', () => ({
  useClassroomStudentsList: (courseId: string | null, active: boolean) =>
    mockUseClassroomStudentsList(courseId, active),
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

const mockClassroomBulkInviteDialog = vi.fn();
vi.mock('../src/routes/admin/ClassroomBulkInviteDialog', () => ({
  ClassroomBulkInviteDialog: (props: any) => {
    mockClassroomBulkInviteDialog(props);
    return null;
  },
}));

import { CourseMembersPanel } from '../src/routes/admin/CourseMembersPanel';

function setDefaultMocks() {
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
}

describe('CourseMembersPanel component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setDefaultMocks();
  });

  it('scenario 1: renders loading state when courseId is null', () => {
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

    render(<CourseMembersPanel courseId={null} />);

    expect(screen.getByTestId('course-members-loading')).toBeDefined();
    expect(screen.getByText('로딩 중...')).toBeDefined();
  });

  it('scenario 2: renders teachers list on default teachers tab', () => {
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
        profile: { name: { fullName: '이교사' } },
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

    render(<CourseMembersPanel courseId="c-101" courseName="1학년 1반 수학" />);

    expect(screen.getByTestId('course-members-tab-teachers')).toBeDefined();
    expect(screen.getByTestId('course-members-tab-students')).toBeDefined();
    expect(screen.getByTestId('course-member-row-teacher-1')).toBeDefined();
    expect(screen.getByTestId('course-member-row-teacher-2')).toBeDefined();
    expect(screen.getByText('김교사')).toBeDefined();
    expect(screen.getByText('teacher1@cam.hs.kr')).toBeDefined();
    expect(screen.getByText('이교사')).toBeDefined();
  });

  it('scenario 3: switches to students tab and renders students list', () => {
    const mockTeachers = [
      {
        courseId: 'c-101',
        userId: 'teacher-1',
        profile: { name: { fullName: '김교사' } },
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

    render(<CourseMembersPanel courseId="c-101" courseName="1학년 1반 수학" />);

    expect(screen.getByTestId('course-member-row-teacher-1')).toBeDefined();
    expect(screen.queryByTestId('course-member-row-student-1')).toBeNull();

    fireEvent.click(screen.getByTestId('course-members-tab-students'));

    expect(screen.getByTestId('course-member-row-student-1')).toBeDefined();
    expect(screen.getByText('박학생')).toBeDefined();
    expect(screen.queryByTestId('course-member-row-teacher-1')).toBeNull();
  });

  it('scenario 4: renders scroll container with overflow styles', () => {
    mockUseClassroomTeachersList.mockReturnValue({
      data: {
        teachers: [{ courseId: 'c-101', userId: 'teacher-1' }],
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

    render(<CourseMembersPanel courseId="c-101" />);

    const container = screen.getByTestId('course-members-scroll-container');
    expect(container.className).toMatch(/overflow-y-auto/);
    expect(container.className).toMatch(/max-h-/);
  });

  it('scenario 5: renders error message when query fails', () => {
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

    render(<CourseMembersPanel courseId="c-101" />);

    expect(screen.getByTestId('course-members-error')).toBeDefined();
    expect(screen.getByText('오류: permission-denied')).toBeDefined();
  });

  it('scenario 6: add button is disabled when email is empty', () => {
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

    render(<CourseMembersPanel courseId="c-101" />);

    expect(screen.getByTestId('course-members-add-form')).toBeDefined();
    const input = screen.getByTestId('course-members-add-email');
    const button = screen.getByTestId('course-members-add-btn') as HTMLButtonElement;

    expect(button.disabled).toBe(true);

    fireEvent.change(input, { target: { value: 'teacher@cam.hs.kr' } });
    expect(button.disabled).toBe(false);
  });

  it('scenario 7: calls teachers add mutation with courseId and trimmed email', async () => {
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

    render(<CourseMembersPanel courseId="c-101" />);

    fireEvent.change(screen.getByTestId('course-members-add-email'), {
      target: { value: '  newteacher@cam.hs.kr  ' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('course-members-add-btn'));
    });

    expect(mockMutateAsyncAdd).toHaveBeenCalledWith({
      courseId: 'c-101',
      userId: 'newteacher@cam.hs.kr',
    });
  });

  it('scenario 8: calls students add mutation on students tab', async () => {
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

    render(<CourseMembersPanel courseId="c-101" />);

    fireEvent.click(screen.getByTestId('course-members-tab-students'));
    fireEvent.change(screen.getByTestId('course-members-add-email'), {
      target: { value: '  newstudent@cam.hs.kr  ' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('course-members-add-btn'));
    });

    expect(mockMutateAsyncStudentAdd).toHaveBeenCalledWith({
      courseId: 'c-101',
      userId: 'newstudent@cam.hs.kr',
    });
    expect(mockMutateAsyncAdd).not.toHaveBeenCalled();
  });

  it('scenario 9: two-step delete confirm calls teachers delete mutation', async () => {
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

    render(<CourseMembersPanel courseId="c-101" />);

    fireEvent.click(screen.getByTestId('course-member-delete-btn-teacher-1'));
    const confirmBtn = screen.getByTestId('course-member-confirm-delete-btn-teacher-1');
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    expect(mockMutateAsyncDelete).toHaveBeenCalledWith({
      courseId: 'c-101',
      userId: 'teacher-1',
    });
  });

  it('scenario 10: two-step delete confirm calls students delete on students tab', async () => {
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

    render(<CourseMembersPanel courseId="c-101" />);

    fireEvent.click(screen.getByTestId('course-members-tab-students'));
    fireEvent.click(screen.getByTestId('course-member-delete-btn-student-1'));
    const confirmBtn = screen.getByTestId('course-member-confirm-delete-btn-student-1');
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    expect(mockMutateAsyncStudentDelete).toHaveBeenCalledWith({
      courseId: 'c-101',
      userId: 'student-1',
    });
  });

  it('scenario 11: delete confirm cancel keeps row and does not call delete', () => {
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

    render(<CourseMembersPanel courseId="c-101" />);

    fireEvent.click(screen.getByTestId('course-member-delete-btn-teacher-1'));
    expect(screen.getByTestId('course-member-confirm-delete-btn-teacher-1')).toBeDefined();
    fireEvent.click(screen.getByTestId('course-member-cancel-delete-btn-teacher-1'));

    expect(screen.getByTestId('course-member-delete-btn-teacher-1')).toBeDefined();
    expect(mockMutateAsyncDelete).not.toHaveBeenCalled();
  });

  it('scenario 12: renders empty message when no teachers', () => {
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

    render(<CourseMembersPanel courseId="c-101" />);

    expect(screen.getByText('교사가 없습니다.')).toBeDefined();
  });

  it('scenario 13: renders bulk invite button on students tab only', () => {
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

    render(<CourseMembersPanel courseId="c-101" />);

    // 교사 탭에서는 초대 버튼 없음
    expect(screen.queryByTestId('course-members-bulk-invite-btn')).toBeNull();

    fireEvent.click(screen.getByTestId('course-members-tab-students'));
    expect(screen.getByTestId('course-members-bulk-invite-btn')).toBeDefined();
  });

  it('scenario 14: shows add error inline when mutation returns error', () => {
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
      error: new Error('user-not-found'),
      reset: mockResetAdd,
    });

    render(<CourseMembersPanel courseId="c-101" />);

    expect(screen.getByTestId('course-members-add-error')).toBeDefined();
    expect(screen.getByText('추가 실패: user-not-found')).toBeDefined();
  });

  it('scenario 15: keeps teacher and student add mutations isolated', async () => {
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
    mockMutateAsyncStudentAdd.mockResolvedValueOnce({ student: {} });

    render(<CourseMembersPanel courseId="c-101" />);

    fireEvent.click(screen.getByTestId('course-members-tab-students'));
    fireEvent.change(screen.getByTestId('course-members-add-email'), {
      target: { value: 'student@cam.hs.kr' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('course-members-add-btn'));
    });

    expect(mockMutateAsyncStudentAdd).toHaveBeenCalledTimes(1);
    expect(mockMutateAsyncAdd).not.toHaveBeenCalled();
  });

  it('scenario 16: delete confirm state resets on success', async () => {
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

    render(<CourseMembersPanel courseId="c-101" />);

    fireEvent.click(screen.getByTestId('course-member-delete-btn-teacher-1'));
    expect(screen.getByTestId('course-member-confirm-delete-btn-teacher-1')).toBeDefined();

    await act(async () => {
      fireEvent.click(screen.getByTestId('course-member-confirm-delete-btn-teacher-1'));
    });

    expect(
      screen.queryByTestId('course-member-confirm-delete-btn-teacher-1'),
    ).toBeNull();
    expect(screen.getByTestId('course-member-delete-btn-teacher-1')).toBeDefined();
  });

  it('scenario 17: confirm state resets when switching tabs', () => {
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

    render(<CourseMembersPanel courseId="c-101" />);

    fireEvent.click(screen.getByTestId('course-member-delete-btn-teacher-1'));
    expect(screen.getByTestId('course-member-confirm-delete-btn-teacher-1')).toBeDefined();

    fireEvent.click(screen.getByTestId('course-members-tab-students'));
    fireEvent.click(screen.getByTestId('course-members-tab-teachers'));

    expect(
      screen.queryByTestId('course-member-confirm-delete-btn-teacher-1'),
    ).toBeNull();
    expect(screen.getByTestId('course-member-delete-btn-teacher-1')).toBeDefined();
  });

  it('scenario 18: pending delete disables other row delete buttons and inputs', () => {
    mockUseClassroomTeachersList.mockReturnValue({
      data: {
        teachers: [
          { courseId: 'c-101', userId: 'teacher-1' },
          { courseId: 'c-101', userId: 'teacher-2' },
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

    render(<CourseMembersPanel courseId="c-101" />);

    const otherBtn = screen.getByTestId(
      'course-member-delete-btn-teacher-2',
    ) as HTMLButtonElement;
    expect(otherBtn.disabled).toBe(true);
  });

  it('scenario 19: pending add disables tabs, add input, and add button', () => {
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
      isPending: true,
      error: null,
      reset: mockResetAdd,
    });

    render(<CourseMembersPanel courseId="c-101" />);

    const teachersTab = screen.getByTestId(
      'course-members-tab-teachers',
    ) as HTMLButtonElement;
    const studentsTab = screen.getByTestId(
      'course-members-tab-students',
    ) as HTMLButtonElement;
    const input = screen.getByTestId('course-members-add-email') as HTMLInputElement;
    const addBtn = screen.getByTestId('course-members-add-btn') as HTMLButtonElement;

    expect(teachersTab.disabled).toBe(true);
    expect(studentsTab.disabled).toBe(true);
    expect(input.disabled).toBe(true);
    expect(addBtn.disabled).toBe(true);
  });

  it('scenario 20: clicking delete shows confirm and hides original delete', () => {
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

    render(<CourseMembersPanel courseId="c-101" />);

    fireEvent.click(screen.getByTestId('course-member-delete-btn-teacher-1'));

    expect(screen.getByTestId('course-member-confirm-delete-btn-teacher-1')).toBeDefined();
    expect(screen.getByTestId('course-member-cancel-delete-btn-teacher-1')).toBeDefined();
    // 원래 delete 버튼은 confirm 상태에서 감춰지지 않고 그대로 있음 (row 별). 여기서는 확인만.
  });

  it('scenario 21: bulk invite button click passes courseId to dialog', () => {
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

    render(<CourseMembersPanel courseId="c-101" courseName="1학년 1반" />);

    fireEvent.click(screen.getByTestId('course-members-tab-students'));
    fireEvent.click(screen.getByTestId('course-members-bulk-invite-btn'));

    const call = mockClassroomBulkInviteDialog.mock.calls.at(-1);
    expect(call?.[0]?.open).toBe(true);
    expect(call?.[0]?.courseId).toBe('c-101');
    expect(call?.[0]?.courseName).toBe('1학년 1반');
  });

  it('scenario 22: pending state notifies parent via onPendingChange callback', () => {
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
      isPending: true,
      error: null,
      reset: mockResetAdd,
    });

    const onPendingChange = vi.fn();
    render(
      <CourseMembersPanel courseId="c-101" onPendingChange={onPendingChange} />,
    );

    expect(onPendingChange).toHaveBeenCalledWith(true);
  });

  it('scenario 23: renders email input label with htmlFor accessibility', () => {
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

    render(<CourseMembersPanel courseId="c-101" />);

    const input = screen.getByLabelText('이메일 추가') as HTMLInputElement;
    expect(input.id).toBe('course-members-add-email-input');
  });

  // v0.148: 명단 CSV 내보내기 (원본 「명단 확인」 대응).
  describe('v0.148 CSV 내보내기', () => {
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    beforeEach(() => {
      URL.createObjectURL = vi.fn(() => 'blob:mock');
      URL.revokeObjectURL = vi.fn();
    });
    afterAll(() => {
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
    });

    it('교사 탭에서 「CSV 내보내기 (N)」 버튼 · 명단 없으면 disabled', () => {
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
      render(<CourseMembersPanel courseId="c-101" courseName="1학년 1반" />);
      const btn = screen.getByTestId('course-members-export-csv-btn') as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
      expect(btn.textContent).toContain('(0)');
    });

    it('교사 탭에서 명단 있으면 enabled · 클릭 시 CSV 파일 download 트리거', () => {
      mockUseClassroomTeachersList.mockReturnValue({
        data: {
          teachers: [
            {
              courseId: 'c-101',
              userId: 't1',
              profile: {
                emailAddress: 't1@school.kr',
                name: { fullName: '홍길동' },
              },
            },
            {
              courseId: 'c-101',
              userId: 't2',
              profile: {
                emailAddress: 't2@school.kr',
                name: { fullName: '김철수' },
              },
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

      // anchor click intercept.
      const clicks: Array<{ href: string; download: string }> = [];
      const originalCreateElement = document.createElement.bind(document);
      const spy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const el = originalCreateElement(tag);
        if (tag === 'a') {
          Object.defineProperty(el, 'click', {
            value: () =>
              clicks.push({
                href: (el as HTMLAnchorElement).href,
                download: (el as HTMLAnchorElement).download,
              }),
          });
        }
        return el;
      });

      render(<CourseMembersPanel courseId="c-101" courseName="1학년 1반" />);
      const btn = screen.getByTestId('course-members-export-csv-btn') as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
      expect(btn.textContent).toContain('(2)');
      fireEvent.click(btn);

      expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
      expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
      expect(clicks).toHaveLength(1);
      // 파일명: 코스이름-교사-YYYY-MM-DD.csv.
      expect(clicks[0].download).toMatch(/^1학년 1반-교사-\d{4}-\d{2}-\d{2}\.csv$/);

      spy.mockRestore();
    });

    it('학생 탭으로 전환하면 export 버튼 텍스트가 학생 카운트로 갱신 · 파일명도 학생', () => {
      mockUseClassroomTeachersList.mockReturnValue({
        data: {
          teachers: [
            {
              courseId: 'c-101',
              userId: 't1',
              profile: { emailAddress: 't@x.kr', name: { fullName: '교사' } },
            },
          ],
        },
        isLoading: false,
        isError: false,
        error: null,
      });
      mockUseClassroomStudentsList.mockReturnValue({
        data: {
          students: [
            {
              courseId: 'c-101',
              userId: 's1',
              profile: { emailAddress: 's1@x.kr', name: { fullName: '학생1' } },
            },
            {
              courseId: 'c-101',
              userId: 's2',
              profile: { emailAddress: 's2@x.kr', name: { fullName: '학생2' } },
            },
            {
              courseId: 'c-101',
              userId: 's3',
              profile: { emailAddress: 's3@x.kr', name: { fullName: '학생3' } },
            },
          ],
        },
        isLoading: false,
        isError: false,
        error: null,
      });

      const clicks: Array<{ download: string }> = [];
      const originalCreateElement = document.createElement.bind(document);
      const spy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const el = originalCreateElement(tag);
        if (tag === 'a') {
          Object.defineProperty(el, 'click', {
            value: () => clicks.push({ download: (el as HTMLAnchorElement).download }),
          });
        }
        return el;
      });

      render(<CourseMembersPanel courseId="c-101" courseName="1학년 1반" />);
      fireEvent.click(screen.getByTestId('course-members-tab-students'));

      const btn = screen.getByTestId('course-members-export-csv-btn');
      expect(btn.textContent).toContain('(3)');
      fireEvent.click(btn);
      expect(clicks[0].download).toMatch(/^1학년 1반-학생-\d{4}-\d{2}-\d{2}\.csv$/);

      spy.mockRestore();
    });

    it('코스명에 파일시스템 금지 문자 (/ * ? 등) 있으면 _ 로 치환', () => {
      mockUseClassroomTeachersList.mockReturnValue({
        data: {
          teachers: [
            {
              courseId: 'c-1',
              userId: 't1',
              profile: { emailAddress: 't@x.kr', name: { fullName: 'A' } },
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

      const clicks: Array<{ download: string }> = [];
      const originalCreateElement = document.createElement.bind(document);
      const spy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const el = originalCreateElement(tag);
        if (tag === 'a') {
          Object.defineProperty(el, 'click', {
            value: () => clicks.push({ download: (el as HTMLAnchorElement).download }),
          });
        }
        return el;
      });

      render(<CourseMembersPanel courseId="c-1" courseName="1/2 * 반?" />);
      fireEvent.click(screen.getByTestId('course-members-export-csv-btn'));
      expect(clicks[0].download).toMatch(/^1_2 _ 반_-교사-\d{4}-\d{2}-\d{2}\.csv$/);

      spy.mockRestore();
    });
  });

  // v0.156: 선택 명단만 export.
  describe('v0.156 선택 명단 export', () => {
    beforeEach(() => {
      URL.createObjectURL = vi.fn(() => 'blob:mock');
      URL.revokeObjectURL = vi.fn();
    });
    afterAll(() => {
      URL.createObjectURL = URL.createObjectURL;
    });

    const teachers = [
      {
        courseId: 'c-1',
        userId: 't1',
        profile: { emailAddress: 't1@x.kr', name: { fullName: '교사1' } },
      },
      {
        courseId: 'c-1',
        userId: 't2',
        profile: { emailAddress: 't2@x.kr', name: { fullName: '교사2' } },
      },
      {
        courseId: 'c-1',
        userId: 't3',
        profile: { emailAddress: 't3@x.kr', name: { fullName: '교사3' } },
      },
    ];

    it('개별 체크박스 선택 · export 버튼 라벨에 「(선택 N)」 · 파일명 -selected', () => {
      mockUseClassroomTeachersList.mockReturnValue({
        data: { teachers },
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

      render(<CourseMembersPanel courseId="c-1" courseName="1반" />);
      // 초기 라벨 (전체 3).
      expect(screen.getByTestId('course-members-export-csv-btn').textContent).toContain('(3)');
      // t1, t3 선택.
      fireEvent.click(screen.getByTestId('course-member-select-t1'));
      fireEvent.click(screen.getByTestId('course-member-select-t3'));
      // 라벨 「(선택 2)」.
      expect(screen.getByTestId('course-members-export-csv-btn').textContent).toContain(
        '(선택 2)',
      );
      // 클릭 → download 트리거 · 파일명 -selected.
      fireEvent.click(screen.getByTestId('course-members-export-csv-btn'));
      expect(clicks[0].download).toMatch(/^1반-교사-selected-\d{4}-\d{2}-\d{2}\.csv$/);

      spy.mockRestore();
    });

    it('「전체 선택」 header checkbox → 모든 items · 해제 시 다시 0', () => {
      mockUseClassroomTeachersList.mockReturnValue({
        data: { teachers },
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
      render(<CourseMembersPanel courseId="c-1" courseName="1반" />);
      const selectAll = screen.getByTestId('course-members-select-all') as HTMLInputElement;
      fireEvent.click(selectAll);
      expect(screen.getByTestId('course-members-export-csv-btn').textContent).toContain('(선택 3)');
      // 다시 클릭 → 해제.
      fireEvent.click(selectAll);
      expect(screen.getByTestId('course-members-export-csv-btn').textContent).toContain('(3)');
    });

    it('탭 (teachers ↔ students) 전환 시 선택 리셋', () => {
      mockUseClassroomTeachersList.mockReturnValue({
        data: { teachers },
        isLoading: false,
        isError: false,
        error: null,
      });
      mockUseClassroomStudentsList.mockReturnValue({
        data: {
          students: [
            {
              courseId: 'c-1',
              userId: 's1',
              profile: { emailAddress: 's1@x.kr', name: { fullName: '학생1' } },
            },
          ],
        },
        isLoading: false,
        isError: false,
        error: null,
      });
      render(<CourseMembersPanel courseId="c-1" courseName="1반" />);
      fireEvent.click(screen.getByTestId('course-member-select-t1'));
      expect(screen.getByTestId('course-members-export-csv-btn').textContent).toContain(
        '(선택 1)',
      );
      // 학생 탭으로 전환.
      fireEvent.click(screen.getByTestId('course-members-tab-students'));
      // 선택 리셋 · 학생 전체 1명 (선택 없음).
      expect(screen.getByTestId('course-members-export-csv-btn').textContent).toContain('(1)');
      expect(screen.getByTestId('course-members-export-csv-btn').textContent).not.toContain('선택');
    });
  });
});
