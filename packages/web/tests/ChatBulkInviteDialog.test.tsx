import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockUseBasicDataGet = vi.fn();
const mockCallChatMembersAdd = vi.fn();

vi.mock('../src/api/basicDataGet', () => ({
  useBasicDataGet: (year: number, enabled: boolean) => mockUseBasicDataGet(year, enabled),
}));

vi.mock('../src/api/chatMembersAdd', () => ({
  callChatMembersAdd: (args: any) => mockCallChatMembersAdd(args),
  useChatMembersAdd: vi.fn(),
}));

import {
  ChatBulkInviteDialog,
  isAlreadyMemberError,
  isYearValid,
} from '../src/routes/admin/ChatBulkInviteDialog';

describe('ChatBulkInviteDialog component', () => {
  const mockBasicData = {
    year: 2026,
    grades: [
      { grade: 1, classes: ['1', '2'] },
      { grade: 2, classes: ['1'] },
    ],
    rosters: {
      '1': {
        '1': ['s101@cam.hs.kr', 's102@cam.hs.kr'],
        '2': ['s121@cam.hs.kr'],
      },
      '2': {
        '1': ['s201@cam.hs.kr', 's202@cam.hs.kr', 's203@cam.hs.kr'],
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseBasicDataGet.mockReturnValue({
      data: { data: mockBasicData },
      isLoading: false,
      isError: false,
      error: null,
    });
    mockCallChatMembersAdd.mockResolvedValue({ member: {} });
  });

  // helper test for isAlreadyMemberError
  it('isAlreadyMemberError detects already member patterns', () => {
    expect(isAlreadyMemberError('User is already a member')).toBe(true);
    expect(isAlreadyMemberError('Duplicate membership')).toBe(true);
    expect(isAlreadyMemberError('member exists in space')).toBe(true);
    expect(isAlreadyMemberError('http_409 conflict')).toBe(true);
    expect(isAlreadyMemberError('internal server error')).toBe(false);
  });

  // helper test for isYearValid
  it('isYearValid validates year format and range', () => {
    expect(isYearValid('abc')).toBe(false);
    expect(isYearValid('1500')).toBe(false);
    expect(isYearValid('')).toBe(false);
    expect(isYearValid('2020.5')).toBe(false);
    expect(isYearValid('2201')).toBe(false);
    expect(isYearValid('2026')).toBe(true);
  });

  // 시나리오 1: open=false -> 미렌더
  it('scenario 1: does not render dialog when open is false', () => {
    render(
      <ChatBulkInviteDialog
        open={false}
        onOpenChange={vi.fn()}
        spaceName="spaces/AAAA"
        spaceDisplayName="1학년 1반 챗방"
      />,
    );

    expect(screen.queryByText('학급 일괄 초대')).toBeNull();
    expect(screen.queryByTestId('chat-bulk-invite-year-input')).toBeNull();
  });

  // 시나리오 2: year invalid -> 반 선택 초기화 · preview 버튼 disabled
  it('scenario 2: resets class selection and disables preview button on invalid year inputs', () => {
    render(
      <ChatBulkInviteDialog
        open={true}
        onOpenChange={vi.fn()}
        spaceName="spaces/AAAA"
        spaceDisplayName="1학년 1반 챗방"
      />,
    );

    const yearInput = screen.getByTestId('chat-bulk-invite-year-input') as HTMLInputElement;
    const previewBtn = screen.getByTestId('chat-bulk-invite-preview-btn') as HTMLButtonElement;

    // First select a class
    fireEvent.click(screen.getByTestId('chat-bulk-invite-class-btn-1-1'));
    expect(screen.getByTestId('chat-bulk-invite-preview')).toBeDefined();
    expect(previewBtn.disabled).toBe(false);

    // Test each invalid value
    const invalidValues = ['abc', '1500', '', '2020.5'];
    for (const invalidVal of invalidValues) {
      fireEvent.change(yearInput, { target: { value: invalidVal } });

      // selectedGrade/Class reset -> preview section hidden
      expect(screen.queryByTestId('chat-bulk-invite-preview')).toBeNull();
      // preview button disabled
      expect(previewBtn.disabled).toBe(true);
    }

    // Changing back to valid year keeps class selection cleared
    fireEvent.change(yearInput, { target: { value: '2026' } });
    expect(screen.queryByTestId('chat-bulk-invite-preview')).toBeNull();
    expect(previewBtn.disabled).toBe(true);
  });

  // 시나리오 3: 반 선택 -> preview 진입 -> 학생 리스트 렌더
  it('scenario 3: renders preview student email list when class button is clicked and enters preview phase', () => {
    render(
      <ChatBulkInviteDialog
        open={true}
        onOpenChange={vi.fn()}
        spaceName="spaces/AAAA"
        spaceDisplayName="1학년 1반 챗방"
      />,
    );

    fireEvent.click(screen.getByTestId('chat-bulk-invite-class-btn-1-1'));

    const preview = screen.getByTestId('chat-bulk-invite-preview');
    expect(preview).toBeDefined();
    expect(screen.getByText('s101@cam.hs.kr')).toBeDefined();
    expect(screen.getByText('s102@cam.hs.kr')).toBeDefined();

    const previewBtn = screen.getByTestId('chat-bulk-invite-preview-btn') as HTMLButtonElement;
    expect(previewBtn.disabled).toBe(false);

    // Click preview button to enter preview phase
    fireEvent.click(previewBtn);
    expect(screen.getByText('초대 대상 확인')).toBeDefined();
    expect(screen.getByText('1학년 1반 학생 명단')).toBeDefined();
    expect(screen.getByTestId('chat-bulk-invite-confirm-input')).toBeDefined();
  });

  // 시나리오 4: 확인 텍스트 오류 -> 「초대 실행」 disabled
  it('scenario 4: disables execute button when confirm text does not match student count', () => {
    render(
      <ChatBulkInviteDialog
        open={true}
        onOpenChange={vi.fn()}
        spaceName="spaces/AAAA"
        spaceDisplayName="1학년 1반 챗방"
      />,
    );

    // 1학년 1반 선택 (학생 2명)
    fireEvent.click(screen.getByTestId('chat-bulk-invite-class-btn-1-1'));
    fireEvent.click(screen.getByTestId('chat-bulk-invite-preview-btn'));

    expect(screen.getByText('초대 대상 확인')).toBeDefined();
    const confirmInput = screen.getByTestId('chat-bulk-invite-confirm-input') as HTMLInputElement;
    const executeBtn = screen.getByTestId('chat-bulk-invite-execute-btn') as HTMLButtonElement;

    expect(executeBtn.disabled).toBe(true);

    // 잘못된 숫자 입력
    fireEvent.change(confirmInput, { target: { value: '99' } });
    expect(executeBtn.disabled).toBe(true);

    // 문자가 포함된 잘못된 입력
    fireEvent.change(confirmInput, { target: { value: 'abc' } });
    expect(executeBtn.disabled).toBe(true);

    // 올바른 학생 수 (2) 입력 -> 활성화
    fireEvent.change(confirmInput, { target: { value: '2' } });
    expect(executeBtn.disabled).toBe(false);
  });

  // 시나리오 5: 「초대 실행」 -> mock callChatMembersAdd 순차 호출
  it('scenario 5: calls callChatMembersAdd sequentially and enters done phase on success', async () => {
    mockCallChatMembersAdd.mockResolvedValue({ member: {} });

    const onDone = vi.fn();
    render(
      <ChatBulkInviteDialog
        open={true}
        onOpenChange={vi.fn()}
        spaceName="spaces/AAAA"
        spaceDisplayName="1학년 1반 챗방"
        onDone={onDone}
      />,
    );

    fireEvent.click(screen.getByTestId('chat-bulk-invite-class-btn-1-1'));
    fireEvent.click(screen.getByTestId('chat-bulk-invite-preview-btn'));

    const confirmInput = screen.getByTestId('chat-bulk-invite-confirm-input');
    fireEvent.change(confirmInput, { target: { value: '2' } });

    const executeBtn = screen.getByTestId('chat-bulk-invite-execute-btn');
    await act(async () => {
      fireEvent.click(executeBtn);
    });

    expect(mockCallChatMembersAdd).toHaveBeenCalledTimes(2);
    expect(mockCallChatMembersAdd).toHaveBeenNthCalledWith(1, {
      spaceName: 'spaces/AAAA',
      email: 's101@cam.hs.kr',
    });
    expect(mockCallChatMembersAdd).toHaveBeenNthCalledWith(2, {
      spaceName: 'spaces/AAAA',
      email: 's102@cam.hs.kr',
    });

    expect(screen.getByTestId('chat-bulk-invite-done')).toBeDefined();
    expect(screen.getByTestId('chat-bulk-invite-done').textContent).toContain('2명 성공');
  });

  // 시나리오 6: 이미 멤버 (409) -> skipped 분류
  it('scenario 6: classifies duplicate errors as skipped and renders skipped list', async () => {
    mockCallChatMembersAdd
      .mockResolvedValueOnce({ member: {} })
      .mockRejectedValueOnce(new Error('User is already a member (http_409)'));

    render(
      <ChatBulkInviteDialog
        open={true}
        onOpenChange={vi.fn()}
        spaceName="spaces/AAAA"
        spaceDisplayName="1학년 1반 챗방"
      />,
    );

    fireEvent.click(screen.getByTestId('chat-bulk-invite-class-btn-1-1'));
    fireEvent.click(screen.getByTestId('chat-bulk-invite-preview-btn'));

    const confirmInput = screen.getByTestId('chat-bulk-invite-confirm-input');
    fireEvent.change(confirmInput, { target: { value: '2' } });

    await act(async () => {
      fireEvent.click(screen.getByTestId('chat-bulk-invite-execute-btn'));
    });

    const doneEl = screen.getByTestId('chat-bulk-invite-done');
    expect(doneEl).toBeDefined();
    expect(doneEl.textContent).toContain('1명 성공');
    expect(doneEl.textContent).toContain('1명 이미 멤버 (skip)');

    const skippedList = screen.getByTestId('chat-bulk-invite-skipped');
    expect(skippedList).toBeDefined();
    expect(skippedList.textContent).toContain('s102@cam.hs.kr');
  });

  // 시나리오 7: failed -> failed 리스트 렌더 (Directory resolver failure 포함)
  it('scenario 7: classifies other errors as failed and renders failure list', async () => {
    mockCallChatMembersAdd
      .mockResolvedValueOnce({ member: {} })
      .mockRejectedValueOnce(new Error('Directory resolver failed: user not found'));

    render(
      <ChatBulkInviteDialog
        open={true}
        onOpenChange={vi.fn()}
        spaceName="spaces/AAAA"
        spaceDisplayName="1학년 1반 챗방"
      />,
    );

    fireEvent.click(screen.getByTestId('chat-bulk-invite-class-btn-1-1'));
    fireEvent.click(screen.getByTestId('chat-bulk-invite-preview-btn'));

    const confirmInput = screen.getByTestId('chat-bulk-invite-confirm-input');
    fireEvent.change(confirmInput, { target: { value: '2' } });

    await act(async () => {
      fireEvent.click(screen.getByTestId('chat-bulk-invite-execute-btn'));
    });

    const doneEl = screen.getByTestId('chat-bulk-invite-done');
    expect(doneEl).toBeDefined();
    expect(doneEl.textContent).toContain('1명 성공');
    expect(doneEl.textContent).toContain('1명 실패');

    const failureList = screen.getByTestId('chat-bulk-invite-failures');
    expect(failureList).toBeDefined();
    expect(failureList.textContent).toContain('s102@cam.hs.kr');
    expect(failureList.textContent).toContain('Directory resolver failed: user not found');
  });

  // 시나리오 8: 종료 시 invalidateQueries 1회 (mock spy)
  it('scenario 8: does not call invalidateQueries during batch execute, calls it only once upon completion', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    let addCalls = 0;
    mockCallChatMembersAdd.mockImplementation(async () => {
      addCalls++;
      expect(invalidateSpy).not.toHaveBeenCalled();
      return { member: {} };
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ChatBulkInviteDialog
          open={true}
          onOpenChange={vi.fn()}
          spaceName="spaces/AAAA"
          spaceDisplayName="1학년 1반 챗방"
        />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByTestId('chat-bulk-invite-class-btn-1-1'));
    fireEvent.click(screen.getByTestId('chat-bulk-invite-preview-btn'));

    const confirmInput = screen.getByTestId('chat-bulk-invite-confirm-input');
    fireEvent.change(confirmInput, { target: { value: '2' } });

    const executeBtn = screen.getByTestId('chat-bulk-invite-execute-btn');
    await act(async () => {
      fireEvent.click(executeBtn);
    });

    expect(addCalls).toBe(2);
    expect(mockCallChatMembersAdd).toHaveBeenCalledTimes(2);
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['chat', 'members', 'spaces/AAAA'],
    });
  });

  // 시나리오 9: running 중 close 차단
  it('scenario 9: prevents dialog close while in running phase', async () => {
    let resolveCall: () => void = () => {};
    mockCallChatMembersAdd.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCall = () => resolve({ member: {} });
        }),
    );

    const onOpenChange = vi.fn();
    render(
      <ChatBulkInviteDialog
        open={true}
        onOpenChange={onOpenChange}
        spaceName="spaces/AAAA"
        spaceDisplayName="1학년 1반 챗방"
      />,
    );

    fireEvent.click(screen.getByTestId('chat-bulk-invite-class-btn-1-1'));
    fireEvent.click(screen.getByTestId('chat-bulk-invite-preview-btn'));

    const confirmInput = screen.getByTestId('chat-bulk-invite-confirm-input');
    fireEvent.change(confirmInput, { target: { value: '2' } });

    const executeBtn = screen.getByTestId('chat-bulk-invite-execute-btn');
    // Start execute
    act(() => {
      fireEvent.click(executeBtn);
    });

    expect(screen.getByTestId('chat-bulk-invite-running')).toBeDefined();

    // Try to trigger escape or close
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    expect(onOpenChange).not.toHaveBeenCalled();

    // Complete executions
    await act(async () => {
      resolveCall();
    });
  });

  // 시나리오 10: 완료 후 「확인」 클릭 -> onOpenChange(false) + onDone() 호출
  it('scenario 10: calls onOpenChange(false) and onDone when confirm button is clicked in done phase', async () => {
    mockCallChatMembersAdd.mockResolvedValue({ member: {} });

    const onOpenChange = vi.fn();
    const onDone = vi.fn();
    render(
      <ChatBulkInviteDialog
        open={true}
        onOpenChange={onOpenChange}
        spaceName="spaces/AAAA"
        spaceDisplayName="1학년 1반 챗방"
        onDone={onDone}
      />,
    );

    fireEvent.click(screen.getByTestId('chat-bulk-invite-class-btn-1-1'));
    fireEvent.click(screen.getByTestId('chat-bulk-invite-preview-btn'));

    fireEvent.change(screen.getByTestId('chat-bulk-invite-confirm-input'), {
      target: { value: '2' },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('chat-bulk-invite-execute-btn'));
    });

    const confirmBtn = screen.getByRole('button', { name: '확인' });
    fireEvent.click(confirmBtn);

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
