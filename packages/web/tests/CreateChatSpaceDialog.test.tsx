import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockMutateAsync = vi.fn();
let mockIsPending = false;
let mockError: Error | null = null;

vi.mock('../src/api/chatCreate', () => ({
  useCreateChatSpace: () => ({
    mutateAsync: mockMutateAsync,
    isPending: mockIsPending,
    error: mockError,
  }),
}));

import { CreateChatSpaceDialog } from '../src/routes/admin/CreateChatSpaceDialog';

describe('CreateChatSpaceDialog component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsPending = false;
    mockError = null;
  });

  // 시나리오 1: open=false -> 컨텐츠 렌더 안 됨
  it('scenario 1: does not render dialog content when open is false', () => {
    render(<CreateChatSpaceDialog open={false} onOpenChange={vi.fn()} />);

    expect(screen.queryByText('새 챗방 생성')).toBeNull();
    expect(screen.queryByTestId('create-chat-name-input')).toBeNull();
    expect(screen.queryByTestId('create-chat-submit')).toBeNull();
  });

  // 시나리오 2: open=true -> input 렌더 · 초기값 빈 문자열
  it('scenario 2: renders dialog title and input with initial empty string when open is true', () => {
    render(<CreateChatSpaceDialog open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText('새 챗방 생성')).toBeDefined();
    expect(screen.getByText('Google Chat 스페이스를 새로 만듭니다.')).toBeDefined();
    const input = screen.getByTestId('create-chat-name-input') as HTMLInputElement;
    expect(input).toBeDefined();
    expect(input.value).toBe('');
    expect(screen.getByTestId('create-chat-submit')).toBeDefined();
  });

  // 시나리오 3: 빈 이름 submit -> validation error
  it('scenario 3: displays validation error on empty or whitespace displayName submit', async () => {
    render(<CreateChatSpaceDialog open={true} onOpenChange={vi.fn()} />);

    const input = screen.getByTestId('create-chat-name-input');
    const submitBtn = screen.getByTestId('create-chat-submit');

    // 빈 문자열 제출
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.click(submitBtn);

    expect(mockMutateAsync).not.toHaveBeenCalled();
    const errorEl = screen.getByTestId('create-chat-validation-error');
    expect(errorEl).toBeDefined();
    expect(errorEl.textContent).toBe('챗방 이름이 필요합니다.');
  });

  // 시나리오 4: 유효 이름 submit -> mutation 호출 · 성공 시 onOpenChange(false)
  it('scenario 4: calls mutation with trimmed displayName and closes dialog on success', async () => {
    mockMutateAsync.mockResolvedValueOnce({
      space: { name: 'spaces/AAAA', displayName: '2026년 1학년 A반' },
    });
    const onOpenChange = vi.fn();

    render(<CreateChatSpaceDialog open={true} onOpenChange={onOpenChange} />);

    const input = screen.getByTestId('create-chat-name-input');
    fireEvent.change(input, { target: { value: '  2026년 1학년 A반  ' } });

    const submitBtn = screen.getByTestId('create-chat-submit');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        displayName: '2026년 1학년 A반',
      });
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('displays mutation error message when creation fails', () => {
    mockError = new Error('display_name_required');

    render(<CreateChatSpaceDialog open={true} onOpenChange={vi.fn()} />);

    const errorEl = screen.getByTestId('create-chat-error');
    expect(errorEl).toBeDefined();
    expect(errorEl.textContent).toContain('생성 실패: display_name_required');
  });

  it('closes dialog when cancel button is clicked', () => {
    const onOpenChange = vi.fn();
    render(<CreateChatSpaceDialog open={true} onOpenChange={onOpenChange} />);

    const cancelBtn = screen.getByText('취소');
    fireEvent.click(cancelBtn);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
