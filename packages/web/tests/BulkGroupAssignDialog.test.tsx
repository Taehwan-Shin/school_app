import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockInsert = vi.fn();
const mockDelete = vi.fn();
vi.mock('../src/api/groupsList', () => ({
  useGroupsList: () => ({
    data: {
      groups: [
        { email: 'c23@cam.hs.kr', name: '2학년 3반', description: '', aliases: [], directMembersCount: 0 },
        { email: 'club@cam.hs.kr', name: '동아리', description: '', aliases: [], directMembersCount: 0 },
      ],
    },
    isLoading: false,
    isError: false,
    error: null,
  }),
}));
vi.mock('../src/api/groupsMembersInsert', () => ({ callGroupsMembersInsert: (d: unknown) => mockInsert(d) }));
vi.mock('../src/api/groupsMembersDelete', () => ({ callGroupsMembersDelete: (d: unknown) => mockDelete(d) }));

import { BulkGroupAssignDialog } from '../src/routes/admin/BulkGroupAssignDialog';

function renderDialog(emails: string[], onDone = vi.fn()) {
  const qc = new QueryClient();
  render(
    <QueryClientProvider client={qc}>
      <BulkGroupAssignDialog open onOpenChange={vi.fn()} emails={emails} onDone={onDone} />
    </QueryClientProvider>,
  );
}

describe('BulkGroupAssignDialog (v0.332 · 원본 assignGroups)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('배정: 2명 × 2그룹 = 4건 · 이미 멤버는 skip · 다른 오류는 실패 목록', async () => {
    mockInsert.mockImplementation(async (d: { groupEmail: string; memberEmail: string }) => {
      if (d.memberEmail === 'b@cam.hs.kr' && d.groupEmail === 'club@cam.hs.kr') throw new Error('Member already exists.');
      if (d.memberEmail === 'a@cam.hs.kr' && d.groupEmail === 'club@cam.hs.kr') throw new Error('google_upstream_denied');
      return {};
    });
    renderDialog(['a@cam.hs.kr', 'b@cam.hs.kr']);
    fireEvent.click(screen.getByTestId('bulk-group-cb-c23@cam.hs.kr'));
    fireEvent.click(screen.getByTestId('bulk-group-cb-club@cam.hs.kr'));
    expect(screen.getByTestId('bulk-group-pair-count').textContent).toContain('4');
    fireEvent.click(screen.getByTestId('bulk-group-run'));
    await waitFor(() => expect(screen.getByTestId('bulk-group-done')).toBeTruthy());
    expect(mockInsert).toHaveBeenCalledTimes(4);
    expect(mockInsert).toHaveBeenCalledWith({ groupEmail: 'c23@cam.hs.kr', memberEmail: 'a@cam.hs.kr', role: 'MEMBER' });
    const done = screen.getByTestId('bulk-group-done').textContent ?? '';
    expect(done).toContain('이미 멤버');
    expect(screen.getByTestId('bulk-group-failures').textContent).toContain('a@cam.hs.kr');
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('제외: 건수 정확 입력 전 비활성 → 입력 후 Members.remove · 멤버 아님은 skip', async () => {
    mockDelete.mockRejectedValueOnce(new Error('Resource Not Found: memberKey')).mockResolvedValue({});
    renderDialog(['a@cam.hs.kr', 'b@cam.hs.kr']);
    fireEvent.click(screen.getByTestId('bulk-group-action-remove'));
    fireEvent.click(screen.getByTestId('bulk-group-cb-c23@cam.hs.kr'));
    const run = screen.getByTestId('bulk-group-run') as HTMLButtonElement;
    expect(run.disabled).toBe(true);
    fireEvent.change(screen.getByTestId('bulk-group-remove-confirm-input'), { target: { value: '1' } });
    expect(run.disabled).toBe(true);
    fireEvent.change(screen.getByTestId('bulk-group-remove-confirm-input'), { target: { value: '2' } });
    expect(run.disabled).toBe(false);
    fireEvent.click(run);
    await waitFor(() => expect(screen.getByTestId('bulk-group-done')).toBeTruthy());
    expect(mockDelete.mock.calls.map((c) => c[0])).toEqual([
      { groupEmail: 'c23@cam.hs.kr', memberEmail: 'a@cam.hs.kr' },
      { groupEmail: 'c23@cam.hs.kr', memberEmail: 'b@cam.hs.kr' },
    ]);
    expect(screen.getByTestId('bulk-group-done').textContent).toContain('멤버 아님');
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('그룹 미선택 → 실행 비활성 · 검색 필터', () => {
    renderDialog(['a@cam.hs.kr']);
    expect((screen.getByTestId('bulk-group-run') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByTestId('bulk-group-search'), { target: { value: '동아' } });
    expect(screen.getByTestId('bulk-group-list').textContent).toContain('동아리');
    expect(screen.getByTestId('bulk-group-list').textContent).not.toContain('2학년 3반');
  });
});
