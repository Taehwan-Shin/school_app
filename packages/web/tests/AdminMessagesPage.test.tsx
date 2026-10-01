import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

const mockChatDm = vi.fn();
const mockGmail = vi.fn();
const mockSpace = vi.fn();

vi.mock('../src/components/shell/AppShell', () => ({ AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('../src/lib/auth', () => ({ useAuth: () => ({ role: 'admin' }), reauthorizeWithGoogle: vi.fn() }));
vi.mock('../src/api/messages', () => ({
  callChatDmSend: (...a: unknown[]) => mockChatDm(...a),
  callGmailSend: (...a: unknown[]) => mockGmail(...a),
  callChatSpaceSend: (...a: unknown[]) => mockSpace(...a),
  useMessageTemplates: () => ({ data: { templates: [{ id: 't1', name: '수행평가', subject: '수행평가 안내', body: '제출 확인' }] }, isLoading: false, isError: false, error: null }),
  useUpsertMessageTemplate: () => ({ mutateAsync: vi.fn(), isPending: false, error: null }),
  useDeleteMessageTemplate: () => ({ mutateAsync: vi.fn(), isPending: false, error: null }),
}));
vi.mock('../src/api/chatList', () => ({
  useChatList: () => ({
    data: {
      spaces: [
        { name: 'spaces/A', displayName: '3-1 반', spaceType: 'SPACE' },
        { name: 'spaces/B', displayName: '3-2 반', spaceType: 'SPACE' },
        { name: 'spaces/DM', spaceType: 'DIRECT_MESSAGE' },
      ],
    },
    isLoading: false,
    isError: false,
    error: null,
  }),
}));

import { AdminMessagesPage } from '../src/routes/admin/messages';

describe('AdminMessagesPage (v0.322)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockChatDm.mockResolvedValue({});
    mockGmail.mockResolvedValue({});
    mockSpace.mockResolvedValue({});
  });

  it('일괄: 챗 + 메일 체크 → 수신자마다 두 채널 발송 · 결과 요약', async () => {
    render(<AdminMessagesPage />);
    fireEvent.change(screen.getByTestId('messages-bulk-recipients'), { target: { value: 'a@cam.hs.kr\nB@cam.hs.kr, a@cam.hs.kr' } });
    expect(screen.getByTestId('messages-bulk-count').textContent).toContain('유효 2명');
    fireEvent.click(screen.getByTestId('messages-bulk-channel-mail'));
    fireEvent.change(screen.getByTestId('messages-bulk-message'), { target: { value: ' 내일 준비물 ' } });
    fireEvent.click(screen.getByTestId('messages-bulk-send'));
    await waitFor(() => expect(screen.getByTestId('messages-done')).toBeTruthy(), { timeout: 5000 });
    expect(mockChatDm.mock.calls.map((c) => c[0])).toEqual([
      { email: 'a@cam.hs.kr', text: '내일 준비물' },
      { email: 'b@cam.hs.kr', text: '내일 준비물' },
    ]);
    expect(mockGmail).toHaveBeenCalledWith({ to: 'b@cam.hs.kr', subject: '선생님 알림', body: '내일 준비물' });
    expect(mockGmail).toHaveBeenCalledTimes(2);
  });

  it('일괄: 확인 취소 → 발송 안 함', () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    render(<AdminMessagesPage />);
    fireEvent.change(screen.getByTestId('messages-bulk-recipients'), { target: { value: 'a@cam.hs.kr' } });
    fireEvent.change(screen.getByTestId('messages-bulk-message'), { target: { value: 'x' } });
    fireEvent.click(screen.getByTestId('messages-bulk-send'));
    expect(mockChatDm).not.toHaveBeenCalled();
  });

  it('일괄: 저장된 문구 선택 → 메시지 · 제목 불러오기', () => {
    render(<AdminMessagesPage />);
    fireEvent.change(screen.getByTestId('messages-template-select'), { target: { value: 't1' } });
    expect((screen.getByTestId('messages-bulk-message') as HTMLTextAreaElement).value).toBe('제출 확인');
  });

  it('개별: 붙여넣기 → 행마다 다른 메시지로 챗 DM', async () => {
    render(<AdminMessagesPage />);
    fireEvent.click(screen.getByTestId('messages-tab-individual'));
    fireEvent.change(screen.getByTestId('messages-individual-paste'), { target: { value: 'a@cam.hs.kr\t첫째\nb@cam.hs.kr\t둘째' } });
    fireEvent.click(screen.getByTestId('messages-individual-paste-apply'));
    fireEvent.click(screen.getByTestId('messages-individual-send'));
    await waitFor(() => expect(screen.getByTestId('messages-done')).toBeTruthy(), { timeout: 5000 });
    expect(mockChatDm.mock.calls.map((c) => c[0])).toEqual([
      { email: 'a@cam.hs.kr', text: '첫째' },
      { email: 'b@cam.hs.kr', text: '둘째' },
    ]);
  });

  it('스페이스: DM 제외 목록 · 전체 선택 → 보내는 사람/링크 붙인 메시지 발송', async () => {
    render(<AdminMessagesPage />);
    fireEvent.click(screen.getByTestId('messages-tab-space'));
    expect(screen.getByTestId('messages-space-list').textContent).not.toContain('spaces/DM');
    fireEvent.click(screen.getByText('전체 선택'));
    fireEvent.change(screen.getByTestId('messages-space-message'), { target: { value: '공지' } });
    fireEvent.change(screen.getByLabelText('보내는 사람 (선택)'), { target: { value: '3학년부' } });
    fireEvent.click(screen.getByTestId('messages-space-send'));
    await waitFor(() => expect(screen.getByTestId('messages-done')).toBeTruthy(), { timeout: 5000 });
    expect(mockSpace).toHaveBeenCalledWith({ spaceName: 'spaces/A', text: '공지\n\n- 3학년부' });
    expect(mockSpace).toHaveBeenCalledTimes(2);
  });
});
