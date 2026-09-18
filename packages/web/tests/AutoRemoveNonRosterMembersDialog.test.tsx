import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

// v0.149: 반 그룹의 「기초 데이터 밖 멤버 제거」 다이얼로그 회귀.
// - scanning: 각 그룹 페이지네이션 fetch · rosters diff.
// - preview: MEMBER 만 기본 · toggle 로 OWNER/MANAGER 포함.
// - execute: 순차 delete · confirm text 정확 일치 필요.

const mockCallGroupsMembersList = vi.fn();
const mockCallGroupsMembersDelete = vi.fn();

vi.mock('../src/api/groupsMembersList', () => ({
  callGroupsMembersList: (...args: unknown[]) => mockCallGroupsMembersList(...args),
}));

vi.mock('../src/api/groupsMembersDelete', () => ({
  callGroupsMembersDelete: (...args: unknown[]) => mockCallGroupsMembersDelete(...args),
}));

import { AutoRemoveNonRosterMembersDialog } from '../src/routes/admin/AutoRemoveNonRosterMembersDialog';
import type { BasicDataYear } from '@school-app/shared';

const testData: BasicDataYear = {
  year: 2026,
  grades: [
    { grade: 1, classes: ['1반', '2반'] },
  ],
  rosters: {
    '1': {
      '1반': ['s1@cam.hs.kr', 's2@cam.hs.kr'],
      '2반': ['s3@cam.hs.kr'],
    },
  },
};

function member(email: string, role: 'MEMBER' | 'MANAGER' | 'OWNER' = 'MEMBER') {
  return { email, role, type: 'USER' as const, status: 'ACTIVE' };
}

describe('AutoRemoveNonRosterMembersDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCallGroupsMembersList.mockReset();
    mockCallGroupsMembersDelete.mockReset();
  });

  it('scan → preview: rosters 명단에 없는 사람만 surplus 로 표시', async () => {
    // 1-1반 그룹 (email='class-11@cam.hs.kr' · buildGroupEmail 이 한글 strip):
    //   rosters=[s1,s2], 실멤버=[s1, extra1, extra2] → surplus=extra1,extra2.
    // 1-2반 그룹 (email='class-12@cam.hs.kr'):
    //   rosters=[s3], 실멤버=[s3] → surplus 없음.
    mockCallGroupsMembersList.mockImplementation(async (req: { groupEmail: string }) => {
      if (req.groupEmail === 'class-11@cam.hs.kr') {
        return {
          members: [
            member('s1@cam.hs.kr'),
            member('extra1@cam.hs.kr'),
            member('extra2@cam.hs.kr'),
          ],
          nextPageToken: null,
        };
      }
      return { members: [member('s3@cam.hs.kr')], nextPageToken: null };
    });

    render(<AutoRemoveNonRosterMembersDialog open={true} onOpenChange={vi.fn()} year={2026} data={testData} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('auto-remove-nonroster-scan-btn'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('auto-remove-nonroster-table')).toBeDefined();
    });
    // extra1, extra2 만 렌더 (1-1반 그룹만 surplus).
    expect(screen.getAllByText('extra1@cam.hs.kr').length).toBeGreaterThan(0);
    expect(screen.getAllByText('extra2@cam.hs.kr').length).toBeGreaterThan(0);
    expect(screen.queryByText('s1@cam.hs.kr')).toBeNull();
    expect(screen.queryByText('s3@cam.hs.kr')).toBeNull();
  });

  it('OWNER/MANAGER 는 「MEMBER 만 대상」 default toggle 로 감춰짐 · 해제 시 노출', async () => {
    mockCallGroupsMembersList.mockImplementation(async () => ({
      members: [
        member('extra-member@cam.hs.kr', 'MEMBER'),
        member('extra-mgr@cam.hs.kr', 'MANAGER'),
        member('extra-owner@cam.hs.kr', 'OWNER'),
      ],
      nextPageToken: null,
    }));

    render(<AutoRemoveNonRosterMembersDialog open={true} onOpenChange={vi.fn()} year={2026} data={testData} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('auto-remove-nonroster-scan-btn'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('auto-remove-nonroster-table')).toBeDefined();
    });

    // default: MEMBER 만.
    expect(screen.getAllByText('extra-member@cam.hs.kr').length).toBeGreaterThan(0);
    expect(screen.queryByText('extra-mgr@cam.hs.kr')).toBeNull();
    expect(screen.queryByText('extra-owner@cam.hs.kr')).toBeNull();

    // toggle off → 전체 노출.
    fireEvent.click(screen.getByTestId('auto-remove-nonroster-protect-toggle'));
    expect(screen.getAllByText('extra-mgr@cam.hs.kr').length).toBeGreaterThan(0);
    expect(screen.getAllByText('extra-owner@cam.hs.kr').length).toBeGreaterThan(0);
  });

  it('confirm text 정확 일치해야 execute button enabled', async () => {
    mockCallGroupsMembersList.mockImplementation(async () => ({
      members: [member('extra1@cam.hs.kr'), member('extra2@cam.hs.kr')],
      nextPageToken: null,
    }));

    render(<AutoRemoveNonRosterMembersDialog open={true} onOpenChange={vi.fn()} year={2026} data={testData} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('auto-remove-nonroster-scan-btn'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('auto-remove-nonroster-table')).toBeDefined();
    });

    // 각 그룹에 extra1, extra2 → 2 그룹 × 2 = 4 surplus.
    const btn = screen.getByTestId('auto-remove-nonroster-execute-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    // 부정확 입력.
    fireEvent.change(screen.getByTestId('auto-remove-nonroster-confirm-input'), {
      target: { value: '제거' },
    });
    expect(btn.disabled).toBe(true);
    // 정확 입력.
    fireEvent.change(screen.getByTestId('auto-remove-nonroster-confirm-input'), {
      target: { value: '제거 4' },
    });
    expect(btn.disabled).toBe(false);
  });

  it('execute: 선택된 surplus 순차 delete · 성공/실패 카운트', async () => {
    mockCallGroupsMembersList.mockImplementation(async () => ({
      members: [member('extra1@cam.hs.kr'), member('extra2@cam.hs.kr')],
      nextPageToken: null,
    }));
    mockCallGroupsMembersDelete
      .mockResolvedValueOnce({ deleted: true })
      .mockRejectedValueOnce(new Error('http_404'))
      .mockResolvedValueOnce({ deleted: true })
      .mockResolvedValueOnce({ deleted: true });

    render(<AutoRemoveNonRosterMembersDialog open={true} onOpenChange={vi.fn()} year={2026} data={testData} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('auto-remove-nonroster-scan-btn'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('auto-remove-nonroster-table')).toBeDefined();
    });
    fireEvent.change(screen.getByTestId('auto-remove-nonroster-confirm-input'), {
      target: { value: '제거 4' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('auto-remove-nonroster-execute-btn'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('auto-remove-nonroster-done')).toBeDefined();
    });
    expect(mockCallGroupsMembersDelete).toHaveBeenCalledTimes(4);
    expect(screen.getByText(/성공 3.*실패 1/)).toBeDefined();
  });

  it('prefix 검증: 대문자/특수문자 있으면 scan 버튼 disabled', () => {
    render(<AutoRemoveNonRosterMembersDialog open={true} onOpenChange={vi.fn()} year={2026} data={testData} />);
    const btn = screen.getByTestId('auto-remove-nonroster-scan-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    fireEvent.change(screen.getByTestId('auto-remove-nonroster-prefix-input'), {
      target: { value: 'Class' },
    });
    expect(btn.disabled).toBe(true);
    fireEvent.change(screen.getByTestId('auto-remove-nonroster-prefix-input'), {
      target: { value: 'class_x' },
    });
    expect(btn.disabled).toBe(true);
    fireEvent.change(screen.getByTestId('auto-remove-nonroster-prefix-input'), {
      target: { value: 'class-1' },
    });
    expect(btn.disabled).toBe(false);
  });
});
