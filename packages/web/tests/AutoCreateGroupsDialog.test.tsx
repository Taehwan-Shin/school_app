import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockCallGroupsCreate = vi.fn();

vi.mock('../src/api/groupsCreate.js', () => ({
  callGroupsCreate: (data: unknown) => mockCallGroupsCreate(data),
}));

import { AutoCreateGroupsDialog } from '../src/routes/admin/AutoCreateGroupsDialog.js';

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

describe('AutoCreateGroupsDialog component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('scenario 1: renders 2 targets for grade 1 classes A and B', () => {
    const grades = [{ grade: 1, classes: ['A', 'B'] }];
    renderWithClient(
      <AutoCreateGroupsDialog
        open={true}
        onOpenChange={vi.fn()}
        year={2026}
        grades={grades}
      />
    );

    expect(screen.getByText('class-1a@cam.hs.kr')).toBeDefined();
    expect(screen.getByText('class-1b@cam.hs.kr')).toBeDefined();
    expect(screen.getByText('1학년 A반')).toBeDefined();
    expect(screen.getByText('1학년 B반')).toBeDefined();

    const confirmBtn = screen.getByTestId('auto-create-groups-confirm-btn') as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(true);
  });

  it('scenario 2: iterates callGroupsCreate on confirm and transitions to done phase with 0 failures', async () => {
    const grades = [{ grade: 1, classes: ['A', 'B'] }];
    mockCallGroupsCreate.mockResolvedValue({ id: 'grp-1', email: 'class-1a@cam.hs.kr' });
    const onDone = vi.fn();
    const onOpenChange = vi.fn();

    renderWithClient(
      <AutoCreateGroupsDialog
        open={true}
        onOpenChange={onOpenChange}
        year={2026}
        grades={grades}
        onDone={onDone}
      />
    );

    const confirmInput = screen.getByTestId('auto-create-groups-confirm-input');
    fireEvent.change(confirmInput, { target: { value: '2' } });

    const confirmBtn = screen.getByTestId('auto-create-groups-confirm-btn');
    expect((confirmBtn as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByTestId('auto-create-groups-done')).toBeDefined();
    });

    expect(mockCallGroupsCreate).toHaveBeenCalledTimes(2);
    expect(mockCallGroupsCreate).toHaveBeenNthCalledWith(1, {
      email: 'class-1a@cam.hs.kr',
      name: '1학년 A반',
      description: '2026년 1학년 A반 자동 생성',
    });
    expect(mockCallGroupsCreate).toHaveBeenNthCalledWith(2, {
      email: 'class-1b@cam.hs.kr',
      name: '1학년 B반',
      description: '2026년 1학년 B반 자동 생성',
    });

    const doneText = screen.getByTestId('auto-create-groups-done').textContent;
    expect(doneText).toContain('2개 성공');
    expect(screen.queryByTestId('auto-create-groups-failures')).toBeNull();

    const okBtn = screen.getByRole('button', { name: '확인' });
    fireEvent.click(okBtn);

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onDone).toHaveBeenCalled();
  });

  it('scenario 3: handles rejection and displays failed email with raw error message in done phase', async () => {
    const grades = [{ grade: 1, classes: ['A', 'B'] }];
    mockCallGroupsCreate
      .mockResolvedValueOnce({ id: 'grp-1', email: 'class-1a@cam.hs.kr' })
      .mockRejectedValueOnce(new Error('already exists'));

    renderWithClient(
      <AutoCreateGroupsDialog
        open={true}
        onOpenChange={vi.fn()}
        year={2026}
        grades={grades}
      />
    );

    const confirmInput = screen.getByTestId('auto-create-groups-confirm-input');
    fireEvent.change(confirmInput, { target: { value: '2' } });

    const confirmBtn = screen.getByTestId('auto-create-groups-confirm-btn');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByTestId('auto-create-groups-done')).toBeDefined();
    });

    expect(mockCallGroupsCreate).toHaveBeenCalledTimes(2);
    const doneText = screen.getByTestId('auto-create-groups-done').textContent;
    expect(doneText).toContain('1개 성공');
    expect(doneText).toContain('1개 실패');

    const failuresEl = screen.getByTestId('auto-create-groups-failures');
    expect(failuresEl.textContent).toContain('class-1b@cam.hs.kr');
    expect(failuresEl.textContent).toContain('already exists');
  });
});
