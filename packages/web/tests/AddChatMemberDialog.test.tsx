import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockMutateAsync = vi.fn();
const mockReset = vi.fn();
let mockIsPending = false;
let mockIsError = false;
let mockError: Error | null = null;

vi.mock('../src/api/chatMembersAdd', () => ({
  useChatMembersAdd: () => ({
    mutateAsync: mockMutateAsync,
    reset: mockReset,
    isPending: mockIsPending,
    isError: mockIsError,
    error: mockError,
  }),
}));

import { AddChatMemberDialog } from '../src/routes/admin/AddChatMemberDialog';

describe('AddChatMemberDialog component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsPending = false;
    mockIsError = false;
    mockError = null;
  });

  // 시나리오 1: open=false -> 미렌더
  it('scenario 1: does not render dialog when open is false', () => {
    render(
      <AddChatMemberDialog
        open={false}
        onOpenChange={vi.fn()}
        spaceName="spaces/space-1"
        spaceDisplayName="테스트 스페이스"
      />,
    );

    expect(screen.queryByTestId('add-chat-member-form')).toBeNull();
    expect(screen.queryByText('테스트 스페이스 멤버 추가')).toBeNull();
  });

  // 시나리오 2: email 빈 문자열 -> submit disabled
  it('scenario 2: submit button is disabled when email is empty', () => {
    render(
      <AddChatMemberDialog
        open={true}
        onOpenChange={vi.fn()}
        spaceName="spaces/space-1"
        spaceDisplayName="테스트 스페이스"
      />,
    );

    const submitBtn = screen.getByTestId('add-chat-member-submit') as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);

    const emailInput = screen.getByTestId('add-chat-member-email');
    fireEvent.change(emailInput, { target: { value: '   ' } });
    expect(submitBtn.disabled).toBe(true);

    fireEvent.change(emailInput, { target: { value: 'user1@cam.hs.kr' } });
    expect(submitBtn.disabled).toBe(false);
  });

  // 시나리오 3: 정상 -> callChatMembersAdd (mutateAsync) 호출
  it('scenario 3: calls mutateAsync on submit and closes dialog', async () => {
    mockMutateAsync.mockResolvedValueOnce({
      member: {
        name: 'spaces/space-1/members/usr-123',
      },
    });

    const onOpenChange = vi.fn();
    const onSuccess = vi.fn();

    render(
      <AddChatMemberDialog
        open={true}
        onOpenChange={onOpenChange}
        spaceName="spaces/space-1"
        spaceDisplayName="테스트 스페이스"
        onSuccess={onSuccess}
      />,
    );

    const emailInput = screen.getByTestId('add-chat-member-email');
    fireEvent.change(emailInput, { target: { value: 'user1@cam.hs.kr' } });

    const form = screen.getByTestId('add-chat-member-form');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        spaceName: 'spaces/space-1',
        email: 'user1@cam.hs.kr',
      });
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
  });

  // 시나리오 4: mutation error -> error 배너 렌더
  it('scenario 4: renders error banner when mutation fails', () => {
    mockIsError = true;
    mockError = new Error('directory_user_not_found');

    render(
      <AddChatMemberDialog
        open={true}
        onOpenChange={vi.fn()}
        spaceName="spaces/space-1"
        spaceDisplayName="테스트 스페이스"
      />,
    );

    expect(screen.getByTestId('add-chat-member-error')).toBeDefined();
    expect(screen.getByText('directory_user_not_found')).toBeDefined();
  });
});
