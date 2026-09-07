import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockUseBasicDataGet = vi.fn();
const mockCallClassroomStudentsAdd = vi.fn();

vi.mock('../src/api/basicDataGet', () => ({
  useBasicDataGet: (year: number, enabled: boolean) => mockUseBasicDataGet(year, enabled),
}));

vi.mock('../src/api/classroomStudentsAdd', () => ({
  callClassroomStudentsAdd: (args: any) => mockCallClassroomStudentsAdd(args),
  useClassroomStudentsAdd: vi.fn(),
}));

import {
  ClassroomBulkInviteDialog,
  isAlreadyMemberError,
  isYearValid,
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
    mockCallClassroomStudentsAdd.mockResolvedValue({ student: {} });
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
    mockCallClassroomStudentsAdd.mockResolvedValue({ student: {} });

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

    expect(mockCallClassroomStudentsAdd).toHaveBeenCalledTimes(2);
    expect(mockCallClassroomStudentsAdd).toHaveBeenNthCalledWith(1, {
      courseId: 'c-101',
      userId: 's101@cam.hs.kr',
    });
    expect(mockCallClassroomStudentsAdd).toHaveBeenNthCalledWith(2, {
      courseId: 'c-101',
      userId: 's102@cam.hs.kr',
    });

    expect(screen.getByTestId('bulk-invite-done')).toBeDefined();
    expect(screen.getByTestId('bulk-invite-done').textContent).toContain('2명 성공');
  });

  // 시나리오 6: 이미 멤버 오류 -> skipped 로 분류 · skipped 리스트 렌더
  it('scenario 6: classifies duplicate errors as skipped and renders skipped list', async () => {
    mockCallClassroomStudentsAdd
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
    mockCallClassroomStudentsAdd
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
    mockCallClassroomStudentsAdd.mockResolvedValue({ student: {} });

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

  // 시나리오 10: year invalid ("abc" · "1500" · "" · "2020.5") 입력 -> selectedGrade/Class null 로 리셋 · preview 버튼 disabled
  it('scenario 10: resets class selection and disables preview button on invalid year inputs', () => {
    expect(isYearValid('abc')).toBe(false);
    expect(isYearValid('1500')).toBe(false);
    expect(isYearValid('')).toBe(false);
    expect(isYearValid('2020.5')).toBe(false);
    expect(isYearValid('2201')).toBe(false);
    expect(isYearValid('2026')).toBe(true);

    render(
      <ClassroomBulkInviteDialog
        open={true}
        onOpenChange={vi.fn()}
        courseId="c-101"
        courseName="수학 101"
      />,
    );

    const yearInput = screen.getByTestId('bulk-invite-year-input') as HTMLInputElement;
    const previewBtn = screen.getByTestId('bulk-invite-preview-btn') as HTMLButtonElement;

    // First select a class
    fireEvent.click(screen.getByTestId('bulk-invite-class-btn-1-1'));
    expect(screen.getByTestId('bulk-invite-preview')).toBeDefined();
    expect(previewBtn.disabled).toBe(false);

    // Test each invalid value
    const invalidValues = ['abc', '1500', '', '2020.5'];
    for (const invalidVal of invalidValues) {
      fireEvent.change(yearInput, { target: { value: invalidVal } });

      // selectedGrade/Class reset -> preview section hidden
      expect(screen.queryByTestId('bulk-invite-preview')).toBeNull();
      // preview button disabled
      expect(previewBtn.disabled).toBe(true);
    }
  });

  // 시나리오 11: year 유효 -> invalid -> 유효 시퀀스: 반 선택 초기화 확인
  it('scenario 11: resets class selection in valid -> invalid -> valid year sequence', () => {
    render(
      <ClassroomBulkInviteDialog
        open={true}
        onOpenChange={vi.fn()}
        courseId="c-101"
        courseName="수학 101"
      />,
    );

    const yearInput = screen.getByTestId('bulk-invite-year-input') as HTMLInputElement;
    const previewBtn = screen.getByTestId('bulk-invite-preview-btn') as HTMLButtonElement;

    // 1. Initial valid state (2026): select class 1-1
    fireEvent.click(screen.getByTestId('bulk-invite-class-btn-1-1'));
    expect(screen.getByTestId('bulk-invite-preview')).toBeDefined();
    expect(previewBtn.disabled).toBe(false);

    // 2. Change to invalid year
    fireEvent.change(yearInput, { target: { value: 'abc' } });
    expect(screen.queryByTestId('bulk-invite-preview')).toBeNull();
    expect(previewBtn.disabled).toBe(true);

    // 3. Change back to valid year (2026)
    fireEvent.change(yearInput, { target: { value: '2026' } });
    // Class selection remains cleared
    expect(screen.queryByTestId('bulk-invite-preview')).toBeNull();
    expect(previewBtn.disabled).toBe(true);
  });

  // 시나리오 12: execute 시 매 학생 add 마다 queryClient.invalidateQueries 미호출 · 종료 후 1회만 호출 (mock spy)
  it('scenario 12: does not call invalidateQueries during batch execute, calls it only once upon completion', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    let addCalls = 0;
    mockCallClassroomStudentsAdd.mockImplementation(async () => {
      addCalls++;
      expect(invalidateSpy).not.toHaveBeenCalled();
      return { student: {} };
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ClassroomBulkInviteDialog
          open={true}
          onOpenChange={vi.fn()}
          courseId="c-101"
          courseName="수학 101"
        />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByTestId('bulk-invite-class-btn-1-1'));
    fireEvent.click(screen.getByTestId('bulk-invite-preview-btn'));

    const confirmInput = screen.getByTestId('bulk-invite-confirm-input');
    fireEvent.change(confirmInput, { target: { value: '2' } });

    const executeBtn = screen.getByTestId('bulk-invite-execute-btn');
    await act(async () => {
      fireEvent.click(executeBtn);
    });

    expect(addCalls).toBe(2);
    expect(mockCallClassroomStudentsAdd).toHaveBeenCalledTimes(2);
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['classroom', 'students', 'c-101'],
    });
  });
});
