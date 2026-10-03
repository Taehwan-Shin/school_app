import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockMembersList = vi.fn();
const mockMembersDelete = vi.fn();
const mockDownloadCsv = vi.fn();

vi.mock('../src/api/groupsList', () => ({
  useGroupsList: () => ({
    data: {
      groups: [
        { email: 'c23@cam.hs.kr', name: '2학년 3반', description: '', aliases: [], directMembersCount: 2 },
        { email: 'secret@cam.hs.kr', name: '비공개', description: '', aliases: [], directMembersCount: 0 },
      ],
    },
    isLoading: false,
    isError: false,
    error: null,
  }),
}));
vi.mock('../src/api/usersList', () => ({
  useUsersList: () => ({ data: { users: [{ email: 'a@cam.hs.kr', lastName: '홍', firstName: '길동' }] } }),
}));
vi.mock('../src/api/groupsMembersList', () => ({ callGroupsMembersList: (d: unknown) => mockMembersList(d) }));
vi.mock('../src/api/groupsMembersDelete', () => ({ callGroupsMembersDelete: (d: unknown) => mockMembersDelete(d) }));
vi.mock('../src/lib/csvExport', async (orig) => ({
  ...(await orig<typeof import('../src/lib/csvExport')>()),
  downloadCsv: (...a: unknown[]) => mockDownloadCsv(...a),
}));

import { GroupMembershipOverview } from '../src/routes/admin/GroupMembershipOverview';
import { toCsv } from '../src/lib/csvExport';

function renderIt() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <GroupMembershipOverview />
    </QueryClientProvider>,
  );
}

async function load() {
  fireEvent.click(screen.getByTestId('group-memberships-load'));
  await waitFor(() => expect(screen.getByTestId('group-memberships-table')).toBeTruthy());
}

describe('GroupMembershipOverview (v0.338 · 원본 fetchAllGroupAssignments)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMembersList.mockImplementation(async (d: { groupEmail: string; pageToken?: string }) => {
      if (d.groupEmail === 'secret@cam.hs.kr') throw new Error('google_upstream_denied');
      if (!d.pageToken) {
        return { members: [{ email: 'a@cam.hs.kr', role: 'MEMBER', type: 'USER', status: 'ACTIVE' }], nextPageToken: 'p2' };
      }
      return { members: [{ email: 'b@cam.hs.kr', role: 'OWNER', type: 'USER', status: 'ACTIVE' }], nextPageToken: null };
    });
  });

  it('불러오기 전에는 조회 안 함 → 불러오기 시 그룹별 페이지 끝까지 · 접근 실패 그룹 경고 · 이름 매핑', async () => {
    renderIt();
    expect(mockMembersList).not.toHaveBeenCalled();
    await load();
    expect(mockMembersList).toHaveBeenCalledTimes(3);
    const table = screen.getByTestId('group-memberships-table').textContent ?? '';
    expect(table).toContain('홍길동');
    expect(table).toContain('b@cam.hs.kr');
    expect(screen.getByTestId('group-memberships-errors').textContent).toContain('secret@cam.hs.kr');
    expect(screen.getByTestId('group-memberships-count').textContent).toContain('2 / 2');
  });

  it('검색 필터 + CSV 는 보이는 행만 (이름 포함)', async () => {
    renderIt();
    await load();
    fireEvent.change(screen.getByTestId('group-memberships-search'), { target: { value: '홍길동' } });
    expect(screen.getByTestId('group-memberships-count').textContent).toContain('1 / 2');
    fireEvent.click(screen.getByTestId('group-memberships-csv'));
    const rows = mockDownloadCsv.mock.calls[0][1];
    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual(['2학년 3반', 'c23@cam.hs.kr', '홍길동', 'a@cam.hs.kr', 'MEMBER', 'USER']);
  });

  it('선택 → 건수 확인 → 그룹에서 제외 · 성공 행 제거 · 실패 표시', async () => {
    mockMembersDelete.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('denied'));
    renderIt();
    await load();
    fireEvent.click(screen.getByTestId('group-memberships-select-all'));
    const btn = screen.getByTestId('group-memberships-remove') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.change(screen.getByTestId('group-memberships-remove-confirm-input'), { target: { value: '2' } });
    fireEvent.click(btn);
    await waitFor(() => expect(screen.getByTestId('group-memberships-banner').textContent).toContain('1건'));
    expect(mockMembersDelete).toHaveBeenNthCalledWith(1, { groupEmail: 'c23@cam.hs.kr', memberEmail: 'a@cam.hs.kr' });
    expect(screen.getByTestId('group-memberships-count').textContent).toContain('1 / 1');
    expect(screen.getByTestId('group-memberships-remove-failures').textContent).toContain('b@cam.hs.kr');
  });

  it('toCsv: 따옴표 이스케이프', () => {
    expect(toCsv([['a"b', 1]])).toBe('"a""b","1"');
  });
});
