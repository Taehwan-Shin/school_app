import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockUseBasicDataGet = vi.fn();
const mockCallChatCreate = vi.fn();
const mockCallChatList = vi.fn();

vi.mock('../src/api/basicDataGet', () => ({
  useBasicDataGet: (year: number, enabled: boolean) => mockUseBasicDataGet(year, enabled),
}));

vi.mock('../src/api/chatCreate', () => ({
  callChatCreate: (args: any) => mockCallChatCreate(args),
  useChatCreate: vi.fn(),
}));

vi.mock('../src/api/chatList', () => ({
  callChatList: () => mockCallChatList(),
  useChatList: vi.fn(),
}));

import { ChatBulkCreateDialog } from '../src/routes/admin/ChatBulkCreateDialog';

describe('ChatBulkCreateDialog component', () => {
  const mockBasicData = {
    year: 2026,
    grades: [
      { grade: 1, classes: ['1', '2'] },
      { grade: 2, classes: ['A'] },
    ],
    rosters: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseBasicDataGet.mockReturnValue({
      data: { data: mockBasicData },
      isLoading: false,
      isError: false,
      error: null,
    });
    mockCallChatCreate.mockResolvedValue({
      space: { name: 'spaces/AAAA', displayName: 'new space' },
    });
    mockCallChatList.mockResolvedValue({ spaces: [] });
  });

  function renderDialog() {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    return render(
      <QueryClientProvider client={qc}>
        <ChatBulkCreateDialog open={true} onOpenChange={vi.fn()} />
      </QueryClientProvider>,
    );
  }

  // 시나리오 1: happy path — 선택 → preview → confirm → running → done. displayName 이 courseName 규칙과 일치.
  it('scenario 1: calls chatCreate sequentially with correct displayName and enters done phase', async () => {
    renderDialog();

    fireEvent.click(screen.getByTestId('bulk-create-chat-class-cb-1-1'));
    fireEvent.click(screen.getByTestId('bulk-create-chat-class-cb-1-2'));
    fireEvent.click(screen.getByTestId('bulk-create-chat-preview-btn'));

    fireEvent.change(screen.getByTestId('bulk-create-chat-confirm-input'), {
      target: { value: '2' },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('bulk-create-chat-execute-btn'));
    });

    expect(mockCallChatList).toHaveBeenCalledTimes(1);
    expect(mockCallChatCreate).toHaveBeenCalledTimes(2);
    expect(mockCallChatCreate).toHaveBeenNthCalledWith(1, {
      displayName: '2026학년도 1학년 1반',
    });
    expect(mockCallChatCreate).toHaveBeenNthCalledWith(2, {
      displayName: '2026학년도 1학년 2반',
    });
    expect(screen.getByTestId('bulk-create-chat-done').textContent).toContain('2개 생성');
  });

  // 시나리오 2: legacy displayName 매치 시 create 하지 않고 skipped (F8 패턴).
  it('scenario 2: skips legacy spaces with matching displayName without calling create', async () => {
    mockCallChatList.mockResolvedValue({
      spaces: [{ name: 'spaces/OLD', displayName: '2026학년도 1학년 1반' }],
    });

    renderDialog();
    fireEvent.click(screen.getByTestId('bulk-create-chat-class-cb-1-1'));
    fireEvent.click(screen.getByTestId('bulk-create-chat-class-cb-1-2'));
    fireEvent.click(screen.getByTestId('bulk-create-chat-preview-btn'));
    fireEvent.change(screen.getByTestId('bulk-create-chat-confirm-input'), {
      target: { value: '2' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('bulk-create-chat-execute-btn'));
    });

    expect(mockCallChatCreate).toHaveBeenCalledTimes(1);
    expect(mockCallChatCreate).toHaveBeenCalledWith({
      displayName: '2026학년도 1학년 2반',
    });
    expect(mockCallChatCreate).not.toHaveBeenCalledWith(
      expect.objectContaining({ displayName: '2026학년도 1학년 1반' }),
    );
    expect(screen.getByTestId('bulk-create-chat-skipped').textContent).toContain('2026학년도 1학년 1반');
  });

  // 시나리오 3: list 실패 → fail-closed. create 호출 0회. done 페이지에 legacy_list_failed 표시 (F10 패턴).
  it('scenario 3: fails closed and skips creates when legacy list fetch fails', async () => {
    mockCallChatList.mockRejectedValue(new Error('http_500'));

    renderDialog();
    fireEvent.click(screen.getByTestId('bulk-create-chat-class-cb-1-1'));
    fireEvent.click(screen.getByTestId('bulk-create-chat-class-cb-1-2'));
    fireEvent.click(screen.getByTestId('bulk-create-chat-preview-btn'));
    fireEvent.change(screen.getByTestId('bulk-create-chat-confirm-input'), {
      target: { value: '2' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('bulk-create-chat-execute-btn'));
    });

    expect(mockCallChatList).toHaveBeenCalledTimes(1);
    expect(mockCallChatCreate).not.toHaveBeenCalled();
    const doneEl = screen.getByTestId('bulk-create-chat-done');
    expect(doneEl.textContent).toContain('legacy_list_failed');
  });

  // 시나리오 F12: 128자 초과 displayName 은 client 층에서 즉시 failed/display_name_too_long, create 미호출 (v0.97 Codex F12 회귀).
  it('scenario 5: fails long displayName at client without calling create', async () => {
    // 반 이름 118자 → courseName prefix ('2026학년도 1학년 ') + 반 이름 118자 + '반' > 128
    const longClass = 'A'.repeat(118);
    mockUseBasicDataGet.mockReturnValue({
      data: {
        data: {
          year: 2026,
          grades: [{ grade: 1, classes: [longClass, '1'] }],
          rosters: { '1': { [longClass]: [], '1': [] } },
        },
      },
      isLoading: false,
      isError: false,
      error: null,
    });

    renderDialog();
    fireEvent.click(screen.getByTestId(`bulk-create-chat-class-cb-1-${longClass}`));
    fireEvent.click(screen.getByTestId('bulk-create-chat-class-cb-1-1'));
    fireEvent.click(screen.getByTestId('bulk-create-chat-preview-btn'));
    fireEvent.change(screen.getByTestId('bulk-create-chat-confirm-input'), {
      target: { value: '2' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('bulk-create-chat-execute-btn'));
    });

    // 짧은 반 이름 하나만 create, 긴 반 이름은 client 컷.
    expect(mockCallChatCreate).toHaveBeenCalledTimes(1);
    expect(mockCallChatCreate).toHaveBeenCalledWith({
      displayName: '2026학년도 1학년 1반',
    });
    const doneEl = screen.getByTestId('bulk-create-chat-done');
    expect(doneEl.textContent).toContain('display_name_too_long');
  });

  // 시나리오 4: 한국어·특수문자 반 이름이 displayName 에 그대로 전달 (F5 회귀 방지 유틸 재사용 확인).
  it('scenario 4: preserves korean and special class names in displayName without splitting', async () => {
    mockUseBasicDataGet.mockReturnValue({
      data: {
        data: {
          year: 2026,
          grades: [{ grade: 1, classes: ['1반', 'A-1'] }],
          rosters: { '1': { '1반': [], 'A-1': [] } },
        },
      },
      isLoading: false,
      isError: false,
      error: null,
    });

    renderDialog();
    fireEvent.click(screen.getByTestId('bulk-create-chat-class-cb-1-1반'));
    fireEvent.click(screen.getByTestId('bulk-create-chat-class-cb-1-A-1'));
    fireEvent.click(screen.getByTestId('bulk-create-chat-preview-btn'));
    fireEvent.change(screen.getByTestId('bulk-create-chat-confirm-input'), {
      target: { value: '2' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('bulk-create-chat-execute-btn'));
    });

    expect(mockCallChatCreate).toHaveBeenCalledTimes(2);
    const calls = mockCallChatCreate.mock.calls.map((c) => c[0].displayName);
    expect(calls).toContain('2026학년도 1학년 1반반');
    expect(calls).toContain('2026학년도 1학년 A-1반');
    // 잘라진 값 (A 만) 이 전달되면 실패.
    expect(calls).not.toContain('2026학년도 1학년 A반');
  });
});
