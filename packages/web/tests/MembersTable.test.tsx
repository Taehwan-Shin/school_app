import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

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

vi.mock('../src/api/groupsMembersUpdate.js', () => ({
  useUpdateMemberRole: () => ({
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
    const ownerRow = screen.getByTestId('member-row-owner@cam.hs.kr');
    expect(ownerRow).toBeDefined();
    const ownerRoleCell = within(ownerRow).getByText('OWNER');
    expect(ownerRoleCell.className).toContain('font-medium');

    const memberRow = screen.getByTestId('member-row-member@cam.hs.kr');
    expect(memberRow).toBeDefined();
    const memberRoleCell = within(memberRow).getByText('MEMBER');
    expect(memberRoleCell.className).not.toContain('font-medium');

    expect(screen.getByTestId('edit-role-btn-owner@cam.hs.kr')).toBeDefined();
    expect(screen.getByTestId('edit-role-btn-member@cam.hs.kr')).toBeDefined();
    expect(screen.getByTestId('remove-member-owner@cam.hs.kr')).toBeDefined();
    expect(screen.getByTestId('remove-member-member@cam.hs.kr')).toBeDefined();
  });

  it('opens edit member role dialog when role edit button is clicked', () => {
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
      hasMore: false,
      loadMore: vi.fn(),
      reload: vi.fn(),
    });

    render(<MembersTable groupEmail={defaultGroupEmail} />);

    expect(screen.queryByTestId('edit-member-role-dialog')).toBeNull();

    const editBtn = screen.getByTestId('edit-role-btn-member@cam.hs.kr');
    fireEvent.click(editBtn);

    expect(screen.getByTestId('edit-member-role-dialog')).toBeDefined();
    expect(screen.getByText('그룹 멤버 역할 변경')).toBeDefined();
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

  it('filters members by email search query', () => {
    const mockMembers = [
      { email: 'alice@cam.hs.kr', role: 'MEMBER' as const, type: 'USER' as const, status: 'ACTIVE' },
      { email: 'bob@cam.hs.kr', role: 'MEMBER' as const, type: 'USER' as const, status: 'ACTIVE' },
      { email: 'carol@cam.hs.kr', role: 'MEMBER' as const, type: 'USER' as const, status: 'ACTIVE' },
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

    expect(screen.getByTestId('member-row-alice@cam.hs.kr')).toBeDefined();
    expect(screen.getByTestId('member-row-bob@cam.hs.kr')).toBeDefined();
    expect(screen.getByTestId('member-row-carol@cam.hs.kr')).toBeDefined();

    const searchInput = screen.getByTestId('members-search-input');
    fireEvent.change(searchInput, { target: { value: 'alice@' } });

    expect(screen.getByTestId('member-row-alice@cam.hs.kr')).toBeDefined();
    expect(screen.queryByTestId('member-row-bob@cam.hs.kr')).toBeNull();
    expect(screen.queryByTestId('member-row-carol@cam.hs.kr')).toBeNull();
    expect(screen.getByText('1명 표시됨 / 전체 3명')).toBeDefined();
  });

  it('filters members by role chip selection', () => {
    const mockMembers = [
      { email: 'owner@cam.hs.kr', role: 'OWNER' as const, type: 'USER' as const, status: 'ACTIVE' },
      { email: 'manager@cam.hs.kr', role: 'MANAGER' as const, type: 'USER' as const, status: 'ACTIVE' },
      { email: 'member@cam.hs.kr', role: 'MEMBER' as const, type: 'USER' as const, status: 'ACTIVE' },
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

    const ownerChip = screen.getByTestId('members-role-chip-OWNER');
    fireEvent.click(ownerChip);

    expect(screen.getByTestId('member-row-owner@cam.hs.kr')).toBeDefined();
    expect(screen.queryByTestId('member-row-manager@cam.hs.kr')).toBeNull();
    expect(screen.queryByTestId('member-row-member@cam.hs.kr')).toBeNull();
    expect(screen.getByText('1명 표시됨 / 전체 3명')).toBeDefined();
  });

  it('displays empty search result message when no members match filter', () => {
    const mockMembers = [
      { email: 'alice@cam.hs.kr', role: 'MEMBER' as const, type: 'USER' as const, status: 'ACTIVE' },
      { email: 'bob@cam.hs.kr', role: 'MEMBER' as const, type: 'USER' as const, status: 'ACTIVE' },
      { email: 'carol@cam.hs.kr', role: 'MEMBER' as const, type: 'USER' as const, status: 'ACTIVE' },
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

    const searchInput = screen.getByTestId('members-search-input');
    fireEvent.change(searchInput, { target: { value: 'nonexistent@' } });

    expect(screen.getByTestId('members-search-empty')).toBeDefined();
    expect(screen.getByText('검색·필터에 맞는 멤버가 없습니다.')).toBeDefined();
    expect(screen.queryByTestId('member-row-alice@cam.hs.kr')).toBeNull();
  });

  it('enables CSV export button when members exist and disables when filtered to 0', async () => {
    const mockMembers = [
      { email: 'alice@cam.hs.kr', role: 'MEMBER' as const, type: 'USER' as const, status: 'ACTIVE' },
      { email: 'bob@cam.hs.kr', role: 'OWNER' as const, type: 'GROUP' as const, status: 'ACTIVE' },
      { email: 'carol@cam.hs.kr', role: 'MANAGER' as const, type: 'USER' as const, status: 'ACTIVE' },
    ];
    mockUseGroupMembersList.mockReturnValue({
      members: mockMembers,
      loading: false,
      error: null,
      hasMore: false,
      loadMore: vi.fn(),
      reload: vi.fn(),
    });

    let createdBlob: Blob | null = null;
    let createdAnchor: HTMLAnchorElement | null = null;
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const mockCreateObjectURL = vi.fn((blob: Blob) => {
      createdBlob = blob;
      return 'blob:mock-url';
    });
    const mockRevokeObjectURL = vi.fn();
    URL.createObjectURL = mockCreateObjectURL;
    URL.revokeObjectURL = mockRevokeObjectURL;

    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
      const el = originalCreateElement(tagName, options);
      if (tagName === 'a') {
        createdAnchor = el as HTMLAnchorElement;
      }
      return el;
    }) as typeof document.createElement);
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    try {
      render(<MembersTable groupEmail={defaultGroupEmail} />);

      const exportBtn = screen.getByTestId('members-export-csv-btn') as HTMLButtonElement;
      expect(exportBtn).toBeDefined();
      expect(exportBtn.disabled).toBe(false);

      fireEvent.click(exportBtn);

      expect(mockCreateObjectURL).toHaveBeenCalledTimes(1);
      expect(createdAnchor?.download).toMatch(/^members-group-a-\d{4}-\d{2}-\d{2}\.csv$/);
      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

      if (createdBlob) {
        const buf = await (createdBlob as Blob).arrayBuffer();
        const bytes = new Uint8Array(buf);
        expect(bytes[0]).toBe(0xEF);
        expect(bytes[1]).toBe(0xBB);
        expect(bytes[2]).toBe(0xBF);

        const text = await (createdBlob as Blob).text();
        expect(text.startsWith('"이메일","역할","타입"')).toBe(true);
        expect(text).toContain('"alice@cam.hs.kr","MEMBER","USER"');
        expect(text).toContain('"bob@cam.hs.kr","OWNER","GROUP"');
        expect(text).toContain('"carol@cam.hs.kr","MANAGER","USER"');
      }

      const searchInput = screen.getByTestId('members-search-input');
      fireEvent.change(searchInput, { target: { value: 'nonexistent@' } });

      expect(exportBtn.disabled).toBe(true);
    } finally {
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
      createElementSpy.mockRestore();
      clickSpy.mockRestore();
    }
  });
});
