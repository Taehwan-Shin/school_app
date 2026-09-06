import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const mockUseChatMembersList = vi.fn();

vi.mock('../src/api/chatMembersList', () => ({
  useChatMembersList: (spaceName: string | null, open: boolean) =>
    mockUseChatMembersList(spaceName, open),
}));

import { ChatSpaceMembersDialog } from '../src/routes/admin/ChatSpaceMembersDialog';

describe('ChatSpaceMembersDialog component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
