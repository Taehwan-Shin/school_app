import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockMutateAsync = vi.fn();
let mockIsPending = false;
let mockError: Error | null = null;

vi.mock('../src/api/chatDelete', () => ({
  useDeleteChatSpace: () => ({
    mutateAsync: mockMutateAsync,
    isPending: mockIsPending,
    error: mockError,
  }),
}));

import { DeleteChatSpaceDialog } from '../src/routes/admin/DeleteChatSpaceDialog';

describe('DeleteChatSpaceDialog component', () => {
  const targetSpace = {
    name: 'spaces/AAAA1234',
    displayName: '2026년 1학년 A반',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsPending = false;
    mockError = null;
  });

  // 시나리오 1: open=false -> 미렌더
  it('scenario 1: does not render dialog content when open is false', () => {
    render(<DeleteChatSpaceDialog open={false} onOpenChange={vi.fn()} space={targetSpace} />);

    expect(screen.queryByText('챗방 삭제 확인')).toBeNull();
    expect(screen.queryByTestId('delete-chat-confirm-input')).toBeNull();
    expect(screen.queryByTestId('delete-chat-submit')).toBeNull();
  });

  // 시나리오 2: open=true space 있음 -> 정보 표시 · confirm 버튼 disabled (빈 입력)
  it('scenario 2: renders target space info and disabled submit button initially', () => {
    render(<DeleteChatSpaceDialog open={true} onOpenChange={vi.fn()} space={targetSpace} />);

    expect(screen.getByText('챗방 삭제 확인')).toBeDefined();
    expect(screen.getByText('이 작업은 되돌릴 수 없습니다. 삭제된 챗방은 복구할 수 없습니다.')).toBeDefined();
    expect(screen.getByText('spaces/AAAA1234')).toBeDefined();
    expect(screen.getAllByText('2026년 1학년 A반').length).toBeGreaterThanOrEqual(1);

    const submitBtn = screen.getByTestId('delete-chat-submit') as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);
    expect(submitBtn.textContent).toBe('삭제');
  });

  // 시나리오 3: 정확히 타이핑 -> confirm enabled
  it('scenario 3: enables submit button only when typed text matches confirmPhrase exactly', () => {
    render(<DeleteChatSpaceDialog open={true} onOpenChange={vi.fn()} space={targetSpace} />);

    const input = screen.getByTestId('delete-chat-confirm-input') as HTMLInputElement;
    const submitBtn = screen.getByTestId('delete-chat-submit') as HTMLButtonElement;

    fireEvent.change(input, { target: { value: '잘못된 이름' } });
    expect(submitBtn.disabled).toBe(true);

    fireEvent.change(input, { target: { value: '2026년 1학년 A반' } });
    expect(submitBtn.disabled).toBe(false);
  });

  // 시나리오 4: submit -> mutation 호출 · 성공 시 onOpenChange(false)
  it('scenario 4: calls mutation with space name and closes dialog on success', async () => {
    mockMutateAsync.mockResolvedValueOnce({
      deleted: true,
      name: 'spaces/AAAA1234',
    });
    const onOpenChange = vi.fn();
    const onSuccess = vi.fn();

    render(
      <DeleteChatSpaceDialog
        open={true}
        onOpenChange={onOpenChange}
        space={targetSpace}
        onSuccess={onSuccess}
      />,
    );

    const input = screen.getByTestId('delete-chat-confirm-input');
    fireEvent.change(input, { target: { value: '2026년 1학년 A반' } });

    const submitBtn = screen.getByTestId('delete-chat-submit');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({ name: 'spaces/AAAA1234' });
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
  });

  // displayName 없을 때 name 으로 확인
  it('falls back to space name as confirmPhrase when displayName is missing', () => {
    const spaceWithoutDisplayName = {
      name: 'spaces/BBBB5678',
    };

    render(<DeleteChatSpaceDialog open={true} onOpenChange={vi.fn()} space={spaceWithoutDisplayName} />);

    const input = screen.getByTestId('delete-chat-confirm-input') as HTMLInputElement;
    const submitBtn = screen.getByTestId('delete-chat-submit') as HTMLButtonElement;

    fireEvent.change(input, { target: { value: 'spaces/BBBB5678' } });
    expect(submitBtn.disabled).toBe(false);
  });

  // 오류 메시지 표시
  it('displays error message when deletion fails', () => {
    mockError = new Error('permission-denied: insufficient permissions');

    render(<DeleteChatSpaceDialog open={true} onOpenChange={vi.fn()} space={targetSpace} />);

    const errorEl = screen.getByTestId('delete-chat-error');
    expect(errorEl).toBeDefined();
    expect(errorEl.textContent).toBe('챗방 삭제 권한이 없거나 스코프가 부족합니다.');
  });

  // 취소 버튼
  it('closes dialog when cancel button is clicked', () => {
    const onOpenChange = vi.fn();
    render(<DeleteChatSpaceDialog open={true} onOpenChange={onOpenChange} space={targetSpace} />);

    const cancelBtn = screen.getByText('취소');
    fireEvent.click(cancelBtn);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
