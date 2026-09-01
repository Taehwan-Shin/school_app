import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const mockUseGroupMembersList = vi.fn();

vi.mock('../src/api/groupsMembersList.js', () => ({
  useGroupMembersList: (groupEmail: string, pageSize?: number) =>
    mockUseGroupMembersList(groupEmail, pageSize),
}));

vi.mock('../src/api/groupsMembersInsert.js', () => ({
  useAddMember: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
  }),
}));

vi.mock('../src/api/groupsMembersDelete.js', () => ({
  useRemoveMember: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
  }),
}));

import { MembersTable } from '../src/routes/admin/MembersTable.js';

describe('MembersTable component', () => {
  const defaultGroupEmail = 'group-a@cam.hs.kr';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state indicator while data is fetching', () => {
    mockUseGroupMembersList.mockReturnValue({
      members: [],
      loading: true,
      error: null,
      hasMore: false,
      loadMore: vi.fn(),
      reload: vi.fn(),
    });

    render(<MembersTable groupEmail={defaultGroupEmail} />);
    expect(screen.getByTestId('members-loading')).toBeDefined();
    expect(screen.getByText('멤버 목록을 불러오는 중...')).toBeDefined();
  });

  it('renders error message on error', () => {
    mockUseGroupMembersList.mockReturnValue({
      members: [],
      loading: false,
      error: new Error('permission-denied'),
      hasMore: false,
      loadMore: vi.fn(),
      reload: vi.fn(),
    });

    render(<MembersTable groupEmail={defaultGroupEmail} />);
    expect(screen.getByTestId('members-error')).toBeDefined();
    expect(
      screen.getByText('멤버 목록을 조회할 권한이 없거나 스코프가 부족합니다.')
    ).toBeDefined();
  });

  it('renders empty message when no members exist', () => {
    mockUseGroupMembersList.mockReturnValue({
      members: [],
      loading: false,
      error: null,
      hasMore: false,
      loadMore: vi.fn(),
      reload: vi.fn(),
    });

    render(<MembersTable groupEmail={defaultGroupEmail} />);
    expect(screen.getByTestId('members-empty')).toBeDefined();
    expect(screen.getByText('멤버가 없습니다.')).toBeDefined();
  });

  it('renders table rows accurately for members', () => {
    const mockMembers = [
      {
        email: 'owner@cam.hs.kr',
        role: 'OWNER' as const,
        type: 'USER' as const,
        status: 'ACTIVE',
      },
      {
        email: 'member@cam.hs.kr',
        role: 'MEMBER' as const,
        type: 'USER' as const,
        status: 'ACTIVE',
      },
    ];

    mockUseGroupMembersList.mockReturnValue({
      members: mockMembers,
      loading: false,
      error: null,
      hasMore: false,
      loadMore: vi.fn(),
      reload: vi.fn(),
    });

    render(<MembersTable groupEmail={defaultGroupEmail} />);

    expect(screen.getByText('2명 멤버')).toBeDefined();
    expect(screen.getByTestId('member-row-owner@cam.hs.kr')).toBeDefined();
    expect(screen.getByTestId('member-row-member@cam.hs.kr')).toBeDefined();

    const ownerRoleCell = screen.getByText('OWNER');
    expect(ownerRoleCell.className).toContain('font-medium');

    const memberRoleCell = screen.getByText('MEMBER');
    expect(memberRoleCell.className).not.toContain('font-medium');

    expect(screen.getByTestId('remove-member-owner@cam.hs.kr')).toBeDefined();
    expect(screen.getByTestId('remove-member-member@cam.hs.kr')).toBeDefined();
  });

  it('calls loadMore when more button is clicked', () => {
    const mockLoadMore = vi.fn();
    mockUseGroupMembersList.mockReturnValue({
      members: [
        {
          email: 'member@cam.hs.kr',
          role: 'MEMBER' as const,
          type: 'USER' as const,
          status: 'ACTIVE',
        },
      ],
      loading: false,
      error: null,
      hasMore: true,
      loadMore: mockLoadMore,
      reload: vi.fn(),
    });

    render(<MembersTable groupEmail={defaultGroupEmail} />);
    const loadMoreBtn = screen.getByTestId('load-more-btn');
    expect(loadMoreBtn).toBeDefined();

    fireEvent.click(loadMoreBtn);
    expect(mockLoadMore).toHaveBeenCalledTimes(1);
  });
});
