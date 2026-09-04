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
      .mockRejectedValueOnce(new Error('network error'));

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
    expect(failuresEl.textContent).toContain('network error');
    expect(screen.queryByTestId('auto-create-groups-skipped')).toBeNull();
  });

  it('scenario 4: separates already exists errors into skipped category in done phase', async () => {
    const grades = [{ grade: 1, classes: ['A', 'B', 'C'] }];
    mockCallGroupsCreate
      .mockResolvedValueOnce({ id: 'grp-1', email: 'class-1a@cam.hs.kr' })
      .mockRejectedValueOnce(new Error('Entity already exists'))
      .mockRejectedValueOnce(new Error('network error'));

    renderWithClient(
      <AutoCreateGroupsDialog
        open={true}
        onOpenChange={vi.fn()}
        year={2026}
        grades={grades}
      />
    );

    const confirmInput = screen.getByTestId('auto-create-groups-confirm-input');
    fireEvent.change(confirmInput, { target: { value: '3' } });

    const confirmBtn = screen.getByTestId('auto-create-groups-confirm-btn');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByTestId('auto-create-groups-done')).toBeDefined();
    });

    expect(mockCallGroupsCreate).toHaveBeenCalledTimes(3);
    const doneText = screen.getByTestId('auto-create-groups-done').textContent;
    expect(doneText).toContain('1개 성공');
    expect(doneText).toContain('1개 이미 존재 (skip)');
    expect(doneText).toContain('1개 실패');

    const skippedEl = screen.getByTestId('auto-create-groups-skipped');
    expect(skippedEl.textContent).toContain('class-1b@cam.hs.kr');
    expect(skippedEl.textContent).toContain('이미 존재');

    const failuresEl = screen.getByTestId('auto-create-groups-failures');
    expect(failuresEl.textContent).toContain('class-1c@cam.hs.kr');
    expect(failuresEl.textContent).toContain('network error');
  });

  it('scenario 5: renders prefix input with default value class and displays default email preview', () => {
    const grades = [{ grade: 1, classes: ['A'] }];
    renderWithClient(
      <AutoCreateGroupsDialog
        open={true}
        onOpenChange={vi.fn()}
        year={2026}
        grades={grades}
      />
    );

    const prefixInput = screen.getByTestId('auto-create-groups-prefix-input') as HTMLInputElement;
    expect(prefixInput.value).toBe('class');
    expect(screen.getByText('class-1a@cam.hs.kr')).toBeDefined();
  });

  it('scenario 6: recalculates preview emails on prefix edit and enforces prefix validation on confirm button', () => {
    const grades = [{ grade: 1, classes: ['A'] }];
    renderWithClient(
      <AutoCreateGroupsDialog
        open={true}
        onOpenChange={vi.fn()}
        year={2026}
        grades={grades}
      />
    );

    const prefixInput = screen.getByTestId('auto-create-groups-prefix-input') as HTMLInputElement;
    const confirmInput = screen.getByTestId('auto-create-groups-confirm-input');
    const confirmBtn = screen.getByTestId('auto-create-groups-confirm-btn') as HTMLButtonElement;

    // Type matching count
    fireEvent.change(confirmInput, { target: { value: '1' } });
    expect(confirmBtn.disabled).toBe(false);

    // Edit prefix to homeroom
    fireEvent.change(prefixInput, { target: { value: 'homeroom' } });
    expect(screen.getByText('homeroom-1a@cam.hs.kr')).toBeDefined();
    expect(screen.queryByText('class-1a@cam.hs.kr')).toBeNull();
    expect(confirmBtn.disabled).toBe(false);

    // Invalid prefix: empty
    fireEvent.change(prefixInput, { target: { value: '' } });
    expect(confirmBtn.disabled).toBe(true);

    // Invalid prefix: special characters
    fireEvent.change(prefixInput, { target: { value: 'class!' } });
    expect(confirmBtn.disabled).toBe(true);

    // Valid prefix: 2026-students
    fireEvent.change(prefixInput, { target: { value: '2026-students' } });
    expect(screen.getByText('2026-students-1a@cam.hs.kr')).toBeDefined();
    expect(confirmBtn.disabled).toBe(false);
  });

  it('scenario 7: with rosters provided, checkbox defaults to unchecked and only creates groups on confirm', async () => {
    const grades = [{ grade: 1, classes: ['A'] }];
    const rosters = { '1': { A: ['student1@cam.hs.kr', 'student2@cam.hs.kr'] } };
    mockCallGroupsCreate.mockResolvedValue({ id: 'grp-1', email: 'class-1a@cam.hs.kr' });

    renderWithClient(
      <AutoCreateGroupsDialog
        open={true}
        onOpenChange={vi.fn()}
        year={2026}
        grades={grades}
        rosters={rosters}
      />
    );

    const checkbox = screen.getByTestId('auto-create-groups-invite-students') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    expect(checkbox.disabled).toBe(false);

    const confirmInput = screen.getByTestId('auto-create-groups-confirm-input');
    fireEvent.change(confirmInput, { target: { value: '1' } });

    const confirmBtn = screen.getByTestId('auto-create-groups-confirm-btn');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByTestId('auto-create-groups-done')).toBeDefined();
    });

    expect(mockCallGroupsCreate).toHaveBeenCalledTimes(1);
    expect(mockCallGroupsMembersInsert).not.toHaveBeenCalled();
    const doneText = screen.getByTestId('auto-create-groups-done').textContent;
    expect(doneText).toContain('1개 성공');
  });

  it('scenario 8: when checkbox is checked, iterates groupsCreate then groupsMembersInsert for total ops', async () => {
    const grades = [{ grade: 1, classes: ['A'] }];
    const rosters = { '1': { A: ['student1@cam.hs.kr', 'student2@cam.hs.kr'] } };
    mockCallGroupsCreate.mockResolvedValue({ id: 'grp-1', email: 'class-1a@cam.hs.kr' });
    mockCallGroupsMembersInsert.mockResolvedValue({
      groupEmail: 'class-1a@cam.hs.kr',
      memberEmail: 'student1@cam.hs.kr',
      role: 'MEMBER',
    });

    renderWithClient(
      <AutoCreateGroupsDialog
        open={true}
        onOpenChange={vi.fn()}
        year={2026}
        grades={grades}
        rosters={rosters}
      />
    );

    const checkbox = screen.getByTestId('auto-create-groups-invite-students') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);

    const confirmInput = screen.getByTestId('auto-create-groups-confirm-input');
    fireEvent.change(confirmInput, { target: { value: '1' } });

    const confirmBtn = screen.getByTestId('auto-create-groups-confirm-btn');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByTestId('auto-create-groups-done')).toBeDefined();
    });

    expect(mockCallGroupsCreate).toHaveBeenCalledTimes(1);
    expect(mockCallGroupsCreate).toHaveBeenCalledWith({
      email: 'class-1a@cam.hs.kr',
      name: '1학년 A반',
      description: '2026년 1학년 A반 자동 생성',
    });

    expect(mockCallGroupsMembersInsert).toHaveBeenCalledTimes(2);
    expect(mockCallGroupsMembersInsert).toHaveBeenNthCalledWith(1, {
      groupEmail: 'class-1a@cam.hs.kr',
      memberEmail: 'student1@cam.hs.kr',
      role: 'MEMBER',
    });
    expect(mockCallGroupsMembersInsert).toHaveBeenNthCalledWith(2, {
      groupEmail: 'class-1a@cam.hs.kr',
      memberEmail: 'student2@cam.hs.kr',
      role: 'MEMBER',
    });

    const doneText = screen.getByTestId('auto-create-groups-done').textContent;
    expect(doneText).toContain('3개 성공');
  });
});

