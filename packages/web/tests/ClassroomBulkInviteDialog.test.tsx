import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

const mockUseBasicDataGet = vi.fn();
const mockMutateAsyncStudentAdd = vi.fn();
const mockUseClassroomStudentsAdd = vi.fn();

vi.mock('../src/api/basicDataGet', () => ({
  useBasicDataGet: (year: number, enabled: boolean) => mockUseBasicDataGet(year, enabled),
}));

vi.mock('../src/api/classroomStudentsAdd', () => ({
  useClassroomStudentsAdd: () => mockUseClassroomStudentsAdd(),
}));

import {
  ClassroomBulkInviteDialog,
  isAlreadyMemberError,
} from '../src/routes/admin/ClassroomBulkInviteDialog';

describe('ClassroomBulkInviteDialog component', () => {
  const mockBasicData = {
    year: 2026,
    grades: [
      { grade: 1, classes: ['1', '2'] },
      { grade: 2, classes: ['1'] },
    ],
    rosters: {
      '1': {
        '1': ['s101@cam.hs.kr', 's102@cam.hs.kr'],
        '2': ['s121@cam.hs.kr'],
      },
      '2': {
        '1': ['s201@cam.hs.kr', 's202@cam.hs.kr', 's203@cam.hs.kr'],
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseBasicDataGet.mockReturnValue({
      data: { data: mockBasicData },
      isLoading: false,
      isError: false,
      error: null,
    });
    mockUseClassroomStudentsAdd.mockReturnValue({
      mutateAsync: mockMutateAsyncStudentAdd,
      isPending: false,
      error: null,
    });
  });

  // helper test for isAlreadyMemberError
  it('isAlreadyMemberError detects already member patterns', () => {
    expect(isAlreadyMemberError('User is already a student')).toBe(true);
    expect(isAlreadyMemberError('Duplicate entry')).toBe(true);
    expect(isAlreadyMemberError('member exists in course')).toBe(true);
    expect(isAlreadyMemberError('http_409 conflict')).toBe(true);
    expect(isAlreadyMemberError('internal server error')).toBe(false);
  });

  // 시나리오 1: open=false -> 미렌더
  it('scenario 1: does not render dialog when open is false', () => {
    render(
      <ClassroomBulkInviteDialog
        open={false}
        onOpenChange={vi.fn()}
        courseId="c-101"
        courseName="수학 101"
      />,
    );

    expect(screen.queryByText('학급 일괄 초대')).toBeNull();
    expect(screen.queryByTestId('bulk-invite-year-input')).toBeNull();
  });

  // 시나리오 2: open=true + basic_data 로드 후 -> phase select 상태 · 학년/반 버튼 렌더
  it('scenario 2: renders select phase with grade and class buttons when open is true', () => {
    render(
      <ClassroomBulkInviteDialog
        open={true}
        onOpenChange={vi.fn()}
        courseId="c-101"
        courseName="수학 101"
      />,
    );

    expect(screen.getByText('학급 일괄 초대')).toBeDefined();
    expect(screen.getByTestId('bulk-invite-year-input')).toBeDefined();
    expect(screen.getByTestId('bulk-invite-class-btn-1-1')).toBeDefined();
    expect(screen.getByTestId('bulk-invite-class-btn-1-2')).toBeDefined();
    expect(screen.getByTestId('bulk-invite-class-btn-2-1')).toBeDefined();
    expect(screen.getByTestId('bulk-invite-preview-btn')).toBeDefined();
    expect((screen.getByTestId('bulk-invite-preview-btn') as HTMLButtonElement).disabled).toBe(true);
  });

  // 시나리오 3: 반 선택 -> preview 학생 이메일 리스트 렌더
  it('scenario 3: renders preview student email list when class button is clicked', () => {
    render(
      <ClassroomBulkInviteDialog
        open={true}
        onOpenChange={vi.fn()}
        courseId="c-101"
        courseName="수학 101"
      />,
    );

    fireEvent.click(screen.getByTestId('bulk-invite-class-btn-1-1'));

    const preview = screen.getByTestId('bulk-invite-preview');
    expect(preview).toBeDefined();
    expect(screen.getByText('s101@cam.hs.kr')).toBeDefined();
    expect(screen.getByText('s102@cam.hs.kr')).toBeDefined();

    const previewBtn = screen.getByTestId('bulk-invite-preview-btn') as HTMLButtonElement;
    expect(previewBtn.disabled).toBe(false);
  });

  // 시나리오 4: 확인 텍스트 오류 -> 「초대 실행」 disabled
  it('scenario 4: disables execute button when confirm text does not match student count', () => {
    render(
      <ClassroomBulkInviteDialog
        open={true}
        onOpenChange={vi.fn()}
        courseId="c-101"
        courseName="수학 101"
      />,
    );

    // 1학년 1반 선택 (학생 2명)
    fireEvent.click(screen.getByTestId('bulk-invite-class-btn-1-1'));
    fireEvent.click(screen.getByTestId('bulk-invite-preview-btn'));

    expect(screen.getByText('초대 대상 확인')).toBeDefined();
    const confirmInput = screen.getByTestId('bulk-invite-confirm-input') as HTMLInputElement;
    const executeBtn = screen.getByTestId('bulk-invite-execute-btn') as HTMLButtonElement;

    expect(executeBtn.disabled).toBe(true);

    // 잘못된 숫자 입력
    fireEvent.change(confirmInput, { target: { value: '99' } });
    expect(executeBtn.disabled).toBe(true);

    // 공백 포함 잘못된 입력
    fireEvent.change(confirmInput, { target: { value: 'abc' } });
    expect(executeBtn.disabled).toBe(true);

    // 올바른 학생 수 (2) 입력 -> 활성화
    fireEvent.change(confirmInput, { target: { value: '2' } });
    expect(executeBtn.disabled).toBe(false);
  });

  // 시나리오 5: 「초대 실행」 클릭 -> mock classroomStudentsAdd 순차 호출 · 완료 후 done phase · ok 카운트 정확
  it('scenario 5: calls add mutation sequentially and enters done phase on success', async () => {
    mockMutateAsyncStudentAdd.mockResolvedValue({ student: {} });

    const onDone = vi.fn();
    render(
      <ClassroomBulkInviteDialog
        open={true}
        onOpenChange={vi.fn()}
        courseId="c-101"
        courseName="수학 101"
        onDone={onDone}
      />,
    );

    fireEvent.click(screen.getByTestId('bulk-invite-class-btn-1-1'));
    fireEvent.click(screen.getByTestId('bulk-invite-preview-btn'));

    const confirmInput = screen.getByTestId('bulk-invite-confirm-input');
    fireEvent.change(confirmInput, { target: { value: '2' } });

    const executeBtn = screen.getByTestId('bulk-invite-execute-btn');
    await act(async () => {
      fireEvent.click(executeBtn);
    });

    expect(mockMutateAsyncStudentAdd).toHaveBeenCalledTimes(2);
    expect(mockMutateAsyncStudentAdd).toHaveBeenNthCalledWith(1, {
      courseId: 'c-101',
      userId: 's101@cam.hs.kr',
    });
    expect(mockMutateAsyncStudentAdd).toHaveBeenNthCalledWith(2, {
      courseId: 'c-101',
      userId: 's102@cam.hs.kr',
    });

    expect(screen.getByTestId('bulk-invite-done')).toBeDefined();
    expect(screen.getByTestId('bulk-invite-done').textContent).toContain('2명 성공');
  });

  // 시나리오 6: 이미 멤버 오류 -> skipped 로 분류 · skipped 리스트 렌더
  it('scenario 6: classifies duplicate errors as skipped and renders skipped list', async () => {
    mockMutateAsyncStudentAdd
      .mockResolvedValueOnce({ student: {} })
      .mockRejectedValueOnce(new Error('User is already a member of this course (http_409)'));

    render(
      <ClassroomBulkInviteDialog
        open={true}
        onOpenChange={vi.fn()}
        courseId="c-101"
        courseName="수학 101"
      />,
    );

    fireEvent.click(screen.getByTestId('bulk-invite-class-btn-1-1'));
    fireEvent.click(screen.getByTestId('bulk-invite-preview-btn'));

    const confirmInput = screen.getByTestId('bulk-invite-confirm-input');
    fireEvent.change(confirmInput, { target: { value: '2' } });

    await act(async () => {
      fireEvent.click(screen.getByTestId('bulk-invite-execute-btn'));
    });

    const doneEl = screen.getByTestId('bulk-invite-done');
    expect(doneEl).toBeDefined();
    expect(doneEl.textContent).toContain('1명 성공');
    expect(doneEl.textContent).toContain('1명 이미 멤버 (skip)');

    const skippedList = screen.getByTestId('bulk-invite-skipped');
    expect(skippedList).toBeDefined();
    expect(skippedList.textContent).toContain('s102@cam.hs.kr');
  });

  // 시나리오 7: 다른 오류 -> failed 로 분류 · failed 리스트 렌더
  it('scenario 7: classifies other errors as failed and renders failure list', async () => {
    mockMutateAsyncStudentAdd
      .mockResolvedValueOnce({ student: {} })
      .mockRejectedValueOnce(new Error('Network error 500'));

    render(
      <ClassroomBulkInviteDialog
        open={true}
        onOpenChange={vi.fn()}
        courseId="c-101"
        courseName="수학 101"
      />,
    );

    fireEvent.click(screen.getByTestId('bulk-invite-class-btn-1-1'));
    fireEvent.click(screen.getByTestId('bulk-invite-preview-btn'));

    const confirmInput = screen.getByTestId('bulk-invite-confirm-input');
    fireEvent.change(confirmInput, { target: { value: '2' } });

    await act(async () => {
      fireEvent.click(screen.getByTestId('bulk-invite-execute-btn'));
    });

    const doneEl = screen.getByTestId('bulk-invite-done');
    expect(doneEl).toBeDefined();
    expect(doneEl.textContent).toContain('1명 성공');
    expect(doneEl.textContent).toContain('1명 실패');

    const failureList = screen.getByTestId('bulk-invite-failures');
    expect(failureList).toBeDefined();
    expect(failureList.textContent).toContain('s102@cam.hs.kr');
    expect(failureList.textContent).toContain('Network error 500');
  });

  // 시나리오 8: 완료 후 「확인」 클릭 -> onOpenChange(false) + onDone() 호출
  it('scenario 8: calls onOpenChange(false) and onDone when confirm button is clicked in done phase', async () => {
    mockMutateAsyncStudentAdd.mockResolvedValue({ student: {} });

    const onOpenChange = vi.fn();
    const onDone = vi.fn();
    render(
      <ClassroomBulkInviteDialog
        open={true}
        onOpenChange={onOpenChange}
        courseId="c-101"
        courseName="수학 101"
        onDone={onDone}
      />,
    );

    fireEvent.click(screen.getByTestId('bulk-invite-class-btn-1-1'));
    fireEvent.click(screen.getByTestId('bulk-invite-preview-btn'));

    fireEvent.change(screen.getByTestId('bulk-invite-confirm-input'), {
      target: { value: '2' },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('bulk-invite-execute-btn'));
    });

    const confirmBtn = screen.getByRole('button', { name: '확인' });
    fireEvent.click(confirmBtn);

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
