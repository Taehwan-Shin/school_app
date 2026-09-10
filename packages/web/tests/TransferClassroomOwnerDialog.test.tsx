import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockCallTransferOwnership = vi.fn();

vi.mock('../src/api/classroomTransferOwnership.js', async () => {
  const { useMutation, useQueryClient } =
    await import('@tanstack/react-query');
  return {
    callClassroomTransferOwnership: (data: unknown) => mockCallTransferOwnership(data),
    useClassroomTransferOwnership: () => {
      const queryClient = useQueryClient();
      return useMutation<
        { course: { id: string; ownerId?: string }; addedAsTeacher: boolean },
        Error,
        { courseId: string; newOwnerEmail: string }
      >({
        mutationFn: (data) => mockCallTransferOwnership(data),
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['classroom', 'list'] });
        },
      });
    },
  };
});

import { TransferClassroomOwnerDialog } from '../src/routes/admin/TransferClassroomOwnerDialog.js';

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('TransferClassroomOwnerDialog component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('target 이 null 이면 아무것도 렌더 안 함', () => {
    const { container } = renderWithClient(
      <TransferClassroomOwnerDialog
        open={true}
        onOpenChange={vi.fn()}
        target={null}
      />,
    );
    expect(container.querySelector('[data-testid="transfer-owner-submit-btn"]')).toBeNull();
  });

  it('이메일 형식 아니면 submit 버튼 disabled + hint 표시', () => {
    renderWithClient(
      <TransferClassroomOwnerDialog
        open={true}
        onOpenChange={vi.fn()}
        target={{ id: 'c-101', name: 'A반', currentOwnerId: 'old@example.com' }}
      />,
    );
    const submit = screen.getByTestId('transfer-owner-submit-btn') as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.change(screen.getByTestId('transfer-owner-email-input'), {
      target: { value: 'not-an-email' },
    });
    expect(submit.disabled).toBe(true);
    expect(screen.getByTestId('transfer-owner-email-hint')).toBeDefined();
  });

  it('현재 owner 와 같은 이메일이면 disabled + same hint', () => {
    renderWithClient(
      <TransferClassroomOwnerDialog
        open={true}
        onOpenChange={vi.fn()}
        target={{ id: 'c-101', currentOwnerId: 'owner@example.com' }}
      />,
    );
    const submit = screen.getByTestId('transfer-owner-submit-btn') as HTMLButtonElement;
    fireEvent.change(screen.getByTestId('transfer-owner-email-input'), {
      target: { value: 'OWNER@example.com' },
    });
    expect(submit.disabled).toBe(true);
    expect(screen.getByTestId('transfer-owner-same-hint')).toBeDefined();
  });

  it('정상 이메일 → callTransferOwnership 호출 · 성공 배너 표시', async () => {
    mockCallTransferOwnership.mockResolvedValueOnce({
      course: { id: 'c-101', ownerId: 'new@example.com' },
      addedAsTeacher: false,
    });
    const onSuccess = vi.fn();
    renderWithClient(
      <TransferClassroomOwnerDialog
        open={true}
        onOpenChange={vi.fn()}
        target={{ id: 'c-101', currentOwnerId: 'old@example.com' }}
        onSuccess={onSuccess}
      />,
    );
    fireEvent.change(screen.getByTestId('transfer-owner-email-input'), {
      target: { value: 'new@example.com' },
    });
    fireEvent.click(screen.getByTestId('transfer-owner-submit-btn'));

    await waitFor(() => {
      expect(mockCallTransferOwnership).toHaveBeenCalledWith({
        courseId: 'c-101',
        newOwnerEmail: 'new@example.com',
      });
    });
    await waitFor(() => {
      expect(screen.getByTestId('transfer-owner-success')).toBeDefined();
    });
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('addedAsTeacher=true 시 안내 문구 노출', async () => {
    mockCallTransferOwnership.mockResolvedValueOnce({
      course: { id: 'c-101', ownerId: 'new@example.com' },
      addedAsTeacher: true,
    });
    renderWithClient(
      <TransferClassroomOwnerDialog
        open={true}
        onOpenChange={vi.fn()}
        target={{ id: 'c-101' }}
      />,
    );
    fireEvent.change(screen.getByTestId('transfer-owner-email-input'), {
      target: { value: 'new@example.com' },
    });
    fireEvent.click(screen.getByTestId('transfer-owner-submit-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('transfer-owner-success').textContent).toContain(
        '교사로 자동 추가',
      );
    });
  });

  // v0.116c F77: server 가 partial 실패 (교사 추가는 됐으나 patch 실패) 시,
  // HttpsError.details 로 rollback 상태를 실어 던짐 → UI 는 rollback 별 맞춤 안내.
  it('F77: partial 실패 (rollback=ok) 시 "자동으로 다시 삭제됐습니다" 안내', async () => {
    const err = new Error('added_teacher_but_patch_failed:google_upstream_denied') as Error & {
      details?: unknown;
    };
    err.details = {
      addedTeacherButPatchFailed: true,
      rollback: 'ok',
      newOwnerEmail: 'new@example.com',
    };
    mockCallTransferOwnership.mockRejectedValueOnce(err);
    renderWithClient(
      <TransferClassroomOwnerDialog
        open={true}
        onOpenChange={vi.fn()}
        target={{ id: 'c-101' }}
      />,
    );
    fireEvent.change(screen.getByTestId('transfer-owner-email-input'), {
      target: { value: 'new@example.com' },
    });
    fireEvent.click(screen.getByTestId('transfer-owner-submit-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('transfer-owner-error').textContent).toContain(
        '자동으로 다시 삭제됐습니다',
      );
    });
  });

  it('F77: partial 실패 (rollback=failed) 시 "직접 정리" 안내', async () => {
    const err = new Error('added_teacher_but_patch_failed:...') as Error & {
      details?: unknown;
    };
    err.details = { addedTeacherButPatchFailed: true, rollback: 'failed' };
    mockCallTransferOwnership.mockRejectedValueOnce(err);
    renderWithClient(
      <TransferClassroomOwnerDialog
        open={true}
        onOpenChange={vi.fn()}
        target={{ id: 'c-101' }}
      />,
    );
    fireEvent.change(screen.getByTestId('transfer-owner-email-input'), {
      target: { value: 'new@example.com' },
    });
    fireEvent.click(screen.getByTestId('transfer-owner-submit-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('transfer-owner-error').textContent).toContain(
        '직접 정리',
      );
    });
  });

  it('F77: partial 실패 (rollback=skipped) 시 "직접 확인" 안내', async () => {
    const err = new Error('added_teacher_but_patch_failed:...') as Error & {
      details?: unknown;
    };
    err.details = { addedTeacherButPatchFailed: true, rollback: 'skipped' };
    mockCallTransferOwnership.mockRejectedValueOnce(err);
    renderWithClient(
      <TransferClassroomOwnerDialog
        open={true}
        onOpenChange={vi.fn()}
        target={{ id: 'c-101' }}
      />,
    );
    fireEvent.change(screen.getByTestId('transfer-owner-email-input'), {
      target: { value: 'new@example.com' },
    });
    fireEvent.click(screen.getByTestId('transfer-owner-submit-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('transfer-owner-error').textContent).toContain(
        '직접 확인',
      );
    });
  });

  it('server 실패 → error 배너 표시 · onSuccess 미호출', async () => {
    mockCallTransferOwnership.mockRejectedValueOnce(new Error('permission-denied: nope'));
    const onSuccess = vi.fn();
    renderWithClient(
      <TransferClassroomOwnerDialog
        open={true}
        onOpenChange={vi.fn()}
        target={{ id: 'c-101' }}
        onSuccess={onSuccess}
      />,
    );
    fireEvent.change(screen.getByTestId('transfer-owner-email-input'), {
      target: { value: 'new@example.com' },
    });
    fireEvent.click(screen.getByTestId('transfer-owner-submit-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('transfer-owner-error')).toBeDefined();
    });
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('open false → true 재열림 시 email 필드·result 초기화', async () => {
    mockCallTransferOwnership.mockResolvedValueOnce({
      course: { id: 'c-101', ownerId: 'new@example.com' },
      addedAsTeacher: false,
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TransferClassroomOwnerDialog
            open={true}
            onOpenChange={vi.fn()}
            target={{ id: 'c-101' }}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    fireEvent.change(screen.getByTestId('transfer-owner-email-input'), {
      target: { value: 'new@example.com' },
    });
    fireEvent.click(screen.getByTestId('transfer-owner-submit-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('transfer-owner-success')).toBeDefined();
    });

    rerender(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TransferClassroomOwnerDialog
            open={false}
            onOpenChange={vi.fn()}
            target={{ id: 'c-101' }}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    rerender(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TransferClassroomOwnerDialog
            open={true}
            onOpenChange={vi.fn()}
            target={{ id: 'c-101' }}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const input = screen.getByTestId('transfer-owner-email-input') as HTMLInputElement;
    expect(input.value).toBe('');
    expect(screen.queryByTestId('transfer-owner-success')).toBeNull();
  });
});
