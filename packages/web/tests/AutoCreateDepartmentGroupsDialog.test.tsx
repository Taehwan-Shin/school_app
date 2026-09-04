import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockCallGroupsCreate = vi.fn();
const mockCallGroupsMembersInsert = vi.fn();

vi.mock('../src/api/groupsCreate.js', () => ({
  callGroupsCreate: (data: unknown) => mockCallGroupsCreate(data),
}));

vi.mock('../src/api/groupsMembersInsert.js', () => ({
  callGroupsMembersInsert: (data: unknown) => mockCallGroupsMembersInsert(data),
}));

import { AutoCreateDepartmentGroupsDialog } from '../src/routes/admin/AutoCreateDepartmentGroupsDialog.js';

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('AutoCreateDepartmentGroupsDialog component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('scenario 1: renders 2 rows for departments with default slugs dept-1 and dept-2', () => {
    const departments = ['국어과', '수학과'];
    renderWithClient(
      <AutoCreateDepartmentGroupsDialog
        open={true}
        onOpenChange={vi.fn()}
        year={2026}
        departments={departments}
      />
    );

    expect(screen.getByText('국어과')).toBeDefined();
    expect(screen.getByText('수학과')).toBeDefined();

    const slug0 = screen.getByTestId('auto-create-dept-slug-0') as HTMLInputElement;
    const slug1 = screen.getByTestId('auto-create-dept-slug-1') as HTMLInputElement;
    expect(slug0.value).toBe('dept-1');
    expect(slug1.value).toBe('dept-2');

    expect(screen.getByText('dept-1@cam.hs.kr')).toBeDefined();
    expect(screen.getByText('dept-2@cam.hs.kr')).toBeDefined();

    const confirmBtn = screen.getByTestId('auto-create-dept-groups-confirm-btn') as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(false);
  });

  it('scenario 2: disables confirm button and marks invalid when slug or owner is invalid', () => {
    const departments = ['국어과', '수학과'];
    renderWithClient(
      <AutoCreateDepartmentGroupsDialog
        open={true}
        onOpenChange={vi.fn()}
        year={2026}
        departments={departments}
      />
    );

    const slug0 = screen.getByTestId('auto-create-dept-slug-0') as HTMLInputElement;
    fireEvent.change(slug0, { target: { value: 'Korean!' } });

    expect(screen.getByText('invalid')).toBeDefined();
    expect(screen.getByText('일부 slug 또는 부서장 이메일이 유효하지 않습니다.')).toBeDefined();

    const confirmBtn = screen.getByTestId('auto-create-dept-groups-confirm-btn') as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(true);

    // Reset slug
    fireEvent.change(slug0, { target: { value: 'dept-1' } });
    expect(confirmBtn.disabled).toBe(false);

    // Enter invalid owner email
    const owner0 = screen.getByTestId('auto-create-dept-owner-0') as HTMLInputElement;
    fireEvent.change(owner0, { target: { value: 'not-an-email' } });
    expect(screen.getByText('일부 slug 또는 부서장 이메일이 유효하지 않습니다.')).toBeDefined();
    expect(confirmBtn.disabled).toBe(true);
  });

  it('scenario 3: disables confirm button and displays duplicate error message when slugs are duplicated', () => {
    const departments = ['국어과', '수학과'];
    renderWithClient(
      <AutoCreateDepartmentGroupsDialog
        open={true}
        onOpenChange={vi.fn()}
        year={2026}
        departments={departments}
      />
    );

    const slug1 = screen.getByTestId('auto-create-dept-slug-1') as HTMLInputElement;
    fireEvent.change(slug1, { target: { value: 'dept-1' } });

    expect(screen.getByText('중복된 slug 이 있습니다.')).toBeDefined();

    const confirmBtn = screen.getByTestId('auto-create-dept-groups-confirm-btn') as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(true);
  });

  it('scenario 4: iterates callGroupsCreate and displays 3 counts (success, skip, failed) in done phase', async () => {
    const departments = ['국어과', '수학과', '영어과'];
    mockCallGroupsCreate
      .mockResolvedValueOnce({ id: 'grp-1', email: 'dept-1@cam.hs.kr' })
      .mockRejectedValueOnce(new Error('Entity already exists'))
      .mockRejectedValueOnce(new Error('network error'));

    const onDone = vi.fn();
    const onOpenChange = vi.fn();

    renderWithClient(
      <AutoCreateDepartmentGroupsDialog
        open={true}
        onOpenChange={onOpenChange}
        year={2026}
        departments={departments}
        onDone={onDone}
      />
    );

    const confirmBtn = screen.getByTestId('auto-create-dept-groups-confirm-btn');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByTestId('auto-create-dept-groups-done')).toBeDefined();
    });

    expect(mockCallGroupsCreate).toHaveBeenCalledTimes(3);
    expect(mockCallGroupsCreate).toHaveBeenNthCalledWith(1, {
      email: 'dept-1@cam.hs.kr',
      name: '국어과',
      description: '2026년 국어과 자동 생성',
    });
    expect(mockCallGroupsCreate).toHaveBeenNthCalledWith(2, {
      email: 'dept-2@cam.hs.kr',
      name: '수학과',
      description: '2026년 수학과 자동 생성',
    });
    expect(mockCallGroupsCreate).toHaveBeenNthCalledWith(3, {
      email: 'dept-3@cam.hs.kr',
      name: '영어과',
      description: '2026년 영어과 자동 생성',
    });

    const doneText = screen.getByTestId('auto-create-dept-groups-done').textContent;
    expect(doneText).toContain('1개 성공');
    expect(doneText).toContain('1개 이미 존재 (skip)');
    expect(doneText).toContain('1개 실패');

    const skippedEl = screen.getByTestId('auto-create-dept-groups-skipped');
    expect(skippedEl.textContent).toContain('dept-2@cam.hs.kr');
    expect(skippedEl.textContent).toContain('이미 존재');

    const failuresEl = screen.getByTestId('auto-create-dept-groups-failures');
    expect(failuresEl.textContent).toContain('dept-3@cam.hs.kr');
    expect(failuresEl.textContent).toContain('network error');

    const okBtn = screen.getByRole('button', { name: '확인' });
    fireEvent.click(okBtn);

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onDone).toHaveBeenCalled();
  });

  it('scenario 5: runs without owner - calls callGroupsCreate twice and does not call callGroupsMembersInsert', async () => {
    const departments = ['국어과', '수학과'];
    mockCallGroupsCreate.mockResolvedValue({ id: 'grp-1', email: 'dept-1@cam.hs.kr' });

    renderWithClient(
      <AutoCreateDepartmentGroupsDialog
        open={true}
        onOpenChange={vi.fn()}
        year={2026}
        departments={departments}
      />
    );

    const confirmBtn = screen.getByTestId('auto-create-dept-groups-confirm-btn');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByTestId('auto-create-dept-groups-done')).toBeDefined();
    });

    expect(mockCallGroupsCreate).toHaveBeenCalledTimes(2);
    expect(mockCallGroupsMembersInsert).not.toHaveBeenCalled();
  });

  it('scenario 6: runs with owner - calls callGroupsCreate and callGroupsMembersInsert with role OWNER', async () => {
    const departments = ['국어과'];
    mockCallGroupsCreate.mockResolvedValue({ id: 'grp-1', email: 'dept-1@cam.hs.kr' });
    mockCallGroupsMembersInsert.mockResolvedValue({ success: true });

    renderWithClient(
      <AutoCreateDepartmentGroupsDialog
        open={true}
        onOpenChange={vi.fn()}
        year={2026}
        departments={departments}
      />
    );

    const ownerInput = screen.getByTestId('auto-create-dept-owner-0') as HTMLInputElement;
    fireEvent.change(ownerInput, { target: { value: 'teacher@cam.hs.kr' } });

    const confirmBtn = screen.getByTestId('auto-create-dept-groups-confirm-btn');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByTestId('auto-create-dept-groups-done')).toBeDefined();
    });

    expect(mockCallGroupsCreate).toHaveBeenCalledTimes(1);
    expect(mockCallGroupsCreate).toHaveBeenCalledWith({
      email: 'dept-1@cam.hs.kr',
      name: '국어과',
      description: '2026년 국어과 자동 생성',
    });

    expect(mockCallGroupsMembersInsert).toHaveBeenCalledTimes(1);
    expect(mockCallGroupsMembersInsert).toHaveBeenCalledWith({
      groupEmail: 'dept-1@cam.hs.kr',
      memberEmail: 'teacher@cam.hs.kr',
      role: 'OWNER',
    });
  });
});
