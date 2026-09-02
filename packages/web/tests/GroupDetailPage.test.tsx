import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { GroupDetailPage } from '../src/routes/admin/groupDetail';
import type { GroupItem } from '../src/api/groupsList';

vi.mock('../src/api/groupsUpdate', () => ({
  useUpdateGroup: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
  }),
}));

vi.mock('../src/api/groupsDelete', () => ({
  useDeleteGroup: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
  }),
}));

const mockUseGroupsList = vi.fn();
const mockUseAuditLogList = vi.fn();
const mockUseGroupMembersList = vi.fn();

vi.mock('../src/lib/auth', () => ({
  useAuth: () => ({
    user: { email: 'admin@cam.hs.kr' },
    role: 'admin',
    loading: false,
  }),
  signOut: vi.fn(),
}));

vi.mock('../src/lib/theme', () => ({
  useTheme: () => ({
    theme: 'light',
    toggleTheme: vi.fn(),
    setTheme: vi.fn(),
  }),
}));

vi.mock('../src/api/groupsList', () => ({
  useGroupsList: (enabled?: boolean, options?: any) => mockUseGroupsList(enabled, options),
}));

vi.mock('../src/api/auditLogList', () => ({
  useAuditLogList: (pageSize?: number, filters?: any) => mockUseAuditLogList(pageSize, filters),
}));

vi.mock('../src/api/groupsMembersList', () => ({
  useGroupMembersList: (groupEmail: string, pageSize?: number) =>
    mockUseGroupMembersList(groupEmail, pageSize),
}));

vi.mock('../src/api/groupsMembersInsert', () => ({
  useAddMember: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
  }),
}));

vi.mock('../src/api/groupsMembersDelete', () => ({
  useRemoveMember: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
  }),
}));

function renderDetailPage(initialEmail = 'teachers@cam.hs.kr') {
  return render(
    <MemoryRouter initialEntries={[`/admin/groups/${encodeURIComponent(initialEmail)}`]}>
      <Routes>
        <Route path="/admin/groups/:email" element={<GroupDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('GroupDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuditLogList.mockReturnValue({
      entries: [],
      loading: false,
      error: null,
      hasMore: false,
      loadMore: vi.fn(),
      reload: vi.fn(),
    });
    mockUseGroupMembersList.mockReturnValue({
      members: [],
      loading: false,
      error: null,
      hasMore: false,
      loadMore: vi.fn(),
      reload: vi.fn(),
    });
  });

  it('scenario 1: useGroupsList loading - renders loading text', () => {
    mockUseGroupsList.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    });

    renderDetailPage('teachers@cam.hs.kr');

    expect(screen.getByText('불러오는 중...')).toBeDefined();
    expect(screen.queryByTestId('group-detail-info')).toBeNull();
    expect(screen.getByText('멤버 관리')).toBeDefined();
    expect(screen.getByText('감사 이력')).toBeDefined();
  });

  it('scenario 2: group exists - renders group-detail-info with email, name, description, and directMembersCount', () => {
    const mockGroups: GroupItem[] = [
      {
        email: 'teachers@cam.hs.kr',
        name: '교사 그룹',
        description: '전체 교사 그룹입니다.',
        aliases: [],
        directMembersCount: 15,
      },
    ];

    mockUseGroupsList.mockReturnValue({
      data: { groups: mockGroups },
      isLoading: false,
      isError: false,
      error: null,
    });

    renderDetailPage('teachers@cam.hs.kr');

    expect(screen.getByText('그룹: teachers@cam.hs.kr')).toBeDefined();
    expect(screen.getByText('← 그룹 목록')).toBeDefined();

    const infoCard = screen.getByTestId('group-detail-info');
    expect(infoCard).toBeDefined();
    expect(within(infoCard).getByText('teachers@cam.hs.kr')).toBeDefined();
    expect(within(infoCard).getByText('교사 그룹')).toBeDefined();
    expect(within(infoCard).getByText('전체 교사 그룹입니다.')).toBeDefined();
    expect(within(infoCard).getByText('15')).toBeDefined();

    expect(screen.getByText('멤버 관리')).toBeDefined();
    expect(screen.getByText('감사 이력')).toBeDefined();
    expect(
      screen.getByText('이 그룹을 대상으로 발생한 모든 관리자 행위의 기록입니다.')
    ).toBeDefined();
    expect(mockUseAuditLogList).toHaveBeenCalledWith(25, { filterTarget: 'teachers@cam.hs.kr' });
  });

  it('scenario 3: group not found - renders group-detail-not-found message', () => {
    mockUseGroupsList.mockReturnValue({
      data: { groups: [] },
      isLoading: false,
      isError: false,
      error: null,
    });

    renderDetailPage('notfound@cam.hs.kr');

    expect(screen.getByTestId('group-detail-not-found')).toBeDefined();
    expect(screen.getByText('그룹을 찾을 수 없습니다: notfound@cam.hs.kr')).toBeDefined();
    expect(screen.queryByTestId('group-detail-info')).toBeNull();
    expect(screen.getByText('멤버 관리')).toBeDefined();
    expect(screen.getByText('감사 이력')).toBeDefined();
  });

  it('scenario 4: clicking "편집" opens EditGroupDialog', () => {
    const mockGroups: GroupItem[] = [
      {
        email: 'teachers@cam.hs.kr',
        name: '교사 그룹',
        description: '전체 교사 그룹입니다.',
        aliases: [],
        directMembersCount: 15,
      },
    ];

    mockUseGroupsList.mockReturnValue({
      data: { groups: mockGroups },
      isLoading: false,
      isError: false,
      error: null,
    });

    renderDetailPage('teachers@cam.hs.kr');

    const editBtn = screen.getByTestId('group-detail-edit-teachers@cam.hs.kr');
    expect(editBtn).toBeDefined();

    fireEvent.click(editBtn);

    expect(screen.getByText('그룹 편집')).toBeDefined();
    expect(screen.getByTestId('edit-group-submit')).toBeDefined();
  });

  it('scenario 5: clicking "삭제" opens DeleteGroupDialog', () => {
    const mockGroups: GroupItem[] = [
      {
        email: 'teachers@cam.hs.kr',
        name: '교사 그룹',
        description: '전체 교사 그룹입니다.',
        aliases: [],
        directMembersCount: 15,
      },
    ];

    mockUseGroupsList.mockReturnValue({
      data: { groups: mockGroups },
      isLoading: false,
      isError: false,
      error: null,
    });

    renderDetailPage('teachers@cam.hs.kr');

    const deleteBtn = screen.getByTestId('group-detail-delete-teachers@cam.hs.kr');
    expect(deleteBtn).toBeDefined();

    fireEvent.click(deleteBtn);

    expect(screen.getByText('그룹 삭제 확인')).toBeDefined();
    expect(screen.getByTestId('delete-group-submit')).toBeDefined();
  });
});
