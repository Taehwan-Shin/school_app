import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockUseBasicDataGet = vi.fn();
const mockCallClassroomCreate = vi.fn();
const mockCallClassroomList = vi.fn();
const mockCallChatCreate = vi.fn();
const mockCallChatList = vi.fn();

vi.mock('../src/api/basicDataGet', () => ({
  useBasicDataGet: (year: number, enabled: boolean) => mockUseBasicDataGet(year, enabled),
}));

vi.mock('../src/api/classroomCreate', () => ({
  callClassroomCreate: (args: any) => mockCallClassroomCreate(args),
  useClassroomCreate: vi.fn(),
}));

vi.mock('../src/api/classroomList', () => ({
  callClassroomList: () => mockCallClassroomList(),
  useClassroomList: vi.fn(),
}));

vi.mock('../src/api/chatCreate', () => ({
  callChatCreate: (args: any) => mockCallChatCreate(args),
  useChatCreate: vi.fn(),
}));

vi.mock('../src/api/chatList', () => ({
  callChatList: () => mockCallChatList(),
  useChatList: vi.fn(),
}));

import { ClassroomChatPairBulkCreateDialog } from '../src/routes/admin/ClassroomChatPairBulkCreateDialog';

describe('ClassroomChatPairBulkCreateDialog component', () => {
  const mockBasicData = {
    year: 2026,
    grades: [
      { grade: 1, classes: ['1', '2'] },
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
    mockCallClassroomCreate.mockResolvedValue({
      course: { id: 'c-new', name: '2026학년도 1학년 1반' },
    });
    mockCallChatCreate.mockResolvedValue({
      space: { name: 'spaces/AAAA' },
    });
    mockCallClassroomList.mockResolvedValue({ courses: [] });
    mockCallChatList.mockResolvedValue({ spaces: [] });
  });

  function renderDialog() {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    return render(
      <QueryClientProvider client={qc}>
        <ClassroomChatPairBulkCreateDialog open={true} onOpenChange={vi.fn()} />
      </QueryClientProvider>,
    );
  }

  // 시나리오 1: happy — 선택 → 실행. course + chat 모두 생성. done 페이지에 각 pair 상태 표시.
  it('scenario 1: creates course + chat for each selected pair', async () => {
    renderDialog();

    fireEvent.click(screen.getByTestId('pair-class-cb-1-1'));
    fireEvent.click(screen.getByTestId('pair-class-cb-1-2'));
    fireEvent.click(screen.getByTestId('pair-preview-btn'));

    fireEvent.change(screen.getByTestId('pair-confirm-input'), {
      target: { value: '2' },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('pair-execute-btn'));
    });

    expect(mockCallClassroomList).toHaveBeenCalledTimes(1);
    expect(mockCallChatList).toHaveBeenCalledTimes(1);
    expect(mockCallClassroomCreate).toHaveBeenCalledTimes(2);
    expect(mockCallChatCreate).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('pair-done').textContent).toContain('2개 course+chat 생성');
  });

  // 시나리오 2: legacy course 매치 시 course skip, chat 은 그래도 시도.
  it('scenario 2: skips legacy course but still attempts chat when displayName differs', async () => {
    mockCallClassroomList.mockResolvedValue({
      courses: [
        { id: 'old-1', name: '2026학년도 1학년 1반', section: '1-1' },
      ],
    });

    renderDialog();
    fireEvent.click(screen.getByTestId('pair-class-cb-1-1'));
    fireEvent.click(screen.getByTestId('pair-preview-btn'));
    fireEvent.change(screen.getByTestId('pair-confirm-input'), {
      target: { value: '1' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('pair-execute-btn'));
    });

    // Course legacy skip → callClassroomCreate 미호출.
    expect(mockCallClassroomCreate).not.toHaveBeenCalled();
    // Chat 은 legacy 매치 없으므로 여전히 생성.
    expect(mockCallChatCreate).toHaveBeenCalledTimes(1);
    const results = screen.getByTestId('pair-results');
    expect(results.textContent).toContain('course: skipped');
    expect(results.textContent).toContain('chat: ok');
  });

  // 시나리오 3: course 생성 실패 시 chat 은 시도하지 않는다 (not_attempted).
  it('scenario 3: does not attempt chat when course create fails', async () => {
    mockCallClassroomCreate.mockRejectedValue(new Error('network error 500'));

    renderDialog();
    fireEvent.click(screen.getByTestId('pair-class-cb-1-1'));
    fireEvent.click(screen.getByTestId('pair-preview-btn'));
    fireEvent.change(screen.getByTestId('pair-confirm-input'), {
      target: { value: '1' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('pair-execute-btn'));
    });

    expect(mockCallClassroomCreate).toHaveBeenCalledTimes(1);
    expect(mockCallChatCreate).not.toHaveBeenCalled();
    const results = screen.getByTestId('pair-results');
    expect(results.textContent).toContain('course: failed');
    expect(results.textContent).toContain('chat: not_attempted');
  });

  // 시나리오 4: legacy list 어느 한쪽 실패 시 전체 fail-closed. create 호출 0회.
  it('scenario 4: fails closed when either legacy list fetch fails', async () => {
    mockCallChatList.mockRejectedValue(new Error('http_500'));

    renderDialog();
    fireEvent.click(screen.getByTestId('pair-class-cb-1-1'));
    fireEvent.click(screen.getByTestId('pair-class-cb-1-2'));
    fireEvent.click(screen.getByTestId('pair-preview-btn'));
    fireEvent.change(screen.getByTestId('pair-confirm-input'), {
      target: { value: '2' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('pair-execute-btn'));
    });

    expect(mockCallClassroomCreate).not.toHaveBeenCalled();
    expect(mockCallChatCreate).not.toHaveBeenCalled();
    const doneEl = screen.getByTestId('pair-done');
    expect(doneEl.textContent).toContain('legacy_list_failed');
  });

  // 시나리오 5: chat displayName 128자 초과 시 chat 만 client 컷 (course 는 이미 생성됐음).
  it('scenario 5: fails long chat displayName at client while course succeeded', async () => {
    const longClass = 'A'.repeat(118); // '2026학년도 1학년 ' + 118자 + '반' > 128
    mockUseBasicDataGet.mockReturnValue({
      data: {
        data: {
          year: 2026,
          grades: [{ grade: 1, classes: [longClass] }],
          rosters: {},
        },
      },
      isLoading: false,
      isError: false,
      error: null,
    });

    renderDialog();
    fireEvent.click(screen.getByTestId(`pair-class-cb-1-${longClass}`));
    fireEvent.click(screen.getByTestId('pair-preview-btn'));
    fireEvent.change(screen.getByTestId('pair-confirm-input'), {
      target: { value: '1' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('pair-execute-btn'));
    });

    // Course 는 생성 (alias hash 는 길이 무관).
    expect(mockCallClassroomCreate).toHaveBeenCalledTimes(1);
    // Chat 은 client 컷.
    expect(mockCallChatCreate).not.toHaveBeenCalled();
    const results = screen.getByTestId('pair-results');
    expect(results.textContent).toContain('course: ok');
    expect(results.textContent).toContain('chat: failed');
    expect(results.textContent).toContain('display_name_too_long');
  });

  // 시나리오 6: chat legacy 매치 시 chat skip, course 는 정상 생성.
  it('scenario 6: skips legacy chat when displayName matches', async () => {
    mockCallChatList.mockResolvedValue({
      spaces: [{ name: 'spaces/OLD', displayName: '2026학년도 1학년 1반' }],
    });

    renderDialog();
    fireEvent.click(screen.getByTestId('pair-class-cb-1-1'));
    fireEvent.click(screen.getByTestId('pair-preview-btn'));
    fireEvent.change(screen.getByTestId('pair-confirm-input'), {
      target: { value: '1' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('pair-execute-btn'));
    });

    expect(mockCallClassroomCreate).toHaveBeenCalledTimes(1);
    expect(mockCallChatCreate).not.toHaveBeenCalled();
    const results = screen.getByTestId('pair-results');
    expect(results.textContent).toContain('course: ok');
    expect(results.textContent).toContain('chat: skipped');
  });
});
