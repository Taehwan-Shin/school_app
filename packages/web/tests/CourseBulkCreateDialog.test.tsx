import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockUseBasicDataGet = vi.fn();
const mockCallClassroomCreate = vi.fn();

vi.mock('../src/api/basicDataGet', () => ({
  useBasicDataGet: (year: number, enabled: boolean) => mockUseBasicDataGet(year, enabled),
}));

vi.mock('../src/api/classroomCreate', () => ({
  callClassroomCreate: (args: any) => mockCallClassroomCreate(args),
  useClassroomCreate: vi.fn(),
}));

import {
  CourseBulkCreateDialog,
  isAlreadyExistsError,
  isYearValid,
  courseName,
} from '../src/routes/admin/CourseBulkCreateDialog';

describe('CourseBulkCreateDialog component', () => {
  const mockBasicData = {
    year: 2026,
    grades: [
      { grade: 1, classes: ['1', '2'] },
      { grade: 2, classes: ['1', '2', '3'] },
    ],
    rosters: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseBasicDataGet.mockReturnValue({
      data: { data: mockBasicData },
      isLoading: false,
      isError: false,
      error: null,
    });
    mockCallClassroomCreate.mockResolvedValue({
      course: { id: 'c-new', name: '새 코스' },
    });
  });

  // helper tests
  it('helpers: isAlreadyExistsError detects duplicate/409 patterns', () => {
    expect(isAlreadyExistsError('Course already exists')).toBe(true);
    expect(isAlreadyExistsError('Duplicate course name')).toBe(true);
    expect(isAlreadyExistsError('Target resource exists')).toBe(true);
    expect(isAlreadyExistsError('http_409 conflict')).toBe(true);
    expect(isAlreadyExistsError('network error 500')).toBe(false);
  });

  it('helpers: courseName generates correct string format', () => {
    expect(courseName(2026, 1, '2')).toBe('2026학년도 1학년 2반');
    expect(courseName(2027, 3, '10')).toBe('2027학년도 3학년 10반');
  });

  it('helpers: isYearValid validates year range 1900-2200 and format', () => {
    expect(isYearValid('2026')).toBe(true);
    expect(isYearValid('1900')).toBe(true);
    expect(isYearValid('2200')).toBe(true);
    expect(isYearValid('1899')).toBe(false);
    expect(isYearValid('2201')).toBe(false);
    expect(isYearValid('')).toBe(false);
    expect(isYearValid('   ')).toBe(false);
    expect(isYearValid('abc')).toBe(false);
    expect(isYearValid('2026.5')).toBe(false);
  });

  // 시나리오 1: open=false -> 미렌더
  it('scenario 1: does not render dialog when open is false', () => {
    render(
      <CourseBulkCreateDialog
        open={false}
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.queryByText('학년/반 코스 일괄 생성')).toBeNull();
    expect(screen.queryByTestId('bulk-create-year-input')).toBeNull();
  });

  // 시나리오 2: year invalid 입력 -> selected 초기화 · preview 버튼 disabled
  it('scenario 2: resets class selection and disables preview button on invalid year inputs', () => {
    render(
      <CourseBulkCreateDialog
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    const yearInput = screen.getByTestId('bulk-create-year-input') as HTMLInputElement;
    const previewBtn = screen.getByTestId('bulk-create-preview-btn') as HTMLButtonElement;

    // Check a class checkbox
    const cb = screen.getByTestId('bulk-create-class-cb-1-1') as HTMLInputElement;
    fireEvent.click(cb);
    expect(cb.checked).toBe(true);
    expect(previewBtn.disabled).toBe(false);

    // Test invalid year values
    const invalidYears = ['abc', '1500', '', '2020.5', '2201'];
    for (const inv of invalidYears) {
      fireEvent.change(yearInput, { target: { value: inv } });
      expect(previewBtn.disabled).toBe(true);
    }

    // Change back to valid year -> selected was cleared so preview remains disabled
    fireEvent.change(yearInput, { target: { value: '2026' } });
    expect(previewBtn.disabled).toBe(true);
  });

  // 시나리오 3: 학년/반 체크 후 preview 진입 -> 코스 이름 pattern 렌더 · 총 수 표시
  it('scenario 3: renders course name pattern and total count upon entering preview phase', () => {
    render(
      <CourseBulkCreateDialog
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('bulk-create-class-cb-1-1'));
    fireEvent.click(screen.getByTestId('bulk-create-class-cb-2-3'));

    const previewBtn = screen.getByTestId('bulk-create-preview-btn') as HTMLButtonElement;
    expect(previewBtn.disabled).toBe(false);

    fireEvent.click(previewBtn);

    expect(screen.getByText('일괄 생성 대상 확인')).toBeDefined();
    expect(screen.getByText('총 2개 코스')).toBeDefined();

    const previewContainer = screen.getByTestId('bulk-create-preview');
    expect(previewContainer.textContent).toContain('2026학년도 1학년 1반');
    expect(previewContainer.textContent).toContain('2026학년도 2학년 3반');
  });

  // 시나리오 4: 확인 텍스트 오류 -> 「생성 실행」 disabled, 정상 입력 시 활성화
  it('scenario 4: disables execute button when confirm text does not match count', () => {
    render(
      <CourseBulkCreateDialog
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('bulk-create-class-cb-1-1'));
    fireEvent.click(screen.getByTestId('bulk-create-class-cb-1-2'));
    fireEvent.click(screen.getByTestId('bulk-create-preview-btn'));

    const confirmInput = screen.getByTestId('bulk-create-confirm-input') as HTMLInputElement;
    const executeBtn = screen.getByTestId('bulk-create-execute-btn') as HTMLButtonElement;

    expect(executeBtn.disabled).toBe(true);

    // Mismatched text
    fireEvent.change(confirmInput, { target: { value: '1' } });
    expect(executeBtn.disabled).toBe(true);

    fireEvent.change(confirmInput, { target: { value: 'abc' } });
    expect(executeBtn.disabled).toBe(true);

    // Matching count "2"
    fireEvent.change(confirmInput, { target: { value: '2' } });
    expect(executeBtn.disabled).toBe(false);
  });

  // 시나리오 5: 「생성 실행」 클릭 -> mock callClassroomCreate 순차 호출 (선택된 개수만큼)
  it('scenario 5: calls callClassroomCreate sequentially for each selected class and enters done phase', async () => {
    mockCallClassroomCreate
      .mockResolvedValueOnce({ course: { id: 'c-1-1', name: '2026학년도 1학년 1반' } })
      .mockResolvedValueOnce({ course: { id: 'c-1-2', name: '2026학년도 1학년 2반' } });

    render(
      <CourseBulkCreateDialog
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    // Custom owner and state
    fireEvent.change(screen.getByTestId('bulk-create-owner'), {
      target: { value: 'teacher@school.kr' },
    });
    fireEvent.change(screen.getByTestId('bulk-create-state'), {
      target: { value: 'ACTIVE' },
    });

    fireEvent.click(screen.getByTestId('bulk-create-class-cb-1-1'));
    fireEvent.click(screen.getByTestId('bulk-create-class-cb-1-2'));
    fireEvent.click(screen.getByTestId('bulk-create-preview-btn'));

    fireEvent.change(screen.getByTestId('bulk-create-confirm-input'), {
      target: { value: '2' },
    });

    const executeBtn = screen.getByTestId('bulk-create-execute-btn');
    await act(async () => {
      fireEvent.click(executeBtn);
    });

    expect(mockCallClassroomCreate).toHaveBeenCalledTimes(2);
    expect(mockCallClassroomCreate).toHaveBeenNthCalledWith(1, {
      name: '2026학년도 1학년 1반',
      section: '1-1',
      ownerId: 'teacher@school.kr',
      courseState: 'ACTIVE',
    });
    expect(mockCallClassroomCreate).toHaveBeenNthCalledWith(2, {
      name: '2026학년도 1학년 2반',
      section: '1-2',
      ownerId: 'teacher@school.kr',
      courseState: 'ACTIVE',
    });

    const doneEl = screen.getByTestId('bulk-create-done');
    expect(doneEl).toBeDefined();
    expect(doneEl.textContent).toContain('2개 생성');
  });

  // 시나리오 6: 이미 존재 오류 (409 · duplicate) -> skipped 분류 및 렌더
  it('scenario 6: classifies already exists/409 errors as skipped and renders skipped list', async () => {
    mockCallClassroomCreate
      .mockResolvedValueOnce({ course: { id: 'c-1-1', name: '2026학년도 1학년 1반' } })
      .mockRejectedValueOnce(new Error('Course already exists (http_409)'));

    render(
      <CourseBulkCreateDialog
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('bulk-create-class-cb-1-1'));
    fireEvent.click(screen.getByTestId('bulk-create-class-cb-1-2'));
    fireEvent.click(screen.getByTestId('bulk-create-preview-btn'));

    fireEvent.change(screen.getByTestId('bulk-create-confirm-input'), {
      target: { value: '2' },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('bulk-create-execute-btn'));
    });

    const doneEl = screen.getByTestId('bulk-create-done');
    expect(doneEl).toBeDefined();
    expect(doneEl.textContent).toContain('1개 생성');
    expect(doneEl.textContent).toContain('1개 이미 존재 (skip)');

    const skippedList = screen.getByTestId('bulk-create-skipped');
    expect(skippedList).toBeDefined();
    expect(skippedList.textContent).toContain('2026학년도 1학년 2반');
  });

  // 시나리오 7: 기타 오류 -> failed 분류 및 failures list 렌더
  it('scenario 7: classifies general errors as failed and renders failure list', async () => {
    mockCallClassroomCreate
      .mockResolvedValueOnce({ course: { id: 'c-1-1', name: '2026학년도 1학년 1반' } })
      .mockRejectedValueOnce(new Error('Network error 500'));

    render(
      <CourseBulkCreateDialog
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('bulk-create-class-cb-1-1'));
    fireEvent.click(screen.getByTestId('bulk-create-class-cb-1-2'));
    fireEvent.click(screen.getByTestId('bulk-create-preview-btn'));

    fireEvent.change(screen.getByTestId('bulk-create-confirm-input'), {
      target: { value: '2' },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('bulk-create-execute-btn'));
    });

    const doneEl = screen.getByTestId('bulk-create-done');
    expect(doneEl).toBeDefined();
    expect(doneEl.textContent).toContain('1개 생성');
    expect(doneEl.textContent).toContain('1개 실패');

    const failuresList = screen.getByTestId('bulk-create-failures');
    expect(failuresList).toBeDefined();
    expect(failuresList.textContent).toContain('2026학년도 1학년 2반');
    expect(failuresList.textContent).toContain('Network error 500');
  });

  // 시나리오 8: 종료 시 queryClient.invalidateQueries 1회 호출 (mock spy)
  it('scenario 8: does not invalidate queries during execution, calls invalidateQueries only once upon completion', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    let createCalls = 0;
    mockCallClassroomCreate.mockImplementation(async () => {
      createCalls++;
      expect(invalidateSpy).not.toHaveBeenCalled();
      return { course: { id: `c-${createCalls}` } };
    });

    render(
      <QueryClientProvider client={queryClient}>
        <CourseBulkCreateDialog
          open={true}
          onOpenChange={vi.fn()}
        />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByTestId('bulk-create-class-cb-1-1'));
    fireEvent.click(screen.getByTestId('bulk-create-class-cb-1-2'));
    fireEvent.click(screen.getByTestId('bulk-create-preview-btn'));

    fireEvent.change(screen.getByTestId('bulk-create-confirm-input'), {
      target: { value: '2' },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('bulk-create-execute-btn'));
    });

    expect(createCalls).toBe(2);
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['classroom', 'list'],
    });
  });

  // 시나리오 9: 전체 선택 / 전체 해제 동작
  it('scenario 9: select all and deselect all buttons select/deselect classes of that grade', () => {
    render(
      <CourseBulkCreateDialog
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    const cb1 = screen.getByTestId('bulk-create-class-cb-2-1') as HTMLInputElement;
    const cb2 = screen.getByTestId('bulk-create-class-cb-2-2') as HTMLInputElement;
    const cb3 = screen.getByTestId('bulk-create-class-cb-2-3') as HTMLInputElement;

    expect(cb1.checked).toBe(false);
    expect(cb2.checked).toBe(false);
    expect(cb3.checked).toBe(false);

    // Click select all for grade 2
    fireEvent.click(screen.getByTestId('bulk-create-select-all-2'));
    expect(cb1.checked).toBe(true);
    expect(cb2.checked).toBe(true);
    expect(cb3.checked).toBe(true);

    // Click deselect all for grade 2
    fireEvent.click(screen.getByTestId('bulk-create-deselect-all-2'));
    expect(cb1.checked).toBe(false);
    expect(cb2.checked).toBe(false);
    expect(cb3.checked).toBe(false);
  });

  // 시나리오 10: done phase 에서 「확인」 클릭 -> onOpenChange(false) 및 onDone 호출
  it('scenario 10: calls onOpenChange(false) and onDone when confirm button is clicked in done phase', async () => {
    const onOpenChange = vi.fn();
    const onDone = vi.fn();

    render(
      <CourseBulkCreateDialog
        open={true}
        onOpenChange={onOpenChange}
        onDone={onDone}
      />,
    );

    fireEvent.click(screen.getByTestId('bulk-create-class-cb-1-1'));
    fireEvent.click(screen.getByTestId('bulk-create-preview-btn'));
    fireEvent.change(screen.getByTestId('bulk-create-confirm-input'), {
      target: { value: '1' },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('bulk-create-execute-btn'));
    });

    const confirmBtn = screen.getByRole('button', { name: '확인' });
    fireEvent.click(confirmBtn);

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
