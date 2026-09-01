import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockMutateAsync = vi.fn();
let mockIsPending = false;
let mockError: Error | null = null;

vi.mock('../src/api/groupsMembersDelete.js', () => ({
  useRemoveMember: () => ({
    mutateAsync: mockMutateAsync,
    isPending: mockIsPending,
    error: mockError,
  }),
}));

import { RemoveMemberDialog } from '../src/routes/admin/RemoveMemberDialog.js';

describe('RemoveMemberDialog component', () => {
  const groupEmail = 'group-a@cam.hs.kr';
  const targetMember = {
    email: 'member1@cam.hs.kr',
    role: 'MEMBER',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsPending = false;
    mockError = null;
  });

  it('renders target member info and disabled remove button initially', () => {
    render(
      <RemoveMemberDialog
        open={true}
        onOpenChange={vi.fn()}
        groupEmail={groupEmail}
        member={targetMember}
      />
    );

    expect(screen.getByText('멤버 제거 확인')).toBeDefined();
    expect(screen.getByText('이 작업은 되돌릴 수 없습니다.')).toBeDefined();
    expect(screen.getByText(groupEmail)).toBeDefined();
    expect(screen.getAllByText(targetMember.email).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(targetMember.role)).toBeDefined();

    const submitBtn = screen.getByTestId('remove-member-submit') as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);
  });

  it('enables remove button only when matching email is typed', () => {
    render(
      <RemoveMemberDialog
        open={true}
        onOpenChange={vi.fn()}
        groupEmail={groupEmail}
        member={targetMember}
      />
    );

    const input = screen.getByTestId('remove-member-confirm-input');
    const submitBtn = screen.getByTestId('remove-member-submit') as HTMLButtonElement;

    fireEvent.change(input, { target: { value: 'wrong@cam.hs.kr' } });
    expect(submitBtn.disabled).toBe(true);

    fireEvent.change(input, { target: { value: targetMember.email } });
    expect(submitBtn.disabled).toBe(false);
  });

  it('submits delete request and calls onSuccess on confirmation', async () => {
    mockMutateAsync.mockResolvedValueOnce({
      groupEmail,
      memberEmail: targetMember.email,
      deleted: true,
    });
    const onOpenChange = vi.fn();
    const onSuccess = vi.fn();

    render(
      <RemoveMemberDialog
        open={true}
        onOpenChange={onOpenChange}
        groupEmail={groupEmail}
        member={targetMember}
        onSuccess={onSuccess}
      />
    );

    const input = screen.getByTestId('remove-member-confirm-input');
    fireEvent.change(input, { target: { value: targetMember.email } });

    const submitBtn = screen.getByTestId('remove-member-submit');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        groupEmail,
        memberEmail: targetMember.email,
      });
      expect(onSuccess).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('displays mapped error banner when removing last owner fails', () => {
    mockError = new Error('cannot_remove_last_owner');

    render(
      <RemoveMemberDialog
        open={true}
        onOpenChange={vi.fn()}
        groupEmail={groupEmail}
        member={{ email: 'owner@cam.hs.kr', role: 'OWNER' }}
      />
    );

    expect(screen.getByTestId('remove-member-error')).toBeDefined();
    expect(
      screen.getByText('마지막 소유자는 제거할 수 없습니다.')
    ).toBeDefined();
  });

  it('displays mapped permission-denied error banner', () => {
    mockError = new Error('permission-denied: requires admin role');

    render(
      <RemoveMemberDialog
        open={true}
        onOpenChange={vi.fn()}
        groupEmail={groupEmail}
        member={targetMember}
      />
    );

    expect(screen.getByTestId('remove-member-error')).toBeDefined();
    expect(
      screen.getByText('멤버 제거 권한이 없거나 스코프가 부족합니다.')
    ).toBeDefined();
  });
});
