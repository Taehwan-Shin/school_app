import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { BasicDataYear } from '@school-app/shared';

const mockCallGroupsMembersInsert = vi.fn();

vi.mock('../src/api/groupsMembersInsert.js', () => ({
  callGroupsMembersInsert: (data: unknown) => mockCallGroupsMembersInsert(data),
}));

import { AutoInviteStudentsDialog } from '../src/routes/admin/AutoInviteStudentsDialog.js';

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

describe('AutoInviteStudentsDialog component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('scenario 1: renders targets table with group email and member email combinations for grades and rosters', () => {
    const data: BasicDataYear = {
      year: 2026,
      grades: [
        { grade: 1, classes: ['A', 'B'] },
      ],
      rosters: {
        '1': {
          A: ['student1@cam.hs.kr', 'student2@cam.hs.kr'],
          B: ['student3@cam.hs.kr'],
        },
      },
    };

    renderWithClient(
      <AutoInviteStudentsDialog
        open={true}
        onOpenChange={vi.fn()}
        year={2026}
        data={data}
      />
    );

    expect(screen.getAllByText('class-1a@cam.hs.kr')).toHaveLength(2);
    expect(screen.getByText('student1@cam.hs.kr')).toBeDefined();
    expect(screen.getByText('student2@cam.hs.kr')).toBeDefined();
    expect(screen.getByText('class-1b@cam.hs.kr')).toBeDefined();
    expect(screen.getByText('student3@cam.hs.kr')).toBeDefined();

    const confirmBtn = screen.getByTestId('auto-invite-students-confirm-btn') as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(false);
  });

  it('scenario 2: recalculates preview emails on prefix edit and enforces prefix validation', () => {
    const data: BasicDataYear = {
      year: 2026,
      grades: [{ grade: 1, classes: ['A'] }],
      rosters: {
        '1': {
          A: ['student1@cam.hs.kr'],
        },
      },
    };

    renderWithClient(
      <AutoInviteStudentsDialog
        open={true}
        onOpenChange={vi.fn()}
        year={2026}
        data={data}
      />
    );

    const prefixInput = screen.getByTestId('auto-invite-students-prefix-input') as HTMLInputElement;
    const confirmBtn = screen.getByTestId('auto-invite-students-confirm-btn') as HTMLButtonElement;

    expect(prefixInput.value).toBe('class');
    expect(screen.getByText('class-1a@cam.hs.kr')).toBeDefined();
    expect(confirmBtn.disabled).toBe(false);

    // Edit prefix to homeroom
    fireEvent.change(prefixInput, { target: { value: 'homeroom' } });
    expect(screen.getByText('homeroom-1a@cam.hs.kr')).toBeDefined();
    expect(screen.queryByText('class-1a@cam.hs.kr')).toBeNull();
    expect(confirmBtn.disabled).toBe(false);

    // Invalid prefix: empty
    fireEvent.change(prefixInput, { target: { value: '' } });
    expect(confirmBtn.disabled).toBe(true);

    // Invalid prefix: special character
    fireEvent.change(prefixInput, { target: { value: 'class!' } });
    expect(confirmBtn.disabled).toBe(true);

    // Valid prefix: 2026-students
    fireEvent.change(prefixInput, { target: { value: '2026-students' } });
    expect(screen.getByText('2026-students-1a@cam.hs.kr')).toBeDefined();
    expect(confirmBtn.disabled).toBe(false);
  });

  it('scenario 3: iterates callGroupsMembersInsert on confirm and transitions to done phase with 0 failures', async () => {
    const data: BasicDataYear = {
      year: 2026,
      grades: [{ grade: 1, classes: ['A'] }],
      rosters: {
        '1': {
          A: ['student1@cam.hs.kr', 'student2@cam.hs.kr'],
        },
      },
    };
    mockCallGroupsMembersInsert.mockResolvedValue({
      groupEmail: 'class-1a@cam.hs.kr',
      memberEmail: 'student1@cam.hs.kr',
      role: 'MEMBER',
    });
    const onDone = vi.fn();
    const onOpenChange = vi.fn();

    renderWithClient(
      <AutoInviteStudentsDialog
        open={true}
        onOpenChange={onOpenChange}
        year={2026}
        data={data}
        onDone={onDone}
      />
    );

    const confirmBtn = screen.getByTestId('auto-invite-students-confirm-btn');
    expect((confirmBtn as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByTestId('auto-invite-students-done')).toBeDefined();
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

    const doneText = screen.getByTestId('auto-invite-students-done').textContent;
    expect(doneText).toContain('2개 성공');
    expect(screen.queryByTestId('auto-invite-students-failures')).toBeNull();
    expect(screen.queryByTestId('auto-invite-students-skipped')).toBeNull();

    const okBtn = screen.getByRole('button', { name: '확인' });
    fireEvent.click(okBtn);

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onDone).toHaveBeenCalled();
  });

  it('scenario 4: handles rejection with Member already exists into skipped category and general error into failures', async () => {
    const data: BasicDataYear = {
      year: 2026,
      grades: [{ grade: 1, classes: ['A', 'B', 'C'] }],
      rosters: {
        '1': {
          A: ['student1@cam.hs.kr'],
          B: ['student2@cam.hs.kr'],
          C: ['student3@cam.hs.kr'],
        },
      },
    };
    mockCallGroupsMembersInsert
      .mockResolvedValueOnce({
        groupEmail: 'class-1a@cam.hs.kr',
        memberEmail: 'student1@cam.hs.kr',
        role: 'MEMBER',
      })
      .mockRejectedValueOnce(new Error('Member already exists'))
      .mockRejectedValueOnce(new Error('network error'));

    renderWithClient(
      <AutoInviteStudentsDialog
        open={true}
        onOpenChange={vi.fn()}
        year={2026}
        data={data}
      />
    );

    const confirmBtn = screen.getByTestId('auto-invite-students-confirm-btn');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByTestId('auto-invite-students-done')).toBeDefined();
    });

    expect(mockCallGroupsMembersInsert).toHaveBeenCalledTimes(3);
    const doneText = screen.getByTestId('auto-invite-students-done').textContent;
    expect(doneText).toContain('1개 성공');
    expect(doneText).toContain('1개 이미 멤버 (skip)');
    expect(doneText).toContain('1개 실패');

    const skippedEl = screen.getByTestId('auto-invite-students-skipped');
    expect(skippedEl.textContent).toContain('student2@cam.hs.kr');
    expect(skippedEl.textContent).toContain('이미 멤버');

    const failuresEl = screen.getByTestId('auto-invite-students-failures');
    expect(failuresEl.textContent).toContain('student3@cam.hs.kr');
    expect(failuresEl.textContent).toContain('network error');
  });
});
