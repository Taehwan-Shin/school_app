import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockMutateAsync = vi.fn();
let mockIsPending = false;
let mockError: Error | null = null;

vi.mock('../src/api/classroomDelete', () => ({
  useClassroomDelete: () => ({
    mutateAsync: mockMutateAsync,
    isPending: mockIsPending,
    error: mockError,
  }),
}));

import {
  DeleteClassroomDialog,
  type DeleteClassroomTarget,
} from '../src/routes/admin/DeleteClassroomDialog';

describe('DeleteClassroomDialog component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsPending = false;
    mockError = null;
  });

  // 시나리오 1: target null -> 미렌더
  it('scenario 1: does not render anything when target is null', () => {
    const { container } = render(
      <DeleteClassroomDialog
        open={true}
        onOpenChange={vi.fn()}
        target={null}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  // 시나리오 2: name 타이핑 필요 (일치할 때만 「삭제」 활성화)
  it('scenario 2: requires typing course name to enable delete button', async () => {
    const target: DeleteClassroomTarget = {
      id: 'c-101',
      name: '1학년 수학',
    };

    render(
      <DeleteClassroomDialog
        open={true}
        onOpenChange={vi.fn()}
        target={target}
      />,
    );

    const submitBtn = screen.getByTestId('delete-classroom-submit') as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);

    const input = screen.getByTestId('delete-classroom-confirm-input') as HTMLInputElement;

    // 잘못된 이름 타이핑
    fireEvent.change(input, { target: { value: '잘못된 이름' } });
    expect(submitBtn.disabled).toBe(true);

    // 정확한 이름 타이핑
    fireEvent.change(input, { target: { value: '1학년 수학' } });
    expect(submitBtn.disabled).toBe(false);
  });

  // 시나리오 3: mutation error -> error 배너 렌더
  it('scenario 3: renders error banner when mutation fails', () => {
    mockError = new Error('not-found: course not found');
    const target: DeleteClassroomTarget = {
      id: 'c-101',
      name: '1학년 수학',
    };

    render(
      <DeleteClassroomDialog
        open={true}
        onOpenChange={vi.fn()}
        target={target}
      />,
    );

    const errorBanner = screen.getByTestId('delete-classroom-error');
    expect(errorBanner).toBeDefined();
    expect(errorBanner.textContent).toContain('이미 삭제된 코스이거나 찾을 수 없습니다.');
  });

  // 시나리오 4: 성공 -> 다이얼로그 닫힘
  it('scenario 4: closes dialog on successful deletion', async () => {
    const onOpenChange = vi.fn();
    const onSuccess = vi.fn();
    const target: DeleteClassroomTarget = {
      id: 'c-101',
      name: '1학년 수학',
    };
    mockMutateAsync.mockResolvedValueOnce({ ok: true });

    render(
      <DeleteClassroomDialog
        open={true}
        onOpenChange={onOpenChange}
        target={target}
        onSuccess={onSuccess}
      />,
    );

    const input = screen.getByTestId('delete-classroom-confirm-input');
    fireEvent.change(input, { target: { value: '1학년 수학' } });

    const submitBtn = screen.getByTestId('delete-classroom-submit');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({ id: 'c-101' });
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(onSuccess).toHaveBeenCalled();
    });
  });
});
