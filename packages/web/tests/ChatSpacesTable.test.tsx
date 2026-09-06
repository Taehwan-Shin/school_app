import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const mockUseChatList = vi.fn();

vi.mock('../src/api/chatList', () => ({
  useChatList: () => mockUseChatList(),
}));

vi.mock('../src/api/chatCreate', () => ({
  useCreateChatSpace: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
  }),
}));

import { ChatSpacesTable } from '../src/routes/admin/ChatSpacesTable';

describe('ChatSpacesTable component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('scenario 1: renders loading state indicator while data is fetching', () => {
    mockUseChatList.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    });

    render(<ChatSpacesTable />);
    expect(screen.getByTestId('chat-spaces-loading')).toBeDefined();
    expect(screen.getByText('챗방 목록을 불러오는 중...')).toBeDefined();
  });

  it('scenario 2: renders error message when request fails', () => {
    mockUseChatList.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('fetch_failed'),
    });

    render(<ChatSpacesTable />);
    expect(screen.getByTestId('chat-spaces-error')).toBeDefined();
    expect(screen.getByText('챗방 목록을 불러오지 못했습니다: fetch_failed')).toBeDefined();
  });

  it('scenario 3: renders empty message when spaces list is empty', () => {
    mockUseChatList.mockReturnValue({
      data: { spaces: [] },
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<ChatSpacesTable />);
    expect(screen.getByTestId('chat-spaces-empty')).toBeDefined();
    expect(screen.getByText('속한 챗방이 없습니다.')).toBeDefined();
  });

  it('scenario 4: renders table rows for spaces with testid chat-space-row-{name}', () => {
    const mockSpaces = [
      {
        name: 'spaces/AAAA',
        displayName: '1학년 교무실',
        spaceType: 'SPACE',
        createTime: '2026-09-01T00:00:00.000Z',
      },
      {
        name: 'spaces/BBBB',
        displayName: '',
        spaceType: 'GROUP_CHAT',
      },
    ];

    mockUseChatList.mockReturnValue({
      data: { spaces: mockSpaces },
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<ChatSpacesTable />);

    expect(screen.getByTestId('chat-space-row-spaces/AAAA')).toBeDefined();
    expect(screen.getByTestId('chat-space-row-spaces/BBBB')).toBeDefined();

    expect(screen.getByText('1학년 교무실')).toBeDefined();
    expect(screen.getByText('(무제)')).toBeDefined();
    expect(screen.getByText('SPACE')).toBeDefined();
    expect(screen.getByText('GROUP_CHAT')).toBeDefined();
    expect(screen.getByText('spaces/AAAA')).toBeDefined();
    expect(screen.getByText('spaces/BBBB')).toBeDefined();
  });

  it('scenario 5: renders "+ 챗방 추가" button and opens CreateChatSpaceDialog on click', () => {
    mockUseChatList.mockReturnValue({
      data: { spaces: [] },
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<ChatSpacesTable />);

    const createBtn = screen.getByTestId('chat-create-btn');
    expect(createBtn).toBeDefined();
    expect(createBtn.textContent).toContain('+ 챗방 추가');

    expect(screen.queryByText('새 챗방 생성')).toBeNull();

    fireEvent.click(createBtn);

    expect(screen.getByText('새 챗방 생성')).toBeDefined();
    expect(screen.getByTestId('create-chat-name-input')).toBeDefined();
    expect(screen.getByTestId('create-chat-submit')).toBeDefined();
  });
});
