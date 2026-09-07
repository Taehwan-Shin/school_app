import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockUseChatMembersList = vi.fn();
const mockDeleteMutateAsync = vi.fn();
const mockDeleteReset = vi.fn();
let mockDeleteIsPending = false;
let mockDeleteIsError = false;
let mockDeleteError: Error | null = null;

const mockAddMutateAsync = vi.fn();
const mockAddReset = vi.fn();
let mockAddIsPending = false;
let mockAddIsError = false;
let mockAddError: Error | null = null;

vi.mock('../src/api/chatMembersList', () => ({
  useChatMembersList: (spaceName: string | null, open: boolean) =>
    mockUseChatMembersList(spaceName, open),
}));

vi.mock('../src/api/chatMembersDelete', () => ({
  useChatMembersDelete: () => ({
    mutateAsync: mockDeleteMutateAsync,
    reset: mockDeleteReset,
    isPending: mockDeleteIsPending,
    isError: mockDeleteIsError,
    error: mockDeleteError,
  }),
}));

vi.mock('../src/api/chatMembersAdd', () => ({
  useChatMembersAdd: () => ({
    mutateAsync: mockAddMutateAsync,
    reset: mockAddReset,
    isPending: mockAddIsPending,
    isError: mockAddIsError,
    error: mockAddError,
  }),
}));

const mockChatBulkInviteDialog = vi.fn();
vi.mock('../src/routes/admin/ChatBulkInviteDialog', () => ({
  ChatBulkInviteDialog: (props: any) => {
    mockChatBulkInviteDialog(props);
    return null;
  },
}));

import { ChatSpaceMembersDialog } from '../src/routes/admin/ChatSpaceMembersDialog';

