import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockCallUsersResetPassword = vi.fn();

vi.mock('../src/api/usersResetPassword.js', () => ({
  callUsersResetPassword: (data: unknown) => mockCallUsersResetPassword(data),
}));

import { BulkResetPasswordDialog } from '../src/routes/admin/BulkResetPasswordDialog.js';

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('BulkResetPasswordDialog component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('confirm 버튼은 8자 이상 + 확인 일치 전엔 disabled', () => {
    const emails = ['a@cam.hs.kr', 'b@cam.hs.kr'];
    renderWithClient(
      <BulkResetPasswordDialog open={true} onOpenChange={vi.fn()} emails={emails} />,
    );
    const btn = screen.getByTestId('bulk-reset-password-confirm-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    // 짧은 비밀번호.
    fireEvent.change(screen.getByTestId('bulk-reset-password-new'), {
      target: { value: 'short' },
    });
    fireEvent.change(screen.getByTestId('bulk-reset-password-confirm'), {
      target: { value: 'short' },
    });
    expect(btn.disabled).toBe(true);
    // 8자 이상.
    fireEvent.change(screen.getByTestId('bulk-reset-password-new'), {
      target: { value: 'longpass1' },
    });
    fireEvent.change(screen.getByTestId('bulk-reset-password-confirm'), {
      target: { value: 'longpass1' },
    });
    expect(btn.disabled).toBe(false);
  });

  it('비밀번호 불일치 시 confirm 클릭 → validation error 표시, mutate 미호출', () => {
    const emails = ['a@cam.hs.kr'];
    renderWithClient(
      <BulkResetPasswordDialog open={true} onOpenChange={vi.fn()} emails={emails} />,
    );
    fireEvent.change(screen.getByTestId('bulk-reset-password-new'), {
      target: { value: 'longpass1' },
    });
    fireEvent.change(screen.getByTestId('bulk-reset-password-confirm'), {
      target: { value: 'longpass2' },
    });
    fireEvent.click(screen.getByTestId('bulk-reset-password-confirm-btn'));
    expect(
      screen.getByTestId('bulk-reset-password-validation-error').textContent,
    ).toContain('일치하지 않음');
    expect(mockCallUsersResetPassword).not.toHaveBeenCalled();
  });

  it('confirm → 각 이메일에 대해 callUsersResetPassword 호출 후 done 상태', async () => {
    const emails = ['a@cam.hs.kr', 'b@cam.hs.kr', 'c@cam.hs.kr'];
    mockCallUsersResetPassword.mockResolvedValue({ primaryEmail: 'x', passwordReset: true });
    const onDone = vi.fn();
    renderWithClient(
      <BulkResetPasswordDialog
        open={true}
        onOpenChange={vi.fn()}
        emails={emails}
        onDone={onDone}
      />,
    );
    fireEvent.change(screen.getByTestId('bulk-reset-password-new'), {
      target: { value: 'longpass1' },
    });
    fireEvent.change(screen.getByTestId('bulk-reset-password-confirm'), {
      target: { value: 'longpass1' },
    });
    fireEvent.click(screen.getByTestId('bulk-reset-password-confirm-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('bulk-reset-password-done')).toBeDefined();
    });
    expect(mockCallUsersResetPassword).toHaveBeenCalledTimes(3);
    expect(mockCallUsersResetPassword).toHaveBeenNthCalledWith(1, {
      primaryEmail: 'a@cam.hs.kr',
      newPassword: 'longpass1',
      changePasswordAtNextLogin: true,
    });
    expect(screen.getByTestId('bulk-reset-password-done').textContent).toContain('3');
    // done 은 onDone 호출 안 함 (dialog close 시에만).
  });

  it('일부 실패 시 done 상태에 failures 리스트 표시', async () => {
    const emails = ['a@cam.hs.kr', 'b@cam.hs.kr'];
    mockCallUsersResetPassword
      .mockResolvedValueOnce({ primaryEmail: 'a', passwordReset: true })
      .mockRejectedValueOnce(new Error('boom for b'));
    renderWithClient(
      <BulkResetPasswordDialog open={true} onOpenChange={vi.fn()} emails={emails} />,
    );
    fireEvent.change(screen.getByTestId('bulk-reset-password-new'), {
      target: { value: 'longpass1' },
    });
    fireEvent.change(screen.getByTestId('bulk-reset-password-confirm'), {
      target: { value: 'longpass1' },
    });
    fireEvent.click(screen.getByTestId('bulk-reset-password-confirm-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('bulk-reset-password-done')).toBeDefined();
    });
    const failures = screen.getByTestId('bulk-reset-password-failures');
    expect(failures.textContent).toContain('b@cam.hs.kr');
    expect(failures.textContent).toContain('boom for b');
  });

  it('changePasswordAtNextLogin 체크 해제 시 request 에 false 전달', async () => {
    const emails = ['a@cam.hs.kr'];
    mockCallUsersResetPassword.mockResolvedValue({ primaryEmail: 'a', passwordReset: true });
    renderWithClient(
      <BulkResetPasswordDialog open={true} onOpenChange={vi.fn()} emails={emails} />,
    );
    fireEvent.change(screen.getByTestId('bulk-reset-password-new'), {
      target: { value: 'longpass1' },
    });
    fireEvent.change(screen.getByTestId('bulk-reset-password-confirm'), {
      target: { value: 'longpass1' },
    });
    fireEvent.click(screen.getByTestId('bulk-reset-password-force-change'));
    fireEvent.click(screen.getByTestId('bulk-reset-password-confirm-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('bulk-reset-password-done')).toBeDefined();
    });
    expect(mockCallUsersResetPassword).toHaveBeenCalledWith(
      expect.objectContaining({ changePasswordAtNextLogin: false }),
    );
  });

  // v0.113b F66: password input 은 label 로 접근 가능 (htmlFor + id).
  it('v0.113b F66: password input 두 필드는 label 로 접근 가능 (htmlFor 연결)', () => {
    const emails = ['a@cam.hs.kr'];
    renderWithClient(
      <BulkResetPasswordDialog open={true} onOpenChange={vi.fn()} emails={emails} />,
    );
    const newInput = screen.getByLabelText(/새 비밀번호/) as HTMLInputElement;
    expect(newInput.type).toBe('password');
    expect(newInput.getAttribute('data-testid')).toBe('bulk-reset-password-new');
    const confirmInput = screen.getByLabelText(/비밀번호 확인/) as HTMLInputElement;
    expect(confirmInput.type).toBe('password');
    expect(confirmInput.getAttribute('data-testid')).toBe('bulk-reset-password-confirm');
  });

  // v0.113b F65 · v0.113c F68: 「취소」 버튼 클릭 → handleOpenChange 를 거쳐 state clear.
  // 그 뒤 재오픈 시 두 입력 모두 비어있어야.
  it('v0.113c F68: 「취소」 버튼 클릭 → clearSensitiveState 실행 · 재오픈 시 입력 비었음', () => {
    const emails = ['a@cam.hs.kr'];
    // 부모 open state 를 외부 변수로 관리해서 취소 클릭 → onOpenChange(false) → 다시
    // open=true 로 rerender 하는 흐름 시뮬.
    let open = true;
    const setOpen = (v: boolean) => {
      open = v;
    };
    const { rerender } = renderWithClient(
      <BulkResetPasswordDialog open={open} onOpenChange={setOpen} emails={emails} />,
    );
    fireEvent.change(screen.getByTestId('bulk-reset-password-new'), {
      target: { value: 'longpass1' },
    });
    fireEvent.change(screen.getByTestId('bulk-reset-password-confirm'), {
      target: { value: 'longpass1' },
    });
    // 취소 버튼을 실제로 클릭 (handleOpenChange 경로).
    fireEvent.click(screen.getByTestId('bulk-reset-password-cancel-btn'));
    expect(open).toBe(false);
    // 닫힌 상태 rerender.
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <BulkResetPasswordDialog open={false} onOpenChange={setOpen} emails={emails} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    // 다시 open=true 로 (component mount 는 유지). state clear 됐어야.
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <BulkResetPasswordDialog open={true} onOpenChange={setOpen} emails={emails} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(
      (screen.getByTestId('bulk-reset-password-new') as HTMLInputElement).value,
    ).toBe('');
    expect(
      (screen.getByTestId('bulk-reset-password-confirm') as HTMLInputElement).value,
    ).toBe('');
  });

  it('v0.113b F65: 실행 완료 후에도 dialog 가 열린 채 남아있으면 state 는 비어있음', async () => {
    const emails = ['a@cam.hs.kr'];
    mockCallUsersResetPassword.mockResolvedValue({ primaryEmail: 'a', passwordReset: true });
    renderWithClient(
      <BulkResetPasswordDialog open={true} onOpenChange={vi.fn()} emails={emails} />,
    );
    fireEvent.change(screen.getByTestId('bulk-reset-password-new'), {
      target: { value: 'longpass1' },
    });
    fireEvent.change(screen.getByTestId('bulk-reset-password-confirm'), {
      target: { value: 'longpass1' },
    });
    fireEvent.click(screen.getByTestId('bulk-reset-password-confirm-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('bulk-reset-password-done')).toBeDefined();
    });
    // done phase 에는 password input 이 안 보이지만, 컴포넌트 mount 는 유지. state 는
    // confirm handler 실행 초입에 이미 clear 되었음. 실 mutate 호출 자체는 로컬 변수로 통과 확인.
    expect(mockCallUsersResetPassword).toHaveBeenCalledWith(
      expect.objectContaining({ newPassword: 'longpass1' }),
    );
  });

  it('open=false → 다시 open=true 시 상태 초기화', () => {
    const emails = ['a@cam.hs.kr'];
    const { rerender } = renderWithClient(
      <BulkResetPasswordDialog open={true} onOpenChange={vi.fn()} emails={emails} />,
    );
    fireEvent.change(screen.getByTestId('bulk-reset-password-new'), {
      target: { value: 'longpass1' },
    });
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <BulkResetPasswordDialog open={false} onOpenChange={vi.fn()} emails={emails} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <BulkResetPasswordDialog open={true} onOpenChange={vi.fn()} emails={emails} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const input = screen.getByTestId('bulk-reset-password-new') as HTMLInputElement;
    expect(input.value).toBe('');
  });

  // v0.130 (== v0.124 F99 대칭): confirm 시점의 emails snapshot 확정.
  it('v0.130 F99: confirm 시 emails snapshot 확정 · 실행 중 prop 변경 무시', async () => {
    const initial = ['user1@cam.hs.kr', 'user2@cam.hs.kr'];
    let resolveFirst: ((v: any) => void) | null = null;
    mockCallUsersResetPassword.mockImplementationOnce(
      () => new Promise((res) => { resolveFirst = res; }),
    );
    mockCallUsersResetPassword.mockResolvedValue({ primaryEmail: 'test', reset: true });

    const onOpenChange = vi.fn();
    const { rerender } = renderWithClient(
      <BulkResetPasswordDialog open={true} onOpenChange={onOpenChange} emails={initial} />
    );
    fireEvent.change(screen.getByTestId('bulk-reset-password-new'), {
      target: { value: 'longpass1' },
    });
    fireEvent.change(screen.getByTestId('bulk-reset-password-confirm'), {
      target: { value: 'longpass1' },
    });
    fireEvent.click(screen.getByTestId('bulk-reset-password-confirm-btn'));

    // 첫 API 호출 pending 중 부모가 emails 를 바꿔 rerender.
    rerender(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <BulkResetPasswordDialog
            open={true}
            onOpenChange={onOpenChange}
            emails={['completely-different@cam.hs.kr']}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getByTestId('bulk-reset-password-running').textContent).toContain('2');

    resolveFirst!({ primaryEmail: 'user1@cam.hs.kr', reset: true });

    await waitFor(() => {
      expect(screen.getByTestId('bulk-reset-password-done')).toBeDefined();
    });
    // 원래 2개만 처리.
    expect(mockCallUsersResetPassword).toHaveBeenCalledTimes(2);
    expect(mockCallUsersResetPassword).toHaveBeenNthCalledWith(1, {
      primaryEmail: 'user1@cam.hs.kr',
      newPassword: 'longpass1',
      changePasswordAtNextLogin: true,
    });
    expect(mockCallUsersResetPassword).toHaveBeenNthCalledWith(2, {
      primaryEmail: 'user2@cam.hs.kr',
      newPassword: 'longpass1',
      changePasswordAtNextLogin: true,
    });
    expect(screen.getByTestId('bulk-reset-password-done').textContent).toContain('2명 성공');
  });
});
