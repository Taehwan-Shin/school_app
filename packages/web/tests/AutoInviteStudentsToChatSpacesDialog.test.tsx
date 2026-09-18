import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

// v0.150: 반 챗방 자동 초대 다이얼로그 회귀.
// - confirm → scanning (callChatList) → preview (matched vs unmatched) →
//   running (chatMembersAdd 순차) → done (성공/skip/실패 카운트).

const mockCallChatList = vi.fn();
const mockCallChatMembersAdd = vi.fn();

vi.mock('../src/api/chatList', () => ({
  callChatList: (...args: unknown[]) => mockCallChatList(...args),
}));

vi.mock('../src/api/chatMembersAdd', () => ({
  callChatMembersAdd: (...args: unknown[]) => mockCallChatMembersAdd(...args),
}));

import { AutoInviteStudentsToChatSpacesDialog } from '../src/routes/admin/AutoInviteStudentsToChatSpacesDialog';
import type { BasicDataYear } from '@school-app/shared';

const testData: BasicDataYear = {
  year: 2026,
  grades: [{ grade: 1, classes: ['1', '2'] }],
  rosters: {
    '1': {
      '1': ['s1@cam.hs.kr', 's2@cam.hs.kr'],
      '2': ['s3@cam.hs.kr'],
    },
  },
};

describe('AutoInviteStudentsToChatSpacesDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCallChatList.mockReset();
    mockCallChatMembersAdd.mockReset();
  });

  it('scan → preview: displayName 매칭된 챗방과 미매칭 반 분리 표시', async () => {
    mockCallChatList.mockResolvedValue({
      spaces: [
        { name: 'spaces/A', displayName: '2026학년도 1학년 1반' },
        // 「1학년 2반」 챗방 없음 → unmatched.
        { name: 'spaces/B', displayName: '기타 스페이스' },
      ],
    });
    render(<AutoInviteStudentsToChatSpacesDialog open={true} onOpenChange={vi.fn()} year={2026} data={testData} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('auto-invite-chat-scan-btn'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('auto-invite-chat-matched-spaces/A')).toBeDefined();
    });
    // 매칭 1건 · unmatched 1건.
    expect(screen.getByTestId('auto-invite-chat-unmatched').textContent).toContain('2026학년도 1학년 2반');
  });

  it('매칭된 챗방 없으면 empty 배너 · confirm text label 미표시', async () => {
    mockCallChatList.mockResolvedValue({ spaces: [] });
    render(<AutoInviteStudentsToChatSpacesDialog open={true} onOpenChange={vi.fn()} year={2026} data={testData} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('auto-invite-chat-scan-btn'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('auto-invite-chat-matched-empty')).toBeDefined();
    });
    expect(screen.queryByTestId('auto-invite-chat-confirm-input')).toBeNull();
    expect((screen.getByTestId('auto-invite-chat-execute-btn') as HTMLButtonElement).disabled).toBe(true);
  });

  it('confirm text 정확 일치 (초대 N) 해야 execute enabled', async () => {
    mockCallChatList.mockResolvedValue({
      spaces: [
        { name: 'spaces/A', displayName: '2026학년도 1학년 1반' },
        { name: 'spaces/B', displayName: '2026학년도 1학년 2반' },
      ],
    });
    render(<AutoInviteStudentsToChatSpacesDialog open={true} onOpenChange={vi.fn()} year={2026} data={testData} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('auto-invite-chat-scan-btn'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('auto-invite-chat-matched-table')).toBeDefined();
    });
    // 총 3명 (2+1).
    const btn = screen.getByTestId('auto-invite-chat-execute-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.change(screen.getByTestId('auto-invite-chat-confirm-input'), { target: { value: '초대 2' } });
    expect(btn.disabled).toBe(true);
    fireEvent.change(screen.getByTestId('auto-invite-chat-confirm-input'), { target: { value: '초대 3' } });
    expect(btn.disabled).toBe(false);
  });

  it('execute: 매칭 챗방마다 학생 순차 add · 성공/skip/실패 분류', async () => {
    mockCallChatList.mockResolvedValue({
      spaces: [
        { name: 'spaces/A', displayName: '2026학년도 1학년 1반' },
        { name: 'spaces/B', displayName: '2026학년도 1학년 2반' },
      ],
    });
    mockCallChatMembersAdd
      .mockResolvedValueOnce({ member: {} })
      .mockRejectedValueOnce(new Error('already member'))
      .mockRejectedValueOnce(new Error('http_500'));

    render(<AutoInviteStudentsToChatSpacesDialog open={true} onOpenChange={vi.fn()} year={2026} data={testData} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('auto-invite-chat-scan-btn'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('auto-invite-chat-matched-table')).toBeDefined();
    });
    fireEvent.change(screen.getByTestId('auto-invite-chat-confirm-input'), { target: { value: '초대 3' } });
    await act(async () => {
      fireEvent.click(screen.getByTestId('auto-invite-chat-execute-btn'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('auto-invite-chat-done')).toBeDefined();
    });
    expect(mockCallChatMembersAdd).toHaveBeenCalledTimes(3);
    // 성공 1 · skip 1 · 실패 1.
    expect(screen.getByText(/성공 1.*skip.*1.*실패 1/)).toBeDefined();
  });

  it('rosters 미설정 or 빈 반은 스캔 대상 제외', async () => {
    const partial: BasicDataYear = {
      year: 2026,
      grades: [{ grade: 1, classes: ['1', '2', '3'] }],
      rosters: {
        '1': {
          '1': ['s@x.kr'], // 정상.
          '3': [], // 빈 배열 → 스캔 제외 (0명 초대 무의미).
          // '2' 미설정 → 스캔 제외.
        },
      },
    };
    mockCallChatList.mockResolvedValue({
      spaces: [{ name: 'spaces/A', displayName: '2026학년도 1학년 1반' }],
    });
    render(<AutoInviteStudentsToChatSpacesDialog open={true} onOpenChange={vi.fn()} year={2026} data={partial} />);
    // scan 버튼 = 1개 반 (2/3반 제외).
    expect(screen.getByTestId('auto-invite-chat-scan-btn').textContent).toContain('1개');
  });

  it('scan 실패 시 confirm 화면 유지 + 에러 배너', async () => {
    mockCallChatList.mockRejectedValueOnce(new Error('http_403'));
    render(<AutoInviteStudentsToChatSpacesDialog open={true} onOpenChange={vi.fn()} year={2026} data={testData} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('auto-invite-chat-scan-btn'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('auto-invite-chat-scan-error')).toBeDefined();
    });
    expect(screen.getByTestId('auto-invite-chat-scan-error').textContent).toContain('http_403');
  });
});