describe('ChatSpaceMembersDialog component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeleteIsPending = false;
    mockDeleteIsError = false;
    mockDeleteError = null;
    mockAddIsPending = false;
    mockAddIsError = false;
    mockAddError = null;
  });

  // 시나리오 1: open=false -> 미렌더
  it('scenario 1: does not render dialog content when open is false', () => {
    mockUseChatMembersList.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
    });

    render(
      <ChatSpaceMembersDialog
        open={false}
        onOpenChange={vi.fn()}
        spaceName="spaces/AAAA1234"
        displayName="2026년 1학년 A반"
      />,
    );

    expect(screen.queryByText('2026년 1학년 A반 멤버')).toBeNull();
    expect(screen.queryByTestId('chat-members-loading')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });

  // 시나리오 2: open=true + spaceName null -> 로딩 상태
  it('scenario 2: renders loading state when open is true and spaceName is null', () => {
    mockUseChatMembersList.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
    });

    render(
      <ChatSpaceMembersDialog
        open={true}
        onOpenChange={vi.fn()}
        spaceName={null}
      />,
    );

    expect(screen.getByTestId('chat-members-loading')).toBeDefined();
    expect(screen.getByText('로딩 중...')).toBeDefined();
  });

  // 시나리오 3: open=true + spaceName 있음 -> members mock 결과 렌더
  it('scenario 3: renders members table with mock data when open is true and spaceName is present', () => {
    const mockMembers = [
      {
        name: 'spaces/AAAA1234/members/user1',
        member: {
          name: 'users/12345',
          type: 'HUMAN',
          displayName: '김선생',
        },
        role: 'ROLE_MEMBER',
        state: 'JOINED',
      },
      {
        name: 'spaces/AAAA1234/members/user2',
        member: {
          name: 'users/67890',
          type: 'HUMAN',
        },
        role: 'ROLE_MANAGER',
        state: 'JOINED',
      },
    ];

    mockUseChatMembersList.mockReturnValue({
      data: { members: mockMembers },
      isLoading: false,
      isError: false,
      error: null,
    });

    render(
      <ChatSpaceMembersDialog
        open={true}
        onOpenChange={vi.fn()}
        spaceName="spaces/AAAA1234"
        displayName="2026년 1학년 A반"
      />,
    );

    expect(screen.getByText('2026년 1학년 A반 멤버')).toBeDefined();
    expect(screen.getByText('spaces/AAAA1234')).toBeDefined();
    expect(screen.getByText('이름/식별자')).toBeDefined();
    expect(screen.getByText('타입')).toBeDefined();
    expect(screen.getByText('역할')).toBeDefined();
    expect(screen.getByText('상태')).toBeDefined();

    expect(screen.getByTestId('chat-member-row-spaces/AAAA1234/members/user1')).toBeDefined();
    expect(screen.getByTestId('chat-member-row-spaces/AAAA1234/members/user2')).toBeDefined();

    expect(screen.getByText('김선생')).toBeDefined();
    expect(screen.getByText('users/67890')).toBeDefined();
    expect(screen.getByText('ROLE_MEMBER')).toBeDefined();
    expect(screen.getByText('ROLE_MANAGER')).toBeDefined();
    expect(screen.getAllByText('JOINED').length).toBe(2);
  });

  // 시나리오 4: 「닫기」 -> onOpenChange(false)
  it('scenario 4: calls onOpenChange(false) when close button is clicked', () => {
    mockUseChatMembersList.mockReturnValue({
      data: { members: [] },
      isLoading: false,
      isError: false,
      error: null,
    });

    const onOpenChange = vi.fn();
    render(
      <ChatSpaceMembersDialog
        open={true}
        onOpenChange={onOpenChange}
        spaceName="spaces/AAAA1234"
      />,
    );

    const closeBtns = screen.getAllByRole('button', { name: '닫기' });
    fireEvent.click(closeBtns[0]);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders error message when query fails', () => {
    mockUseChatMembersList.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('permission-denied'),
    });

    render(
      <ChatSpaceMembersDialog
        open={true}
        onOpenChange={vi.fn()}
        spaceName="spaces/AAAA1234"
      />,
    );

    expect(screen.getByTestId('chat-members-error')).toBeDefined();
    expect(screen.getByText('오류: permission-denied')).toBeDefined();
  });

  // 시나리오 5: 큰 목록 렌더 시 스크롤 컨테이너 존재 확인
  it('renders scroll container when members list is populated', async () => {
    const many = Array.from({ length: 50 }, (_, i) => ({
      name: `spaces/AAA/members/M${i}`,
      member: { name: `users/${i}`, type: 'HUMAN' },
      role: 'ROLE_MEMBER',
      state: 'JOINED',
    }));
    mockUseChatMembersList.mockReturnValue({
      data: { members: many },
      isLoading: false,
      isError: false,
      error: null,
    });

    render(
      <ChatSpaceMembersDialog
        open={true}
        spaceName="spaces/AAA"
        onOpenChange={vi.fn()}
      />,
    );

    const container = await screen.findByTestId('chat-members-scroll-container');
    expect(container.className).toMatch(/overflow-y-auto/);
    expect(container.className).toMatch(/max-h-/);
  });

  // 시나리오 6: 「+ 멤버 추가」 버튼 렌더
  it('scenario 6: renders "+ 멤버 추가" button and opens AddChatMemberDialog', () => {
    mockUseChatMembersList.mockReturnValue({
      data: { members: [] },
      isLoading: false,
      isError: false,
      error: null,
    });

    render(
      <ChatSpaceMembersDialog
        open={true}
        onOpenChange={vi.fn()}
        spaceName="spaces/AAAA1234"
        displayName="2026년 1학년 A반"
      />,
    );

    const addBtn = screen.getByTestId('chat-members-add-btn');
    expect(addBtn).toBeDefined();
    expect(addBtn.textContent).toContain('+ 멤버 추가');

    fireEvent.click(addBtn);
    expect(screen.getByTestId('add-chat-member-form')).toBeDefined();
  });

  // 시나리오 7: 각 행 「삭제」 버튼 렌더 · 클릭 시 2-step 확인 나타남
  it('scenario 7: renders delete button on each row and toggles 2-step confirmation on click', () => {
    const mockMembers = [
      {
        name: 'spaces/AAAA1234/members/user1',
        member: { name: 'users/12345', displayName: '김선생' },
        role: 'ROLE_MEMBER',
        state: 'JOINED',
      },
    ];

    mockUseChatMembersList.mockReturnValue({
      data: { members: mockMembers },
      isLoading: false,
      isError: false,
      error: null,
    });

    render(
      <ChatSpaceMembersDialog
        open={true}
        onOpenChange={vi.fn()}
        spaceName="spaces/AAAA1234"
      />,
    );

    const deleteBtn = screen.getByTestId('chat-member-delete-btn-spaces/AAAA1234/members/user1');
    expect(deleteBtn).toBeDefined();

    fireEvent.click(deleteBtn);

    expect(
      screen.getByTestId('chat-member-confirm-delete-btn-spaces/AAAA1234/members/user1'),
    ).toBeDefined();
    expect(
      screen.getByTestId('chat-member-cancel-delete-btn-spaces/AAAA1234/members/user1'),
    ).toBeDefined();

    // cancel click restores delete button
    fireEvent.click(
      screen.getByTestId('chat-member-cancel-delete-btn-spaces/AAAA1234/members/user1'),
    );
    expect(
      screen.getByTestId('chat-member-delete-btn-spaces/AAAA1234/members/user1'),
    ).toBeDefined();
  });

  // 시나리오 8: 「정말 삭제?」 -> callChatMembersDelete 호출
  it('scenario 8: calls mutateAsync when confirming delete', async () => {
    const mockMembers = [
      {
        name: 'spaces/AAAA1234/members/user1',
        member: { name: 'users/12345', displayName: '김선생' },
        role: 'ROLE_MEMBER',
        state: 'JOINED',
      },
    ];

    mockUseChatMembersList.mockReturnValue({
      data: { members: mockMembers },
      isLoading: false,
      isError: false,
      error: null,
    });

    mockDeleteMutateAsync.mockResolvedValueOnce({ ok: true });

    render(
      <ChatSpaceMembersDialog
        open={true}
        onOpenChange={vi.fn()}
        spaceName="spaces/AAAA1234"
      />,
    );

    fireEvent.click(
      screen.getByTestId('chat-member-delete-btn-spaces/AAAA1234/members/user1'),
    );
    fireEvent.click(
      screen.getByTestId('chat-member-confirm-delete-btn-spaces/AAAA1234/members/user1'),
    );

    await waitFor(() => {
      expect(mockDeleteMutateAsync).toHaveBeenCalledWith({
        memberName: 'spaces/AAAA1234/members/user1',
      });
    });
  });

  // 시나리오 9: 「학급 일괄 초대」 버튼 렌더
  it('scenario 9: renders "학급 일괄 초대" button next to "+ 멤버 추가"', () => {
    mockUseChatMembersList.mockReturnValue({
      data: { members: [] },
      isLoading: false,
      isError: false,
      error: null,
    });

    render(
      <ChatSpaceMembersDialog
        open={true}
        onOpenChange={vi.fn()}
        spaceName="spaces/AAAA1234"
        displayName="2026년 1학년 A반"
      />,
    );

    const bulkInviteBtn = screen.getByTestId('chat-members-bulk-invite-btn');
    expect(bulkInviteBtn).toBeDefined();
    expect(bulkInviteBtn.textContent).toContain('학급 일괄 초대');

    const addBtn = screen.getByTestId('chat-members-add-btn');
    expect(addBtn).toBeDefined();
  });

  // 시나리오 10: 「학급 일괄 초대」 클릭 시 bulkInviteOpen state 변경
  it('scenario 10: opens ChatBulkInviteDialog when "학급 일괄 초대" button is clicked', () => {
    mockUseChatMembersList.mockReturnValue({
      data: { members: [] },
      isLoading: false,
      isError: false,
      error: null,
    });

    render(
      <ChatSpaceMembersDialog
        open={true}
        onOpenChange={vi.fn()}
        spaceName="spaces/AAAA1234"
        displayName="2026년 1학년 A반"
      />,
    );

    // Initial state: bulkInviteOpen = false
    expect(mockChatBulkInviteDialog).toHaveBeenLastCalledWith(
      expect.objectContaining({
        open: false,
        spaceName: 'spaces/AAAA1234',
        spaceDisplayName: '2026년 1학년 A반',
      }),
    );

    const bulkInviteBtn = screen.getByTestId('chat-members-bulk-invite-btn');
    fireEvent.click(bulkInviteBtn);

    // After click: bulkInviteOpen = true
    expect(mockChatBulkInviteDialog).toHaveBeenLastCalledWith(
      expect.objectContaining({
        open: true,
        spaceName: 'spaces/AAAA1234',
        spaceDisplayName: '2026년 1학년 A반',
      }),
    );
  });
});
